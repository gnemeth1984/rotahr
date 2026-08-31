import { prisma } from "@/lib/prisma";
import { readLoyaltyConfig, qualifyingTier, type LoyaltyConfig } from "@/lib/crm/loyalty";

/**
 * Guest rollups.
 *
 * Customer.visitCount / totalSpend / averageSpend / lastVisitAt /
 * favouriteDishes / loyaltyPoints are caches. GuestTransaction, Reservation and
 * LoyaltyRedemption are the truth; this recomputes the cache from them so the
 * CRM list and every campaign segment can filter on indexed columns instead of
 * loading every reservation for every guest.
 *
 * Counting rule (documented because it is a judgement call): a visit is a
 * distinct calendar day on which the guest either has a recorded transaction or
 * an attended reservation. A booking and its bill on the same day are one
 * visit, not two. Cancellations and no-shows never count as a visit.
 *
 * averageSpend is spend per *paid* visit, not per visit — dividing recorded
 * spend by visits that have no bill attached would understate every guest
 * whose earlier bookings predate the transactions feature.
 */

const NON_VISIT_STATUSES = new Set(["cancelled", "no-show", "no_show", "noshow"]);

function dayKey(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface GuestStats {
  visitCount: number;
  totalSpend: number;
  averageSpend: number;
  lastVisitAt: Date | null;
  favouriteDishes: string[];
  loyaltyPoints: number;
  loyaltyTier: string;
  tierChanged: boolean;
  previousTier: string;
  vipSince: Date | null;
}

/**
 * Recompute and persist one guest's rollups. Returns what was written plus
 * whether the tier moved, so the caller can raise a tier-upgrade campaign or
 * log an activity line.
 */
export async function recomputeGuestStats(
  businessId: string,
  customerId: string,
  config?: LoyaltyConfig
): Promise<GuestStats | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true, loyaltyTier: true, vipSince: true },
  });
  if (!customer) return null;

  const cfg = config ?? (await readLoyaltyConfig(businessId));

  const [transactions, reservations, redemptions] = await Promise.all([
    prisma.guestTransaction.findMany({
      where: { customerId },
      select: { date: true, totalSpend: true, items: true, itemsText: true, pointsAwarded: true },
      orderBy: { date: "desc" },
    }),
    prisma.reservation.findMany({
      where: { customerId, businessId },
      select: { date: true, status: true },
      orderBy: { date: "desc" },
    }),
    prisma.loyaltyRedemption.findMany({
      where: { customerId },
      select: { points: true },
    }),
  ]);

  const visitDays = new Set<string>();
  let lastVisit: Date | null = null;

  for (const t of transactions) {
    visitDays.add(dayKey(t.date));
    if (!lastVisit || t.date > lastVisit) lastVisit = t.date;
  }
  for (const r of reservations) {
    if (NON_VISIT_STATUSES.has((r.status || "").toLowerCase())) continue;
    // A booking in the future is not a visit yet.
    if (r.date.getTime() > Date.now()) continue;
    visitDays.add(dayKey(r.date));
    if (!lastVisit || r.date > lastVisit) lastVisit = r.date;
  }

  const totalSpend = round2(transactions.reduce((s, t) => s + (t.totalSpend || 0), 0));
  const paidVisits = transactions.length;
  const averageSpend = paidVisits > 0 ? round2(totalSpend / paidVisits) : 0;

  const earned = transactions.reduce((s, t) => s + (t.pointsAwarded || 0), 0);
  const spent = redemptions.reduce((s, r) => s + (r.points || 0), 0);
  const loyaltyPoints = Math.max(0, earned - spent);

  const favouriteDishes = topDishes(transactions);

  const visitCount = visitDays.size;
  const previousTier = customer.loyaltyTier;
  let loyaltyTier = previousTier;
  if (cfg.settings.autoUpgrade) {
    loyaltyTier = qualifyingTier(visitCount, totalSpend, cfg.tiers, cfg.settings.vipSpendThreshold);
  }
  const tierChanged = loyaltyTier !== previousTier;

  // vipSince is a first-reached stamp, never cleared by a later recompute, so
  // "VIP since March" stays true even if the thresholds are edited later.
  const vipSince =
    loyaltyTier === "vip" && !customer.vipSince ? new Date() : customer.vipSince;

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      visitCount,
      totalSpend,
      averageSpend,
      lastVisitAt: lastVisit,
      favouriteDishes,
      loyaltyPoints,
      loyaltyTier,
      vipSince,
      tierUpdatedAt: tierChanged ? new Date() : undefined,
      statsUpdatedAt: new Date(),
    },
  });

  return {
    visitCount,
    totalSpend,
    averageSpend,
    lastVisitAt: lastVisit,
    favouriteDishes,
    loyaltyPoints,
    loyaltyTier,
    tierChanged,
    previousTier,
    vipSince,
  };
}

/**
 * Most-ordered dish names for a guest, from the structured items array when the
 * transaction has one and from the typed line list when it does not. Names come
 * from the venue's own bills, so they are printed as entered.
 */
function topDishes(
  transactions: { items: unknown; itemsText: string | null }[]
): string[] {
  const counts = new Map<string, number>();

  const bump = (raw: string) => {
    const name = raw.trim().replace(/^\d+\s*[x×]\s*/i, "").replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 60) return;
    const key = name.toLowerCase();
    const seen = [...counts.keys()].find((k) => k.toLowerCase() === key);
    counts.set(seen ?? name, (counts.get(seen ?? name) ?? 0) + 1);
  };

  for (const t of transactions) {
    if (Array.isArray(t.items)) {
      for (const line of t.items as any[]) {
        if (line && typeof line === "object" && typeof line.name === "string") bump(line.name);
        else if (typeof line === "string") bump(line);
      }
    } else if (t.itemsText) {
      for (const line of t.itemsText.split(/[\n,]/)) bump(line);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([name]) => name);
}

/** Recompute a whole business. Used by the nightly cron and after a CSV import. */
export async function recomputeBusinessStats(
  businessId: string,
  limit = 5000
): Promise<{ updated: number; upgrades: { customerId: string; from: string; to: string }[] }> {
  const cfg = await readLoyaltyConfig(businessId);
  const customers = await prisma.customer.findMany({
    where: { businessId, isAnonymised: false },
    select: { id: true },
    take: limit,
  });

  let updated = 0;
  const upgrades: { customerId: string; from: string; to: string }[] = [];

  for (const c of customers) {
    const res = await recomputeGuestStats(businessId, c.id, cfg);
    if (!res) continue;
    updated++;
    if (res.tierChanged) upgrades.push({ customerId: c.id, from: res.previousTier, to: res.loyaltyTier });
  }

  return { updated, upgrades };
}
