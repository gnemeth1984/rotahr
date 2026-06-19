// @ts-nocheck
// Auto-calculate tip distribution based on hours worked in period
// Payment of Wages (Amendment) (Tips and Gratuities) Act 2022 compliance:
// — Records must be kept for each distribution
// — Each employee must receive their allocated amount
// — Method must be communicated to staff
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { poolId, customAmounts } = body;
  // customAmounts: optional array of { employeeId, shareAmount, customNote }

  const pool = await prisma.tipPool.findUnique({
    where: { id: poolId },
    include: { distributions: true },
  });

  if (!pool || pool.businessId !== businessId) {
    return NextResponse.json({ error: "Pool not found" }, { status: 404 });
  }
  if (pool.status === "distributed") {
    return NextResponse.json({ error: "Already distributed" }, { status: 409 });
  }

  // Delete any existing draft distributions for this pool
  await prisma.tipDistribution.deleteMany({ where: { poolId } });

  let distributions: { employeeId: string; hoursWorked: number; shareAmount: number; customNote?: string }[] = [];

  if (pool.method === "custom" && customAmounts?.length) {
    // Custom allocations provided directly
    distributions = customAmounts.map((c: any) => ({
      employeeId: c.employeeId,
      hoursWorked: c.hoursWorked ?? 0,
      shareAmount: parseFloat(c.shareAmount),
      customNote: c.customNote ?? null,
    }));
  } else if (pool.method === "equal") {
    // Equal split among all active employees who worked in the period
    const shifts = await prisma.shift.findMany({
      where: {
        businessId,
        startTime: { gte: pool.periodStart },
        endTime: { lte: pool.periodEnd },
        employeeId: { not: null },
      },
      select: { employeeId: true },
    });
    const uniqueEmployeeIds = [...new Set(shifts.map((s) => s.employeeId))];
    const share = uniqueEmployeeIds.length > 0 ? pool.totalAmount / uniqueEmployeeIds.length : 0;
    distributions = uniqueEmployeeIds.map((empId) => ({
      employeeId: empId,
      hoursWorked: 0,
      shareAmount: Math.round(share * 100) / 100,
    }));
  } else {
    // Default: pro-rata by hours worked (most fair, typical Irish practice)
    const shifts = await prisma.shift.findMany({
      where: {
        businessId,
        startTime: { gte: pool.periodStart },
        endTime: { lte: pool.periodEnd },
        employeeId: { not: null },
      },
      select: { employeeId: true, startTime: true, endTime: true },
    });

    const hoursMap: Record<string, number> = {};
    for (const s of shifts) {
      const hrs = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
      hoursMap[s.employeeId] = (hoursMap[s.employeeId] ?? 0) + hrs;
    }

    const totalHours = Object.values(hoursMap).reduce((a, b) => a + b, 0);
    if (totalHours === 0) return NextResponse.json({ error: "No shifts found in period" }, { status: 400 });

    distributions = Object.entries(hoursMap).map(([empId, hrs]) => ({
      employeeId: empId,
      hoursWorked: Math.round(hrs * 100) / 100,
      shareAmount: Math.round((pool.totalAmount * (hrs / totalHours)) * 100) / 100,
    }));
  }

  // Create distribution records and mark pool as distributed
  await prisma.$transaction([
    prisma.tipDistribution.createMany({
      data: distributions.map((d) => ({
        poolId,
        employeeId: d.employeeId,
        hoursWorked: d.hoursWorked,
        shareAmount: d.shareAmount,
        customNote: d.customNote ?? null,
      })),
    }),
    prisma.tipPool.update({
      where: { id: poolId },
      data: { status: "distributed", distributedAt: new Date() },
    }),
  ]);

  const result = await prisma.tipPool.findUnique({
    where: { id: poolId },
    include: {
      distributions: {
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  return NextResponse.json({ pool: result });
}
