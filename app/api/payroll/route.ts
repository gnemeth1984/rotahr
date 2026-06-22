// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await requirePermission("payroll");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);

  // Default to current week (Mon–Sun)
  const weekParam = searchParams.get("week");
  let monday: Date;
  if (weekParam) {
    monday = new Date(weekParam);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday = new Date(now);
    monday.setDate(now.getDate() + diff);
  }
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const shifts = await prisma.shift.findMany({
    where: {
      businessId,
      startTime: { gte: monday },
      endTime: { lte: sunday },
    },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true, hourlyRate: true } },
    },
  });

  const byEmployee: Record<string, {
    employeeId: string;
    firstName: string;
    lastName: string;
    hourlyRate: number;
    totalHours: number;
    totalPay: number;
    shiftCount: number;
  }> = {};

  for (const shift of shifts) {
    if (!shift.employee) continue;
    const emp = shift.employee;
    const hours = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3600000;
    const rate = emp.hourlyRate ?? 0;

    if (!byEmployee[emp.id]) {
      byEmployee[emp.id] = {
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        hourlyRate: rate,
        totalHours: 0,
        totalPay: 0,
        shiftCount: 0,
      };
    }
    byEmployee[emp.id].totalHours += hours;
    byEmployee[emp.id].totalPay += hours * rate;
    byEmployee[emp.id].shiftCount += 1;
  }

  // Irish National Minimum Wage — €13.50/hr from 1 Jan 2025
  // Organisation of Working Time Act 1997 / National Minimum Wage Act 2000
  const IRISH_NMW = 13.50;

  const rows = Object.values(byEmployee).map((r) => ({
    ...r,
    totalHours: Math.round(r.totalHours * 100) / 100,
    totalPay: Math.round(r.totalPay * 100) / 100,
    belowNMW: r.hourlyRate > 0 && r.hourlyRate < IRISH_NMW,
  }));

  const grandTotal = rows.reduce((sum, r) => sum + r.totalPay, 0);
  const nmwWarnings = rows
    .filter((r) => r.belowNMW)
    .map((r) => `${r.firstName} ${r.lastName} is set at €${r.hourlyRate.toFixed(2)}/hr — below the Irish NMW of €${IRISH_NMW.toFixed(2)}/hr`);

  return NextResponse.json({
    weekStart: monday.toISOString(),
    weekEnd: sunday.toISOString(),
    rows,
    grandTotal: Math.round(grandTotal * 100) / 100,
    nmwWarnings,
    grossOnly: true, // PAYE/PRSI/USC deductions must be calculated via BrightPay or equivalent payroll software
  });
}
