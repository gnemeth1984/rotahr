// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";

// Platform-admin only: full list of every business on the platform (not filtered
// by recent activity), plus a per-business drill-down of its users.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    // ── Detail view for a single business ──
    if (businessId) {
      const biz = await prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          onboardingComplete: true,
          currency: true,
          country: true,
          lsPlan: true,
          lsStatus: true,
          lsRenewsAt: true,
          lsEndsAt: true,
          venues: { select: { id: true, name: true, address: true, phone: true } },
          users: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
              lastLoginAt: true,
              loginCount: true,
            },
          },
          _count: {
            select: {
              users: true,
              employees: true,
              venues: true,
              reservations: true,
              expenses: true,
              customers: true,
            },
          },
        },
      });

      if (!biz) return NextResponse.json({ error: "Business not found" }, { status: 404 });

      const d30 = new Date(Date.now() - 30 * 86400000);
      const [actions30, views30, lastAction] = await Promise.all([
        prisma.activityLog.count({ where: { businessId, createdAt: { gte: d30 } } }),
        prisma.pageView.count({ where: { businessId, createdAt: { gte: d30 } } }),
        prisma.activityLog.findFirst({
          where: { businessId },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, action: true, userName: true },
        }),
      ]);

      return NextResponse.json({ business: { ...biz, actions30, views30, lastAction } });
    }

    // ── Full list: every business, activity counts left-joined on ──
    const [businesses, actionGroups] = await Promise.all([
      prisma.business.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          onboardingComplete: true,
          currency: true,
          country: true,
          lsPlan: true,
          lsStatus: true,
          publicProspect: true,
          publicSlug: true,
          publicClaimToken: true,
          publicNoIndex: true,
          _count: {
            select: { users: true, employees: true, venues: true, reservations: true },
          },
        },
      }),
      prisma.activityLog.groupBy({
        by: ["businessId"],
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) }, businessId: { not: null } },
        _count: { businessId: true },
      }),
    ]);

    const actionMap = new Map(
      actionGroups.map((g) => [g.businessId as string, g._count.businessId])
    );

    // Most recent login per business, so quiet accounts are still visible
    const lastLogins = await prisma.user.findMany({
      where: { lastLoginAt: { not: null }, businessId: { not: null } },
      orderBy: { lastLoginAt: "desc" },
      select: { businessId: true, lastLoginAt: true },
    });
    const lastLoginMap = new Map<string, Date>();
    for (const u of lastLogins) {
      if (u.businessId && !lastLoginMap.has(u.businessId)) lastLoginMap.set(u.businessId, u.lastLoginAt);
    }

    const rows = businesses.map((b) => ({
      id: b.id,
      name: b.name,
      createdAt: b.createdAt,
      onboardingComplete: b.onboardingComplete,
      currency: b.currency,
      country: b.country,
      lsPlan: b.lsPlan ?? "none",
      lsStatus: b.lsStatus ?? "none",
      users: b._count.users,
      employees: b._count.employees,
      venues: b._count.venues,
      reservations: b._count.reservations,
      actions30: actionMap.get(b.id) ?? 0,
      lastLoginAt: lastLoginMap.get(b.id) ?? null,
      // Prospect pages are marketing pages for venues we don't run. They have no
      // users by design, so they must never be counted as broken signups.
      isProspect: b.publicProspect === true,
      publicSlug: b.publicSlug ?? null,
      claimable: b.publicProspect === true ? Boolean(b.publicClaimToken) : null,
      indexable: b.publicProspect === true ? b.publicNoIndex !== true : null,
    }));

    const realBusinesses = rows.filter((r) => !r.isProspect);

    return NextResponse.json({
      total: rows.length,
      realTotal: realBusinesses.length,
      prospects: rows.filter((r) => r.isProspect).length,
      paying: rows.filter((r) => r.lsStatus === "active").length,
      // Only real businesses with no user are a problem worth flagging.
      empty: realBusinesses.filter((r) => r.users === 0).length,
      // Prospect pages that can never be claimed — no token was generated.
      unclaimable: rows.filter((r) => r.isProspect && !r.claimable).length,
      businesses: rows,
    });
  } catch (e: unknown) {
    console.error("[admin/businesses]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
