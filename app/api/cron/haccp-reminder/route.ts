// @ts-nocheck
// HACCP Check Reminder Cron
// Runs every 15 minutes via Vercel cron.
// For every business with an active schedule for a check type, if a scheduled
// time has passed today and no HACCPRecord has been logged for that check type
// since that scheduled time, notify everyone currently clocked in (or, if
// nobody is clocked in, everyone on a published shift covering now).
// Keeps re-notifying every run until the check is logged (no cross-run dedup,
// per business requirement — "just keep reminding").
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

const CHECK_LABELS: Record<string, string> = {
  fridge_temp: "Fridge / Cold Room temperature check",
  freezer_temp: "Freezer temperature check",
  hot_holding: "Hot Holding temperature check",
  cooking_temp: "Cooking Temperature check",
  cooling: "Cooling Record check",
  delivery: "Delivery check",
  cleaning_daily: "Daily Cleaning checklist",
  cleaning_weekly: "Weekly Cleaning checklist",
  cleaning_deep: "Deep Clean checklist",
  opening_checks: "Opening Checks",
  closing_checks: "Closing Checks",
  pest_control: "Pest Control Log",
  corrective_action: "Corrective Action Log",
};

function parseTimeToday(hhmm: string, now: Date): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h, m, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const authed = authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun..6=Sat
  const graceWindowMs = 20 * 60 * 1000; // a scheduled time counts as "due" for 20 min after it passes, so a 15-min cron never misses it
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);

  const schedules = await prisma.hACCPSchedule.findMany({ where: { active: true } });

  let checksNotified = 0;
  let notificationsSent = 0;

  for (const schedule of schedules) {
    const days: number[] = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [];
    if (days.length > 0 && !days.includes(dayOfWeek)) continue;

    const times: string[] = Array.isArray(schedule.times) ? schedule.times : [];

    for (const t of times) {
      const scheduledAt = parseTimeToday(t, now);
      const msSincedue = now.getTime() - scheduledAt.getTime();
      // Due window: passed, but not so long ago it's stale (within grace window + cron interval buffer)
      if (msSincedue < 0 || msSincedue > graceWindowMs) continue;

      // Has this check type been logged since the scheduled time?
      const existingRecord = await prisma.hACCPRecord.findFirst({
        where: {
          businessId: schedule.businessId,
          checkType: schedule.checkType,
          checkedAt: { gte: scheduledAt },
        },
      });
      if (existingRecord) continue; // already done — no reminder needed

      checksNotified++;
      const label = CHECK_LABELS[schedule.checkType] ?? schedule.checkType;

      // Find who's clocked in right now for this business
      const clockedInEvents = await prisma.clockEvent.findMany({
        where: { businessId: schedule.businessId, timestamp: { gte: dayStart, lte: now } },
        orderBy: { timestamp: "asc" },
      });
      const byEmployee = new Map<string, string>(); // employeeId -> last event type
      for (const e of clockedInEvents) {
        if (e.type === "in" || e.type === "out") byEmployee.set(e.employeeId, e.type);
      }
      const clockedInEmployeeIds = [...byEmployee.entries()]
        .filter(([, type]) => type === "in")
        .map(([id]) => id);

      let targetEmployeeIds = clockedInEmployeeIds;

      // Fallback: nobody clocked in — use published shifts covering now
      if (targetEmployeeIds.length === 0) {
        const activeShifts = await prisma.shift.findMany({
          where: {
            published: true,
            employeeId: { not: null },
            startTime: { lte: now },
            endTime: { gte: now },
            employee: { businessId: schedule.businessId },
          },
          select: { employeeId: true },
        });
        targetEmployeeIds = activeShifts.map((s) => s.employeeId).filter(Boolean) as string[];
      }

      if (targetEmployeeIds.length === 0) continue; // nobody to notify

      const employees = await prisma.employee.findMany({
        where: { id: { in: targetEmployeeIds } },
        select: { userId: true },
      });
      const userIds = employees.map((e) => e.userId).filter(Boolean) as string[];

      for (const userId of userIds) {
        await createNotification({
          userId,
          type: "message",
          title: `HACCP check due: ${label}`,
          body: `Scheduled for ${t} — please log it now.`,
          link: `/haccp`,
        });
        notificationsSent++;
      }
    }
  }

  return NextResponse.json({
    schedulesChecked: schedules.length,
    checksDue: checksNotified,
    notificationsSent,
    timestamp: now.toISOString(),
  });
}
