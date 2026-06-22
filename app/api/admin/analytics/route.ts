// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [total, last7, last30, todayCount] = await Promise.all([
    prisma.pageView.count(),
    prisma.pageView.count({ where: { createdAt: { gte: d7 } } }),
    prisma.pageView.count({ where: { createdAt: { gte: d30 } } }),
    prisma.pageView.count({ where: { createdAt: { gte: today } } }),
  ]);

  // Unique sessions last 30 days
  const uniqueSessions = await prisma.pageView.groupBy({
    by: ["sessionId"],
    where: { createdAt: { gte: d30 }, sessionId: { not: null } },
  });

  // Top pages last 30 days
  const topPages = await prisma.pageView.groupBy({
    by: ["path"],
    where: { createdAt: { gte: d30 } },
    _count: { path: true },
    orderBy: { _count: { path: "desc" } },
    take: 10,
  });

  // Top countries last 30 days
  const topCountries = await prisma.pageView.groupBy({
    by: ["country"],
    where: { createdAt: { gte: d30 }, country: { not: null } },
    _count: { country: true },
    orderBy: { _count: { country: "desc" } },
    take: 8,
  });

  // Top referrers last 30 days
  const topReferrers = await prisma.pageView.groupBy({
    by: ["referrer"],
    where: { createdAt: { gte: d30 }, referrer: { not: null, not: "" } },
    _count: { referrer: true },
    orderBy: { _count: { referrer: "desc" } },
    take: 8,
  });

  // Daily views last 14 days (for chart)
  const daily = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
    SELECT DATE("createdAt") as day, COUNT(*) as count
    FROM "PageView"
    WHERE "createdAt" >= NOW() - INTERVAL '14 days'
    GROUP BY DATE("createdAt")
    ORDER BY day ASC
  `;

  // Recent views
  const recent = await prisma.pageView.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, path: true, referrer: true, country: true, city: true, sessionId: true, createdAt: true },
  });

  return NextResponse.json({
    stats: {
      total,
      last7,
      last30,
      today: todayCount,
      uniqueSessions: uniqueSessions.length,
    },
    topPages: topPages.map((p) => ({ path: p.path, count: p._count.path })),
    topCountries: topCountries.map((c) => ({ country: c.country, count: c._count.country })),
    topReferrers: topReferrers.map((r) => ({ referrer: r.referrer, count: r._count.referrer })),
    daily: daily.map((d) => ({ day: String(d.day), count: Number(d.count) })),
    recent,
  });
}
