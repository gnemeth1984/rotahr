// @ts-nocheck
// Apply a named template to a specific week
// POST /api/shifts/templates/apply { templateName, monday }
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { templateName, monday } = await req.json();
  if (!templateName || !monday) {
    return NextResponse.json({ error: "templateName and monday required" }, { status: 400 });
  }

  const weekStart = new Date(monday);
  weekStart.setHours(0, 0, 0, 0);

  const templates = await prisma.shiftTemplate.findMany({
    where: { businessId, templateName, active: true },
  });

  if (templates.length === 0) {
    return NextResponse.json({ error: "Template not found", created: 0 }, { status: 404 });
  }

  // Map dayOfWeek (JS: 0=Sun) to actual date in target week
  // weekStart is Monday, so:
  // Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
  function dayOffset(dow: number): number {
    if (dow === 0) return 6; // Sunday → +6 from Monday
    return dow - 1;          // Mon=0, Tue=1, ...
  }

  // Shifts already in that week for this business's staff, so applying the
  // same template twice (or after a partial apply) doesn't double-book anyone.
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  weekEnd.setDate(weekEnd.getDate() + 1); // overnight shifts ending Monday
  const bizEmpIds = (
    await prisma.employee.findMany({ where: { businessId }, select: { id: true } })
  ).map((e) => e.id);
  const existing = await prisma.shift.findMany({
    where: { employeeId: { in: bizEmpIds }, startTime: { gte: weekStart, lt: weekEnd } },
    select: { employeeId: true, startTime: true },
  });
  const taken = new Set(existing.map((s) => `${s.employeeId}|${s.startTime.getTime()}`));
  let skipped = 0;
  let unassignedSkipped = 0;

  const planned = templates.map((t) => {
      const shiftDate = new Date(weekStart);
      shiftDate.setDate(weekStart.getDate() + dayOffset(t.dayOfWeek));

      const startTime = new Date(shiftDate);
      startTime.setHours(t.startHour, t.startMinute, 0, 0);

      const endTime = new Date(shiftDate);
      endTime.setHours(t.endHour, t.endMinute, 0, 0);
      // Handle overnight (end < start)
      if (endTime <= startTime) endTime.setDate(endTime.getDate() + 1);

      return {
        date: shiftDate,
        startTime,
        endTime,
        role: t.role ?? null,
        published: false,
        employeeId: t.employeeId ?? null,
        venueId: t.venueId ?? null,
        overtimeHours: 0,
      };
    });
  const toCreate = planned.filter((d) => {
    // A shift with no employee has no link to the business (Shift has no
    // businessId), so nobody could ever see or delete it. Don't create those.
    if (!d.employeeId) {
      unassignedSkipped++;
      return false;
    }
    const k = `${d.employeeId}|${d.startTime.getTime()}`;
    if (taken.has(k)) {
      skipped++;
      return false;
    }
    taken.add(k);
    return true;
  });

  const created = await prisma.$transaction(toCreate.map((data) => prisma.shift.create({ data })));

  return NextResponse.json({ created: created.length, skipped, unassignedSkipped, templateName, week: monday });
}
