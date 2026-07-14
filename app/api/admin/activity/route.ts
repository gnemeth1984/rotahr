// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";

const ACTION_LABELS: Record<string, string> = {
  login: "Logged in",
  booking_created: "Created a booking",
  expense_added: "Added an expense",
  shift_published: "Published a shift",
  clock_in: "Clocked in",
  clock_out: "Clocked out",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = 30;

    const now = new Date();
    const onlineWindow = new Date(now.getTime() - 5 * 60 * 1000); // last 5 min = "online now"

    // ── Online now: distinct logged-in users with a page view in the last 5 min ──
    const onlineViews = await prisma.pageView.findMany({
      where: { createdAt: { gte: onlineWindow }, userId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { userId: true, path: true, createdAt: true, businessId: true },
    });
    const onlineMap = new Map<string, { path: string; createdAt: Date; businessId: string | null }>();
    for (const v of onlineViews) {
      if (v.userId && !onlineMap.has(v.userId)) {
        onlineMap.set(v.userId, { path: v.path, createdAt: v.createdAt, businessId: v.businessId });
      }
    }
    const onlineUserIds = [...onlineMap.keys()];
    const onlineUsers = onlineUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: onlineUserIds } },
          select: { id: true, name: true, email: true, business: { select: { name: true } } },
        })
      : [];
    const onlineNow = onlineUsers.map((u) => ({
      userId: u.id,
      name: u.name ?? u.email,
      businessName: u.business?.name ?? null,
      path: onlineMap.get(u.id)?.path ?? null,
      lastSeen: onlineMap.get(u.id)?.createdAt ?? null,
    }));

    // Also count anonymous visitors online now (no userId, distinct sessionId)
    const anonSessions = await prisma.pageView.groupBy({
      by: ["sessionId"],
      where: { createdAt: { gte: onlineWindow }, userId: null, sessionId: { not: null } },
    });

    // ── Live feed: merged PageViews + ActivityLog, most recent first ──
    const [pageViews, activityLogs] = await Promise.all([
      prisma.pageView.findMany({
        where: {
          ...(businessId ? { businessId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 150,
        select: {
          id: true, path: true, country: true, city: true, referrer: true,
          createdAt: true, userId: true, businessId: true, sessionId: true,
        },
      }),
      prisma.activityLog.findMany({
        where: { ...(businessId ? { businessId } : {}) },
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
    ]);

    // Resolve user names for page views tied to a user
    const pvUserIds = [...new Set(pageViews.map((v) => v.userId).filter(Boolean))] as string[];
    const pvUsers = pvUserIds.length
      ? await prisma.user.findMany({ where: { id: { in: pvUserIds } }, select: { id: true, name: true, email: true } })
      : [];
    const pvUserMap = new Map(pvUsers.map((u) => [u.id, u.name ?? u.email]));

    const feed = [
      ...pageViews.map((v) => ({
        id: `pv_${v.id}`,
        type: "page_view" as const,
        label: v.userId ? "Visited a page" : "Anonymous visitor",
        path: v.path,
        userName: v.userId ? pvUserMap.get(v.userId) ?? null : null,
        businessId: v.businessId,
        country: v.country,
        city: v.city,
        referrer: v.referrer,
        createdAt: v.createdAt,
      })),
      ...activityLogs.map((a) => ({
        id: `al_${a.id}`,
        type: "action" as const,
        label: ACTION_LABELS[a.action] ?? a.action,
        path: null,
        userName: a.userName,
        businessId: a.businessId,
        country: null,
        city: null,
        referrer: null,
        createdAt: a.createdAt,
        details: a.details,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const paged = feed.slice((page - 1) * limit, page * limit);

    // ── Per-business activity counts (last 30 days) ──
    const d30 = new Date(now.getTime() - 30 * 86400000);
    const byBusinessActions = await prisma.activityLog.groupBy({
      by: ["businessId"],
      where: { createdAt: { gte: d30 }, businessId: { not: null } },
      _count: { businessId: true },
      orderBy: { _count: { businessId: "desc" } },
      take: 20,
    });
    const bizIds = byBusinessActions.map((b) => b.businessId).filter(Boolean) as string[];
    const businesses = bizIds.length
      ? await prisma.business.findMany({ where: { id: { in: bizIds } }, select: { id: true, name: true } })
      : [];
    const bizMap = new Map(businesses.map((b) => [b.id, b.name]));
    const byBusiness = byBusinessActions.map((b) => ({
      businessId: b.businessId,
      businessName: bizMap.get(b.businessId as string) ?? "Unknown",
      count: b._count.businessId,
    }));

    // ── Login history ──
    const loginHistory = await prisma.user.findMany({
      where: { lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: "desc" },
      take: 50,
      select: {
        id: true, name: true, email: true, role: true, lastLoginAt: true, loginCount: true,
        business: { select: { name: true } },
      },
    });

    return NextResponse.json({
      onlineNow: {
        loggedIn: onlineNow,
        anonymousCount: anonSessions.length,
      },
      feed: paged,
      feedTotal: feed.length,
      page,
      pages: Math.ceil(feed.length / limit),
      byBusiness,
      loginHistory,
    });
  } catch (e: unknown) {
    console.error("[admin/activity]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
