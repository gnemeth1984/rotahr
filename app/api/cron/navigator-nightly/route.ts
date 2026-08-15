// Navigator nightly tidy-up (5.3).
//
// Runs once at 20:45 UTC (21:45 Dublin) — deliberately BEFORE the 23:00 Dublin
// Neon suspend window, so it never wakes a sleeping database, and after the
// evening "close the day" nudge has had its chance to fire.
//
// Four jobs, in order:
//   1. Archive finished tasks that are old enough to stop cluttering the list.
//   2. Park the genuinely abandoned ones (timidly — see below).
//   3. Write tomorrow's anchor line so the morning starts with a decision already
//      made. Blocks are NOT generated here: the plan needs an energy reading that
//      only tomorrow's self can give.
//   4. Delete expired snoozes.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { dublinNow } from "@/lib/cron/service-hours";

/** A done task stays visible this long, so ticking things off still feels like something. */
const ARCHIVE_AFTER_HOURS = 20;

/**
 * Auto-park is intentionally timid: only "later" priority, only with no deadline,
 * only untouched for three weeks. Hiding something a person still cares about is
 * far worse than a slightly long list — it breaks trust in the whole system.
 */
const PARK_AFTER_DAYS = 21;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret =
    req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  const authed =
    authHeader === `Bearer ${process.env.CRON_SECRET}` || secret === process.env.CRON_SECRET;
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const { hour } = dublinNow(now);
  // Same guard as the nudge cron: never touch Prisma inside the suspend window.
  if (hour >= 23 || hour < 6) return NextResponse.json({ skipped: "hard quiet hours", hour });

  const { prisma } = await import("@/lib/db");
  const { todayKey, dayFromKey, addDaysKey } = await import("@/lib/navigator/dates");
  const { windowForDate } = await import("@/lib/navigator/context");

  const profiles = await prisma.navProfile.findMany();
  if (!profiles.length) return NextResponse.json({ ok: true, profiles: 0 });

  const results: Record<string, unknown>[] = [];

  for (const profile of profiles) {
    const userId = profile.userId;
    const tz = profile.timezone || "Europe/Dublin";
    const today = todayKey(tz);
    const tomorrow = addDaysKey(today, 1);

    // 1. Archive.
    const archived = await prisma.navTask.updateMany({
      where: {
        userId,
        status: "done",
        archivedAt: null,
        completedAt: { lt: new Date(now.getTime() - ARCHIVE_AFTER_HOURS * 3600_000) },
      },
      data: { archivedAt: now },
    });

    // 2. Park the abandoned.
    const parked = await prisma.navTask.updateMany({
      where: {
        userId,
        status: "todo",
        priority: "later",
        dueDate: null,
        archivedAt: null,
        updatedAt: { lt: new Date(now.getTime() - PARK_AFTER_DAYS * 86_400_000) },
      },
      data: { status: "parked" },
    });

    // 3. Tomorrow's anchor. Only ever written when tomorrow has nothing yet —
    // it must never overwrite a plan the user made themselves.
    const existing = await prisma.navDayPlan.findUnique({
      where: { userId_date: { userId, date: dayFromKey(tomorrow) } },
    });

    let anchor: string | null = null;
    if (!existing) {
      const { window: shift } = windowForDate(profile, tomorrow);
      const candidates = await prisma.navTask.findMany({
        where: { userId, status: { in: ["todo", "doing"] }, archivedAt: null },
        orderBy: [{ dueDate: "asc" }, { order: "asc" }, { createdAt: "asc" }],
        take: 40,
      });

      // Pick mechanically, not with the model: overdue beats due-tomorrow beats
      // urgent beats whatever is oldest. A deterministic pick costs nothing, can't
      // hallucinate, and is identical every night — which is the point of a ritual.
      const tomorrowDate = dayFromKey(tomorrow);
      const rank = (t: (typeof candidates)[number]) => {
        if (t.dueDate && t.dueDate < tomorrowDate) return 0; // already overdue
        if (t.dueDate && t.dueDate.getTime() === tomorrowDate.getTime()) return 1;
        if (t.priority === "urgent") return 2;
        if (t.status === "doing") return 3; // already started — finishing beats starting
        if (t.priority === "important") return 4;
        return 5;
      };
      const pick = candidates.sort((a, b) => rank(a) - rank(b))[0];

      if (pick) {
        const mins = pick.effortMins ? ` (~${pick.effortMins} min)` : "";
        anchor = shift
          ? `Before your ${shift.start} shift: ${pick.title}${mins}.`
          : `One thing that makes tomorrow count: ${pick.title}${mins}.`;
        await prisma.navDayPlan.create({
          data: {
            userId,
            date: dayFromKey(tomorrow),
            anchor,
            focusTheme: pick.project || null,
            // blocks left null on purpose — that's tomorrow morning's job, and a
            // blocks-less row is explicitly not treated as "has a plan".
          },
        });
      }
    }

    // 4. Bin expired snoozes so the table stays small and the reads stay cheap.
    const snoozes = await prisma.navSnooze.deleteMany({ where: { userId, until: { lt: now } } });

    results.push({
      userId,
      archived: archived.count,
      parked: parked.count,
      anchor,
      snoozesCleared: snoozes.count,
    });
  }

  return NextResponse.json({ ok: true, results });
}
