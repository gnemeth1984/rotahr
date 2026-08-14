import { prisma } from "@/lib/db";
import { dayFromKey, todayKey, nowTime, addDaysKey, weekStartKey } from "./dates";

export const DEFAULT_TZ = "Europe/Dublin";

export async function getOrCreateProfile(userId: string) {
  const existing = await prisma.navProfile.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.navProfile.create({ data: { userId } });
}

/**
 * One compact snapshot of the user's current state, used as system context for
 * every AI call. Kept terse on purpose — a long context makes the model waffle,
 * and waffle is the enemy here.
 */
export async function buildSnapshot(userId: string) {
  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const today = todayKey(tz);
  const weekStart = weekStartKey(today);

  const [plan, tasks, meals, workouts, habits, habitLogs, checkins, lastFocus, openGrocery, recentDays] =
    await Promise.all([
      prisma.navDayPlan.findUnique({ where: { userId_date: { userId, date: dayFromKey(today) } } }),
      prisma.navTask.findMany({
        where: { userId, status: { in: ["todo", "doing"] } },
        orderBy: [{ status: "asc" }, { order: "asc" }, { createdAt: "asc" }],
        take: 60,
      }),
      prisma.navMeal.findMany({ where: { userId, date: dayFromKey(today) }, orderBy: { slot: "asc" } }),
      prisma.navWorkout.findMany({ where: { userId, date: dayFromKey(today) } }),
      prisma.navHabit.findMany({ where: { userId, active: true }, orderBy: { order: "asc" } }),
      prisma.navHabitLog.findMany({
        where: { userId, date: { gte: dayFromKey(weekStart) }, done: true },
      }),
      prisma.navCheckin.findMany({
        where: { userId, at: { gte: new Date(Date.now() - 1000 * 60 * 60 * 72) } },
        orderBy: { at: "desc" },
        take: 20,
      }),
      prisma.navFocusSession.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } }),
      prisma.navGroceryItem.count({ where: { userId, checked: false } }),
      prisma.navDayPlan.findMany({
        where: { userId, date: { gte: dayFromKey(addDaysKey(today, -7)), lt: dayFromKey(today) } },
        orderBy: { date: "desc" },
        take: 7,
      }),
    ]);

  return {
    profile,
    tz,
    today,
    now: nowTime(tz),
    plan,
    tasks,
    meals,
    workouts,
    habits,
    habitLogs,
    checkins,
    lastFocus,
    openGrocery,
    recentDays,
  };
}

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

function bullets(lines: (string | null | undefined)[]) {
  return lines.filter(Boolean).join("\n");
}

/** Turns the snapshot into the text block the model actually reads. */
export function renderSnapshot(s: Snapshot): string {
  const p = s.profile;

  const taskLines = s.tasks.slice(0, 25).map((t) => {
    const bits = [
      `- [${t.id}] ${t.title}`,
      t.status === "doing" ? "(IN PROGRESS)" : "",
      `prio=${t.priority}`,
      t.effortMins ? `~${t.effortMins}min` : "",
      t.project ? `project=${t.project}` : "",
      t.parentId ? "(micro-step)" : "",
      t.dueDate ? `due=${t.dueDate.toISOString().slice(0, 10)}` : "",
    ];
    return bits.filter(Boolean).join(" ");
  });

  const habitLines = s.habits.map((h) => {
    const hits = s.habitLogs.filter((l) => l.habitId === h.id).length;
    return `- [${h.id}] ${h.name} — ${hits}/${h.targetPerWk} this week`;
  });

  const checkinLines = s.checkins
    .slice(0, 8)
    .map((c) => `- ${c.kind}=${c.value}/5 at ${c.at.toISOString().slice(11, 16)}${c.note ? ` (${c.note})` : ""}`);

  const dayLines = s.recentDays.map(
    (d) =>
      `- ${d.date.toISOString().slice(0, 10)}: energy=${d.energy ?? "?"} score=${d.scoreOutOf5 ?? "?"}${
        d.friction ? ` friction: ${d.friction.slice(0, 80)}` : ""
      }`
  );

  return bullets([
    `## Right now`,
    `Local time ${s.now} (${s.tz}), date ${s.today}.`,
    `Wakes ${p.wakeTime}, sleeps ${p.sleepTime}. Work window ${p.workStart}–${p.workEnd}. Preferred focus block ${p.focusMins}min / ${p.breakMins}min break.`,
    p.goals ? `Goals: ${p.goals}` : null,
    p.derailers ? `Known derailers: ${p.derailers}` : null,
    p.dietary ? `Food notes: ${p.dietary}` : null,
    p.kitchen ? `Kitchen/prep reality: ${p.kitchen}` : null,
    p.exercise ? `Exercise notes: ${p.exercise}` : null,
    ``,
    `## Today's plan`,
    s.plan
      ? bullets([
          s.plan.focusTheme ? `Theme: ${s.plan.focusTheme}` : null,
          s.plan.anchor ? `Anchor (the one thing): ${s.plan.anchor}` : null,
          s.plan.energy ? `Energy reported: ${s.plan.energy}/5` : null,
          Array.isArray(s.plan.blocks) && s.plan.blocks.length
            ? (s.plan.blocks as any[])
                .map((b) => `- ${b.start}–${b.end} ${b.label}${b.kind ? ` [${b.kind}]` : ""}`)
                .join("\n")
            : "- (no blocks yet)",
          s.plan.reflection ? `Reflection already written: ${s.plan.reflection}` : null,
        ])
      : "No plan generated for today yet.",
    ``,
    `## Open tasks (${s.tasks.length})`,
    taskLines.length ? taskLines.join("\n") : "- none",
    ``,
    `## Food today`,
    s.meals.length
      ? s.meals.map((m) => `- ${m.slot}: ${m.title} (${m.prepMins}min)${m.eaten ? " [eaten]" : ""}`).join("\n")
      : "- nothing planned",
    `Unchecked grocery items: ${s.openGrocery}`,
    ``,
    `## Movement today`,
    s.workouts.length
      ? s.workouts.map((w) => `- ${w.title} ${w.durationMins}min ${w.intensity}${w.completed ? " [done]" : ""}`).join("\n")
      : "- nothing planned",
    ``,
    `## Habits this week`,
    habitLines.length ? habitLines.join("\n") : "- none set up",
    ``,
    `## Recent check-ins`,
    checkinLines.length ? checkinLines.join("\n") : "- none",
    ``,
    `## Last 7 days`,
    dayLines.length ? dayLines.join("\n") : "- no history",
    s.lastFocus && !s.lastFocus.endedAt
      ? `\n## LIVE: a focus session "${s.lastFocus.label}" (${s.lastFocus.plannedMins}min) is running since ${s.lastFocus.startedAt.toISOString().slice(11, 16)}.`
      : null,
  ]);
}
