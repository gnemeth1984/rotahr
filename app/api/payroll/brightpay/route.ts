// @ts-nocheck
// BrightPay CSV Export
// Format: BrightPay import spec — Employer ID, Surname, Forename, PPSN (if stored),
// Period Start, Period End, Hours, Basic Pay (optional)
// BrightPay is used by ~40% of Irish SME payroll bureaus.
// GDPR Art.6(1)(c) — processing for legal payroll obligations.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await requirePermission("payroll");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;
  const { searchParams } = new URL(req.url);
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

  const businessEmployees = await prisma.employee.findMany({
    where: { businessId },
    select: { id: true },
  });
  const empIds = businessEmployees.map((e) => e.id);

  const shifts = await prisma.shift.findMany({
    where: {
      employeeId: { in: empIds },
      startTime: { gte: monday },
      endTime: { lte: sunday },
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          hourlyRate: true,
        },
      },
    },
  });

  const byEmployee: Record<string, {
    firstName: string;
    lastName: string;
    email: string;
    hourlyRate: number;
    totalHours: number;
    totalPay: number;
  }> = {};

  for (const shift of shifts) {
    if (!shift.employee) continue;
    const emp = shift.employee;
    const hrs = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / 3600000;
    if (!byEmployee[emp.id]) {
      byEmployee[emp.id] = {
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        hourlyRate: emp.hourlyRate ?? 0,
        totalHours: 0,
        totalPay: 0,
      };
    }
    byEmployee[emp.id].totalHours += hrs;
    byEmployee[emp.id].totalPay += hrs * (emp.hourlyRate ?? 0);
  }

  const periodStart = monday.toISOString().split("T")[0];
  const periodEnd = sunday.toISOString().split("T")[0];

  // PPSN (Personal Public Service Number) is required by BrightPay for Revenue submissions.
  // Rotahr does not store PPSNs — column is included blank; employer must complete before import.
  // Legal basis: TCA 1997 s.886, Social Welfare (Consolidation) Act 2005.
  const rows: string[] = [
    // NOTE: PPSN column intentionally blank — must be filled by employer before submitting to Revenue/BrightPay
    ["Surname", "Forename", "Email", "PPSN (required — add before import)", "Period Start", "Period End", "Hours", "Basic Pay (EUR)", "Note"].join(","),
  ];

  for (const emp of Object.values(byEmployee)) {
    rows.push([
      `"${emp.lastName}"`,
      `"${emp.firstName}"`,
      `"${emp.email}"`,
      `""`, // PPSN — blank, employer must fill
      periodStart,
      periodEnd,
      emp.totalHours.toFixed(2),
      emp.totalPay.toFixed(2),
      `"Gross pay only — PAYE/PRSI/USC via BrightPay"`,
    ].join(","));
  }

  // Disclaimer row
  rows.push(`"IMPORTANT","PPSN column is blank — add employee PPSNs before importing to BrightPay / submitting to Revenue","","","","","","",""`);
  rows.push(`"IMPORTANT","This file contains gross pay only. PAYE/PRSI/USC deductions must be calculated in BrightPay or equivalent payroll software.","","","","","","",""`);

  const csv = rows.join("\r\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="brightpay-${periodStart}.csv"`,
    },
  });
}
