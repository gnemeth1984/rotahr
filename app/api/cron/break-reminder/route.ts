// @ts-nocheck
// Break Entitlement Reminder Cron
// Runs every 30 minutes via Vercel cron
// For every currently clocked-in (not on break) employee, checks Irish break
// entitlement (Organisation of Working Time Act 1997) and notifies them if
// a break is due and hasn't been fully taken yet.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";
import { computeShiftState, getBreakEntitlement } from "@/lib/services/clock.service";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const authed = authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const dedupWindow = new Date(now.getTime() - 90 * 60 * 1000); // don't re-alert same level within 90 min

  // Find every employee with at least one clock event today
  const employeesWithEvents = await prisma.clockEvent.findMany({
    where: { timestamp: { gte: todayStart, lte: todayEnd } },
    select: { employeeId: true },
    distinct: ["employeeId"],
  });

  let alertCount = 0;
  let checked = 0;

  for (const { employeeId } of employeesWithEvents) {
    const events = await prisma.clockEvent.findMany({
      where: { employeeId, timestamp: { gte: todayStart, lte: todayEnd } },
      orderBy: { timestamp: "asc" },
    });

    const state = computeShiftState(events, now);
    if (!state.isClockedIn || state.isOnBreak) continue; // only nudge active workers, not on break already

    checked++;
    const entitlement = getBreakEntitlement(state);
    if (entitlement.dueLevel === "none" || entitlement.satisfied) continue;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true, firstName: true, lastName: true },
    });
    if (!employee?.userId) continue;

    const refId = `break_${employeeId}_${entitlement.dueLevel}_${todayStart.toISOString().split("T")[0]}`;

    // Dedup: skip if we already sent this exact level's reminder recently
    const existing = await prisma.appNotification.findFirst({
      where: {
        userId: employee.userId,
        type: "message",
        referenceId: refId,
        createdAt: { gte: dedupWindow },
      },
    });
    if (existing) continue;

    const minutes = entitlement.dueLevel === "30" ? 30 : 15;
    await createNotification({
      userId: employee.userId,
      type: "message",
      title: `Break reminder`,
      body: `You're entitled to a ${minutes}-minute break — you've worked ${entitlement.dueLevel === "30" ? "6+" : "4.5+"} hours today. Take it now.`,
      link: `/clock`,
    });

    // Manually stamp referenceId for dedup (createNotification doesn't accept it)
    await prisma.appNotification.updateMany({
      where: { userId: employee.userId, type: "message", link: "/clock", referenceId: null, createdAt: { gte: new Date(now.getTime() - 5000) } },
      data: { referenceId: refId },
    });

    alertCount++;
  }

  return NextResponse.json({ checked, alerts: alertCount, timestamp: now.toISOString() });
}
