import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile, DEFAULT_TZ } from "@/lib/navigator/context";
import { dayFromKey, todayKey, nowTime, weekStartKey, addDaysKey } from "@/lib/navigator/dates";

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
      prisma.navTask.findMany({
        where: { userId, status: { not: "done" } },
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

  const doneToday = await prisma.navTask.findMany({
    where: { userId, status: "done", completedAt: { gte: new Date(`${today}T00:00:00.000Z`) } },
    orderBy: { completedAt: "desc" },
    take: 20,
  });

  return NextResponse.json({
    today,
    now: nowTime(tz),
    weekStart,
    profile,
    plan,
    tasks,
    doneToday,
    meals,
    workouts,
    habits,
    habitLogs,
    grocery,
    focus: focus && !focus.endedAt ? focus : null,
    lastFocus: focus,
    checkins,
    weekPlans,
  });
}
