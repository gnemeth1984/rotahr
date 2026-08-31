import { prisma } from "@/lib/prisma";

/**
 * Campaign segments.
 *
 * A segment is a saved filter over Customer, evaluated at run time so a
 * campaign always targets whoever qualifies today. Every segment excludes
 * anonymised guests unconditionally: a GDPR erasure request must survive being
 * picked up again by a marketing list.
 *
 * Consent is NOT part of the segment. The segment answers "who is this about",
 * the send path answers "may we contact them" — that way a manager can see
 * "12 lapsed guests, 4 contactable" instead of silently missing eight people.
 */

export type SegmentKey =
  | "all"
  | "no_visit_30"
  | "no_visit_90"
  | "never_visited"
  | "birthday_month"
  | "birthday_week"
  | "high_spender"
  | "tier_silver"
  | "tier_gold"
  | "tier_vip"
  | "new_guests"
  | "frequent"
  | "tag";

export interface SegmentDef {
  key: SegmentKey;
  label: string;
  description: string;
  needsTag?: boolean;
}

export const SEGMENTS: SegmentDef[] = [
  { key: "all", label: "All guests", description: "Everyone on the guest list who has not been anonymised." },
  { key: "no_visit_30", label: "No visit in 30 days", description: "Visited at least once, but not in the last 30 days." },
  { key: "no_visit_90", label: "No visit in 90 days", description: "Lapsed for three months or more." },
  { key: "never_visited", label: "Never visited", description: "On the list with no recorded visit at all." },
  { key: "birthday_month", label: "Birthday this month", description: "Birthday falls in the current calendar month." },
  { key: "birthday_week", label: "Birthday in the next 7 days", description: "Birthday lands inside the next week." },
  { key: "high_spender", label: "High spenders", description: "Lifetime spend at or above the VIP threshold." },
  { key: "tier_silver", label: "Silver tier", description: "Currently on the Silver tier." },
  { key: "tier_gold", label: "Gold tier", description: "Currently on the Gold tier." },
  { key: "tier_vip", label: "VIP tier", description: "Currently on the VIP tier." },
  { key: "new_guests", label: "New in the last 30 days", description: "Added to the guest list in the last 30 days." },
  { key: "frequent", label: "10 visits or more", description: "Your regulars, by recorded visit count." },
  { key: "tag", label: "By tag", description: "Everyone carrying a chosen tag.", needsTag: true },
];

export function segmentLabel(key: string, tag?: string | null): string {
  const def = SEGMENTS.find((s) => s.key === key);
  if (!def) return key;
  if (def.needsTag && tag) return `Tag: ${tag}`;
  return def.label;
}

export interface SegmentCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  birthday: Date | null;
  gdprConsent: boolean;
  smsWhatsappConsent: boolean;
  loyaltyTier: string;
  loyaltyPoints: number;
  visitCount: number;
  totalSpend: number;
  averageSpend: number;
  lastVisitAt: Date | null;
  favouriteDishes: string[];
  tags: string[];
}

const SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  birthday: true,
  gdprConsent: true,
  smsWhatsappConsent: true,
  loyaltyTier: true,
  loyaltyPoints: true,
  visitCount: true,
  totalSpend: true,
  averageSpend: true,
  lastVisitAt: true,
  favouriteDishes: true,
  tags: true,
} as const;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

/**
 * Resolve a segment to the guests it currently matches.
 *
 * Birthday windows are filtered in JS rather than SQL: the stored birthday
 * carries a real year, and Postgres date-part matching across a month boundary
 * is far easier to get wrong than a day-of-year comparison here.
 */
export async function resolveSegment(
  businessId: string,
  segment: string,
  opts: { tag?: string | null; vipSpendThreshold?: number; limit?: number } = {}
): Promise<SegmentCustomer[]> {
  const limit = opts.limit ?? 2000;
  const where: any = { businessId, isAnonymised: false };

  switch (segment) {
    case "no_visit_30":
      where.lastVisitAt = { not: null, lt: daysAgo(30) };
      break;
    case "no_visit_90":
      where.lastVisitAt = { not: null, lt: daysAgo(90) };
      break;
    case "never_visited":
      where.lastVisitAt = null;
      break;
    case "high_spender":
      where.totalSpend = { gte: opts.vipSpendThreshold ?? 500 };
      break;
    case "tier_silver":
      where.loyaltyTier = "silver";
      break;
    case "tier_gold":
      where.loyaltyTier = "gold";
      break;
    case "tier_vip":
      where.loyaltyTier = "vip";
      break;
    case "new_guests":
      where.createdAt = { gte: daysAgo(30) };
      break;
    case "frequent":
      where.visitCount = { gte: 10 };
      break;
    case "birthday_month":
    case "birthday_week":
      where.birthday = { not: null };
      break;
    case "tag":
      if (opts.tag) where.tags = { has: opts.tag };
      break;
    case "all":
    default:
      break;
  }

  const rows = await prisma.customer.findMany({
    where,
    select: SELECT,
    take: limit,
    orderBy: { name: "asc" },
  });

  if (segment === "birthday_month") {
    const month = new Date().getUTCMonth();
    return rows.filter((r) => r.birthday && r.birthday.getUTCMonth() === month);
  }

  if (segment === "birthday_week") {
    return rows.filter((r) => r.birthday && birthdayWithinDays(r.birthday, 7));
  }

  return rows;
}

/** True when the guest's birthday falls in the next `days` days, year ignored. */
export function birthdayWithinDays(birthday: Date, days: number): boolean {
  const now = new Date();
  const thisYear = new Date(
    Date.UTC(now.getUTCFullYear(), birthday.getUTCMonth(), birthday.getUTCDate())
  );
  const nextYear = new Date(
    Date.UTC(now.getUTCFullYear() + 1, birthday.getUTCMonth(), birthday.getUTCDate())
  );
  const windowEnd = now.getTime() + days * 24 * 60 * 60 * 1000;
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  for (const d of [thisYear, nextYear]) {
    if (d.getTime() >= startOfToday && d.getTime() <= windowEnd) return true;
  }
  return false;
}

export function isBirthdayToday(birthday: Date | null): boolean {
  if (!birthday) return false;
  const now = new Date();
  return (
    birthday.getUTCMonth() === now.getUTCMonth() && birthday.getUTCDate() === now.getUTCDate()
  );
}

/** Can this guest be contacted on this channel, and if not, why not. */
export function contactability(
  c: Pick<SegmentCustomer, "email" | "phone" | "gdprConsent" | "smsWhatsappConsent">,
  channel: string
): { ok: boolean; to: string | null; reason: string | null } {
  if (channel === "sms") {
    if (!c.smsWhatsappConsent) return { ok: false, to: c.phone ?? null, reason: "no_consent" };
    if (!c.phone) return { ok: false, to: null, reason: "no_address" };
    return { ok: true, to: c.phone, reason: null };
  }
  if (!c.gdprConsent) return { ok: false, to: c.email ?? null, reason: "no_consent" };
  if (!c.email) return { ok: false, to: null, reason: "no_address" };
  return { ok: true, to: c.email, reason: null };
}
