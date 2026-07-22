// @ts-nocheck
import { prisma } from "@/lib/db";

/**
 * Returns the Employees who should currently see/own a role- or
 * department-targeted Ops Task: anyone clocked in right now, plus anyone on
 * today's published shift (even if not clocked in yet) — matched by role
 * and/or department. This is what lets a recurring task stay "live" instead
 * of sitting orphaned when the one named person happens to be off.
 */
export async function getCurrentlyResponsible(
  businessId: string,
  filters: { role?: string | null; departmentId?: string | null }
): Promise<{ id: string; firstName: string; lastName: string; userId: string | null }[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const employeeWhere: any = { businessId, active: true };
  if (filters.departmentId) employeeWhere.departmentId = filters.departmentId;
  if (filters.role) employeeWhere.role = filters.role;

  // Candidates: anyone in the matching role/department at all (fallback if
  // nobody's clocked in or scheduled yet — still shows up, just not "live")
  const candidates = await prisma.employee.findMany({
    where: employeeWhere,
    select: { id: true, firstName: true, lastName: true, userId: true },
  });
  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.id);

  // Who's on today's published shift matching the role
  const shiftsToday = await prisma.shift.findMany({
    where: {
      published: true,
      date: { gte: todayStart, lte: todayEnd },
      employeeId: { in: candidateIds },
      ...(filters.role ? { role: filters.role } : {}),
    },
    select: { employeeId: true },
  });
  const scheduledIds = new Set(shiftsToday.map((s) => s.employeeId).filter(Boolean));

  // Who's currently clocked in (latest event today is "in" with no later "out")
  const clockEvents = await prisma.clockEvent.findMany({
    where: { employeeId: { in: candidateIds }, timestamp: { gte: todayStart, lte: todayEnd } },
    orderBy: { timestamp: "asc" },
    select: { employeeId: true, type: true },
  });
  const lastEventByEmployee = new Map<string, string>();
  for (const ev of clockEvents) lastEventByEmployee.set(ev.employeeId, ev.type);
  const clockedInIds = new Set(
    [...lastEventByEmployee.entries()].filter(([, type]) => type === "in").map(([id]) => id)
  );

  const liveIds = new Set([...scheduledIds, ...clockedInIds]);
  const live = candidates.filter((c) => liveIds.has(c.id));

  // If nobody's live yet (early morning, nobody clocked in), fall back to the
  // full candidate list so the task isn't invisible to everyone
  return live.length > 0 ? live : candidates;
}
