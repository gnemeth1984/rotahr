// @ts-nocheck
// Annual Leave Entitlement — Organisation of Working Time Act 1997 s.19
// Irish law provides THREE methods; employer must use whichever gives the greater entitlement:
//   1. 4 working weeks per leave year
//   2. 1/3 of a working week per month (where employee worked ≥117h)
//   3. 8% of hours worked in the leave year (capped at 4 working weeks)
// For variable-hours hospitality staff, method 3 (8% of hours) is most common and simplest.
// This endpoint calculates method 3 using shifts in the current leave year (1 Apr → 31 Mar).
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

// Irish leave year runs 1 April → 31 March
function getLeaveYear(from?: string): { start: Date; end: Date; label: string } {
  const now = from ? new Date(from) : new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed; April = 3
  let start: Date, end: Date;
  if (month >= 3) {
    // April onwards → current leave year starts this April
    start = new Date(year, 3, 1);
    end = new Date(year + 1, 2, 31, 23, 59, 59);
  } else {
    // Jan–Mar → leave year started last April
    start = new Date(year - 1, 3, 1);
    end = new Date(year, 2, 31, 23, 59, 59);
  }
  const label = `${start.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })} – ${end.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}`;
  return { start, end, label };
}

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  // Optional: ?employeeId=xxx (managers can query for any employee in their business)
  // Without it, returns entitlement for the currently logged-in employee
  const targetEmployeeId = searchParams.get("employeeId");
  const leaveYearFrom = searchParams.get("leaveYear"); // optional ISO date to anchor the leave year

  const isManager =
    session.user.role === "MANAGER" || session.user.role === "ADMIN";

  // Resolve who we're querying
  let employeeId: string | null = null;
  let employeeRecord: { id: string; firstName: string; lastName: string; hourlyRate: number | null } | null = null;

  if (targetEmployeeId) {
    if (!isManager) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    employeeRecord = await prisma.employee.findFirst({
      where: { id: targetEmployeeId, businessId: session.user.businessId! },
      select: { id: true, firstName: true, lastName: true, hourlyRate: true },
    });
    if (!employeeRecord) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    employeeId = employeeRecord.id;
  } else {
    // Current user — find their employee record
    employeeRecord = await prisma.employee.findFirst({
      where: { email: session.user.email!, businessId: session.user.businessId! },
      select: { id: true, firstName: true, lastName: true, hourlyRate: true },
    });
    if (!employeeRecord) {
      // User might be a manager without an employee record
      return NextResponse.json({
        employeeId: null,
        hoursWorked: 0,
        entitlementDays: 0,
        entitlementHours: 0,
        method: "8% of hours worked (OWT Act 1997 s.19)",
        leaveYear: getLeaveYear(leaveYearFrom ?? undefined).label,
        note: "No employee record found for this account.",
      });
    }
    employeeId = employeeRecord.id;
  }

  const { start, end, label } = getLeaveYear(leaveYearFrom ?? undefined);

  // Sum all scheduled hours in the leave year
  const shifts = await prisma.shift.findMany({
    where: {
      employeeId,
      startTime: { gte: start },
      endTime: { lte: end },
    },
    select: { startTime: true, endTime: true, overtimeHours: true },
  });

  const totalHours = shifts.reduce((sum, s) => {
    const hrs = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
    return sum + hrs + (s.overtimeHours ?? 0);
  }, 0);

  // Method 3: 8% of hours worked, max 4 working weeks (typically 20 days / ~160h for 5-day week)
  // For hospitality (varying days/week), we express as hours rather than days to avoid ambiguity
  const entitlementHoursRaw = totalHours * 0.08;

  // Cap: 4 working weeks. We assume a working week = average weekly hours / hours per week worked.
  // Simplified cap: 4 weeks × average daily hours × 5 days = not always applicable for variable.
  // Irish WRC guidance: cap = 4 × (total hours / weeks worked so far). We apply a max of 160h (4×40h).
  const MAX_ENTITLEMENT_HOURS = 160; // conservative max; actual cap depends on contracted hours
  const entitlementHours = Math.min(entitlementHoursRaw, MAX_ENTITLEMENT_HOURS);

  // Convert to days using 8h reference day (standard WRC guidance for variable workers)
  const entitlementDays = entitlementHours / 8;

  // How many approved leave days already taken this leave year
  const takenLeave = await prisma.timeOffRequest.findMany({
    where: {
      userId: session.user.id,
      status: "APPROVED",
      startDate: { gte: start },
      endDate: { lte: end },
    },
    select: { startDate: true, endDate: true },
  });

  const daysTaken = takenLeave.reduce((sum, r) => {
    const days = Math.ceil(
      (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    return sum + days;
  }, 0);

  const daysRemaining = Math.max(0, entitlementDays - daysTaken);

  return NextResponse.json({
    employeeId,
    employeeName: `${employeeRecord.firstName} ${employeeRecord.lastName}`,
    leaveYear: label,
    hoursWorked: Math.round(totalHours * 100) / 100,
    entitlementHours: Math.round(entitlementHours * 100) / 100,
    entitlementDays: Math.round(entitlementDays * 10) / 10,
    daysTaken,
    daysRemaining: Math.round(daysRemaining * 10) / 10,
    method: "8% of hours worked (OWT Act 1997 s.19, method 3)",
    note: "Entitlement is calculated on scheduled hours. Public holidays are additional entitlement under OWT Act 1997 s.21.",
  });
}
