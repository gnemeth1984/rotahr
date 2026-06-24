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

  // Stats
  const [totalUsers, totalBusinesses, last7days, last30days] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } } }),
  ]);

  return NextResponse.json({
    users,
    total,
    page,
    pages: Math.ceil(total / limit),
    stats: { totalUsers, totalBusinesses, last7days, last30days },
  });
}
