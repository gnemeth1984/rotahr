import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readLoyaltyConfig, tierName } from "@/lib/crm/loyalty";
import { birthdayWithinDays } from "@/lib/crm/segments";

/**
 * Unified CRM dashboard numbers.
 *
 * Everything here reads the cached rollups on Customer (visitCount, totalSpend,
 * lastVisitAt, loyaltyTier) rather than counting reservations on the fly, so the
 * page stays fast as a venue's history grows. The cron and every write path keep
 * those caches honest.
 */

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

function startOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = new Date(
    Date.UTC(thisMonthStart.getUTCFullYear(), thisMonthStart.getUTCMonth() - 1, 1)
  );
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 864e5);

  const cfg = await readLoyaltyConfig(businessId);

  const [
    business,
    guestCount,
    consentCount,
    tierGroups,
    spendAgg,
    thisMonth,
    lastMonth,
    topGuests,
    lapsedCount,
    neverVisited,
    birthdayGuests,
    upcomingReservations,
    recentTransactions,
    campaigns,
    sendGroups,
    lastSends,
  ] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId }, select: { name: true, currency: true } }),
    prisma.customer.count({ where: { businessId, isAnonymised: false } }),
    prisma.customer.count({ where: { businessId, isAnonymised: false, gdprConsent: true } }),
    prisma.customer.groupBy({
      by: ["loyaltyTier"],
      where: { businessId, isAnonymised: false },
      _count: { _all: true },
      _sum: { totalSpend: true, loyaltyPoints: true },
    }),
    prisma.customer.aggregate({
      where: { businessId, isAnonymised: false },
      _sum: { totalSpend: true, loyaltyPoints: true },
      _avg: { averageSpend: true },
    }),
    prisma.guestTransaction.aggregate({
      where: { businessId, date: { gte: thisMonthStart } },
      _sum: { totalSpend: true },
      _count: { _all: true },
    }),
    prisma.guestTransaction.aggregate({
      where: { businessId, date: { gte: lastMonthStart, lt: thisMonthStart } },
      _sum: { totalSpend: true },
      _count: { _all: true },
    }),
    prisma.customer.findMany({
      where: { businessId, isAnonymised: false, totalSpend: { gt: 0 } },
      orderBy: { totalSpend: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        totalSpend: true,
        visitCount: true,
        loyaltyTier: true,
        loyaltyPoints: true,
        lastVisitAt: true,
      },
    }),
    prisma.customer.count({
      where: { businessId, isAnonymised: false, lastVisitAt: { not: null, lt: thirtyDaysAgo } },
    }),
    prisma.customer.count({ where: { businessId, isAnonymised: false, lastVisitAt: null } }),
    prisma.customer.findMany({
      where: { businessId, isAnonymised: false, birthday: { not: null } },
      select: { id: true, name: true, birthday: true, loyaltyTier: true, gdprConsent: true },
      take: 500,
    }),
    prisma.reservation.count({
      where: { businessId, date: { gte: now }, status: { notIn: ["cancelled", "no-show"] } },
    }),
    prisma.guestTransaction.findMany({
      where: { businessId },
      orderBy: { date: "desc" },
      take: 8,
      select: {
        id: true,
        date: true,
        totalSpend: true,
        source: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.campaign.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        name: true,
        segment: true,
        channel: true,
        status: true,
        automationRule: true,
        active: true,
        lastRunAt: true,
        _count: { select: { sends: true } },
      },
    }),
    prisma.campaignSend.groupBy({
      by: ["status"],
      where: { businessId },
      _count: { _all: true },
    }),
    prisma.campaignSend.findMany({
      where: { businessId, status: "sent" },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: {
        id: true,
        channel: true,
        sentAt: true,
        subject: true,
        campaign: { select: { id: true, name: true } },
      },
    }),
  ]);

  const tiers = cfg.tiers.map((t) => {
    const row = tierGroups.find((g) => g.loyaltyTier === t.key);
    return {
      key: t.key,
      name: t.name,
      colour: t.colour,
      guests: row?._count._all ?? 0,
      totalSpend: Math.round((row?._sum.totalSpend ?? 0) * 100) / 100,
      points: row?._sum.loyaltyPoints ?? 0,
      minVisits: t.minVisits,
      minSpend: t.minSpend,
    };
  });
  // Any tier key sitting on a guest that no longer has a tier row.
  for (const g of tierGroups) {
    if (!tiers.some((t) => t.key === g.loyaltyTier)) {
      tiers.push({
        key: g.loyaltyTier,
        name: tierName(g.loyaltyTier, cfg.tiers),
        colour: "slate",
        guests: g._count._all,
        totalSpend: Math.round((g._sum.totalSpend ?? 0) * 100) / 100,
        points: g._sum.loyaltyPoints ?? 0,
        minVisits: 0,
        minSpend: 0,
      });
    }
  }

  const birthdaysThisWeek = birthdayGuests
    .filter((g) => g.birthday && birthdayWithinDays(g.birthday, 7))
    .map((g) => ({
      id: g.id,
      name: g.name,
      birthday: g.birthday,
      loyaltyTier: g.loyaltyTier,
      gdprConsent: g.gdprConsent,
    }));
  const birthdaysThisMonth = birthdayGuests.filter(
    (g) => g.birthday && g.birthday.getUTCMonth() === now.getUTCMonth()
  ).length;

  const sendCounts: Record<string, number> = {};
  for (const s of sendGroups) sendCounts[s.status] = s._count._all;

  const thisMonthSpend = Math.round((thisMonth._sum.totalSpend ?? 0) * 100) / 100;
  const lastMonthSpend = Math.round((lastMonth._sum.totalSpend ?? 0) * 100) / 100;

  return NextResponse.json({
    currency: business?.currency ?? "EUR",
    venue: business?.name ?? "",
    loyaltyEnabled: cfg.settings.enabled,
    guests: {
      total: guestCount,
      withConsent: consentCount,
      lapsed30: lapsedCount,
      neverVisited,
      birthdaysThisMonth,
    },
    spend: {
      lifetime: Math.round((spendAgg._sum.totalSpend ?? 0) * 100) / 100,
      averagePerGuest: Math.round((spendAgg._avg.averageSpend ?? 0) * 100) / 100,
      thisMonth: thisMonthSpend,
      lastMonth: lastMonthSpend,
      thisMonthTransactions: thisMonth._count._all,
      lastMonthTransactions: lastMonth._count._all,
      changePct:
        lastMonthSpend > 0
          ? Math.round(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 1000) / 10
          : null,
    },
    loyalty: {
      pointsOutstanding: spendAgg._sum.loyaltyPoints ?? 0,
      pointValue: cfg.settings.pointValue,
      liabilityValue:
        Math.round((spendAgg._sum.loyaltyPoints ?? 0) * cfg.settings.pointValue * 100) / 100,
      tiers,
    },
    topGuests,
    birthdaysThisWeek,
    upcomingReservations,
    recentTransactions,
    campaigns,
    sends: {
      counts: sendCounts,
      recent: lastSends,
    },
  });
}
