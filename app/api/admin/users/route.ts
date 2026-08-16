// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import {
  REAL_BUSINESS_WHERE,
  PAYING_CUSTOMER_WHERE,
  DEMO_BUSINESS_IDS,
} from "@/lib/tenancy/real-business";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        businessId: true,
        business: {
          select: {
            id: true,
            name: true,
            onboardingComplete: true,
            createdAt: true,
          },
        },
        employees: {
          select: { id: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Stats.
  //
  // `totalBusinesses` used to be a bare prisma.business.count(), which read 110
  // when there were 6 actual tenants — the other 104 are listing shells created
  // behind the public /v/... venue pages. An 18x overstatement on the founder
  // dashboard is worse than showing nothing, so the count is now scoped and the
  // shells are reported separately instead of being hidden.
  const [
    totalUsers,
    totalBusinesses,
    listingPages,
    payingBusinesses,
    internalBusinesses,
    last7days,
    last30days,
  ] = await Promise.all([
      prisma.user.count(),
      prisma.business.count({ where: REAL_BUSINESS_WHERE }),
      prisma.business.count({ where: { users: { none: {} } } }),
      // PAYING_CUSTOMER_WHERE, not lsStatus alone — see lib/tenancy/real-business.
      prisma.business.count({ where: PAYING_CUSTOMER_WHERE }),
      prisma.business.count({ where: { id: { in: DEMO_BUSINESS_IDS } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
    ]);

  return NextResponse.json({
    users,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: {
      totalUsers,
      totalBusinesses,
      listingPages,
      payingBusinesses,
      internalBusinesses,
      last7days,
      last30days,
    },
  });
}
