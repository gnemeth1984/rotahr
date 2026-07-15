// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

function startOfIsoWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(req: NextRequest) {
  const session = await requirePermission("reports");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);
  const weeks = Math.min(26, Math.max(4, parseInt(searchParams.get("weeks") || "12", 10)));

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { weeklyRevenueTarget: true },
  });

  const thisMonday = startOfIsoWeek(new Date());
  const rangeStart = new Date(thisMonday);
  rangeStart.setDate(rangeStart.getDate() - 7 * (weeks - 1));

  const [shifts, snapshots] = await Promise.all([
    prisma.shift.findMany({
      where: {
        startTime: { gte: rangeStart },
        employee: { businessId },
      },
      select: {
        startTime: true,
        endTime: true,
        overtimeHours: true,
        employee: { select: { hourlyRate: true } },
      },
    }),
    prisma.posSnapshot.findMany({
      where: { businessId, date: { gte: rangeStart } },
      select: { date: true, totalRevenue: true },
    }),
  ]);

  // Bucket into weeks
  const weekBuckets: Record<
    string,
    { weekStart: Date; labourCost: number; totalHours: number; overtimeHours: number; revenue: number }
  > = {};

  for (let i = 0; i < weeks; i++) {
    const ws = new Date(thisMonday);
    ws.setDate(ws.getDate() - 7 * (weeks - 1 - i));
    weekBuckets[ws.toISOString()] = {
      weekStart: ws,
      labourCost: 0,
      totalHours: 0,
      overtimeHours: 0,
      revenue: 0,
    };
  }

  function bucketKeyFor(date: Date) {
    const ws = startOfIsoWeek(date);
    return ws.toISOString();
  }

  for (const s of shifts) {
    const key = bucketKeyFor(new Date(s.startTime));
    const bucket = weekBuckets[key];
    if (!bucket) continue;
    const hours = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3_600_000;
    const rate = s.employee?.hourlyRate ?? 0;
    const ot = s.overtimeHours ?? 0;
    bucket.totalHours += hours;
    bucket.overtimeHours += ot;
    bucket.labourCost += hours * rate + ot * rate * 1.5;
  }

  for (const snap of snapshots) {
    const key = bucketKeyFor(new Date(snap.date));
    const bucket = weekBuckets[key];
    if (!bucket) continue;
    bucket.revenue += snap.totalRevenue;
  }

  const fallbackRevenue = business?.weeklyRevenueTarget ?? null;

  const result = Object.values(weekBuckets)
    .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
    .map((b) => {
      const revenue = b.revenue > 0 ? b.revenue : fallbackRevenue;
      const labourPct = revenue && revenue > 0 ? (b.labourCost / revenue) * 100 : null;
      return {
        weekStart: b.weekStart.toISOString(),
        weekLabel: b.weekStart.toLocaleDateString("en-IE", { day: "2-digit", month: "short" }),
        labourCost: Math.round(b.labourCost * 100) / 100,
        totalHours: Math.round(b.totalHours * 10) / 10,
        overtimeHours: Math.round(b.overtimeHours * 10) / 10,
        revenue: revenue ? Math.round(revenue * 100) / 100 : null,
        revenueIsEstimate: b.revenue <= 0 && !!fallbackRevenue,
        labourPct: labourPct !== null ? Math.round(labourPct * 10) / 10 : null,
      };
    });

  const withPct = result.filter((r) => r.labourPct !== null);
  const avgLabourPct =
    withPct.length > 0 ? withPct.reduce((s, r) => s + (r.labourPct ?? 0), 0) / withPct.length : null;
  const totalLabourCost = result.reduce((s, r) => s + r.labourCost, 0);
  const totalOvertimeHours = result.reduce((s, r) => s + r.overtimeHours, 0);

  return NextResponse.json({
    weeks: result,
    summary: {
      avgLabourPct: avgLabourPct !== null ? Math.round(avgLabourPct * 10) / 10 : null,
      totalLabourCost: Math.round(totalLabourCost * 100) / 100,
      totalOvertimeHours: Math.round(totalOvertimeHours * 10) / 10,
      hasRevenueData: result.some((r) => !r.revenueIsEstimate && r.revenue),
    },
  });
}
