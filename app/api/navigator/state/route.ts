import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile, DEFAULT_TZ, windowForDate } from "@/lib/navigator/context";
import { dayFromKey, todayKey, nowTime, weekStartKey, addDaysKey } from "@/lib/navigator/dates";
import { momentumFor } from "@/lib/navigator/momentum";
import { timeDebtFor } from "@/lib/navigator/timedebt";
import { ritualsForDay, currentRitual } from "@/lib/navigator/rituals";
import { planIsStale, STALE_AFTER_MINS } from "@/lib/navigator/compress";
import { sanitisePlanBlocks } from "@/lib/navigator/blocks";

export const dynamic = "force-dynamic";

// GET /api/navigator/state — one call, everything the Navigator UI renders.
export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const today = todayKey(tz);
  const weekStart = weekStartKey(today);

  const [plan, tasks, meals, workouts, habits, habitLogs, grocery, focus, checkins, weekPlans] =
    await Promise.all([
      prisma.navDayPlan.findUnique({ where: { userId_date: { userId, date: dayFromKey(today) } } }),
      // Drafts are excluded here on purpose. An un-triaged capture must not
      // show up in the live task list, or quick-capture just becomes clutter.
      prisma.navTask.findMany({
        where: { userId, status: { notIn: ["done", "draft"] }, archivedAt: null },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      prisma.navMeal.findMany({ where: { userId, date: dayFromKey(today) }, orderBy: { createdAt: "asc" } }),
      prisma.navWorkout.findMany({
        where: { userId, date: { gte: dayFromKey(today), lt: dayFromKey(addDaysKey(today, 7)) } },
        orderBy: { date: "asc" },
      }),
      prisma.navHabit.findMany({ where: { userId, active: true }, orderBy: { order: "asc" } }),
      prisma.navHabitLog.findMany({
        where: { userId, date: { gte: dayFromKey(addDaysKey(weekStart, -7)) } },
      }),
      prisma.navGroceryItem.findMany({ where: { userId }, orderBy: [{ checked: "asc" }, { category: "asc" }] }),
      prisma.navFocusSession.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } }),
      prisma.navCheckin.findMany({
        where: { userId, at: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
        orderBy: { at: "desc" },
        take: 40,
      }),
      prisma.navDayPlan.findMany({
        where: { userId, date: { gte: dayFromKey(addDaysKey(today, -13)) } },
        orderBy: { date: "asc" },
      }),
    ]);

  const [doneToday, drafts, recentNudges, snoozes, ritualLogs] = await Promise.all([
    // Archived tasks are excluded everywhere, including here — a task archived
    // last night should not reappear in today's "done" strip.
    prisma.navTask.findMany({
      where: {
        userId,
        status: "done",
        archivedAt: null,
        completedAt: { gte: new Date(`${today}T00:00:00.000Z`) },
      },
      orderBy: { completedAt: "desc" },
      take: 20,
    }),
    prisma.navTask.findMany({
      where: { userId, status: "draft", archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    // What the app has said today. Shown in-app so a missed push isn't a lost
    // nudge, and so each one has somewhere to be snoozed from.
    prisma.navNudge.findMany({
      where: { userId, sentAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 14) } },
      orderBy: { sentAt: "desc" },
      take: 12,
    }),
    prisma.navSnooze.findMany({ where: { userId, until: { gt: new Date() } }, orderBy: { until: "asc" } }),
    prisma.navRitualLog.findMany({ where: { userId, date: dayFromKey(today) } }),
  ]);

  // Read-only aggregation over rows already in the DB. Cheap enough to inline
  // here rather than making the UI do a second round trip.
  const [momentum, timeDebt] = await Promise.all([
    momentumFor(userId, today),
    timeDebtFor(userId, today),
  ]);

  const nowStr = nowTime(tz);
  const nowMins = (() => {
    const [h, m] = nowStr.split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
  })();

  const { window: todayShift } = windowForDate(profile, today);
  const rituals = profile.ritualsEnabled
    ? ritualsForDay(
        {
          wakeTime: profile.wakeTime,
          sleepTime: profile.sleepTime,
          workStart: profile.workStart,
          workEnd: profile.workEnd,
          focusMins: profile.focusMins,
          ritualsEnabled: profile.ritualsEnabled,
        },
        today,
        todayShift
      )
    : [];

  // Rows written before blocks were validated can still hold a malformed entry.
  // The UI does arithmetic on every start/end, so clean the plan on the way out
  // rather than trusting what is already stored.
  const safePlan = plan ? { ...plan, blocks: sanitisePlanBlocks(plan.blocks) } : plan;

  return NextResponse.json({
    today,
    now: nowStr,
    weekStart,
    profile,
    plan: safePlan,
    tasks,
    doneToday,
    drafts,
    meals,
    workouts,
    habits,
    habitLogs,
    grocery,
    focus: focus && !focus.endedAt ? focus : null,
    lastFocus: focus,
    checkins,
    weekPlans,
    momentum,
    timeDebt,
    todayShift,
    rituals,
    ritualLogs,
    currentRitual: rituals.length ? currentRitual(rituals, nowMins) : null,
    recentNudges,
    snoozes,
    // Offered, not forced: the UI only shows the rescue button when the plan has
    // demonstrably stopped matching reality.
    planStale: planIsStale(safePlan?.blocks, nowMins),
    staleAfterMins: STALE_AFTER_MINS,
  });
}
