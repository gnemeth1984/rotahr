import { prisma } from "@/lib/db";
import {
  dayFromKey,
  todayKey,
  nowTime,
  addDaysKey,
  weekStartKey,
  weekdayKey,
  WEEKDAY_KEYS,
  type WeekdayKey,
} from "./dates";

export const DEFAULT_TZ = "Europe/Dublin";

export type DayWindow = { start: string; end: string; note?: string } | null;
export type WeekPattern = Partial<Record<WeekdayKey, DayWindow>>;

const DAY_LABEL: Record<WeekdayKey, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function asWeekPattern(raw: unknown): WeekPattern | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: WeekPattern = {};
  let any = false;
  for (const d of WEEKDAY_KEYS) {
    const v = (raw as Record<string, unknown>)[d];
    if (v === null) {
      out[d] = null;
      any = true;
      continue;
    }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.start === "string" && typeof o.end === "string") {
        out[d] = {
          start: o.start,
          end: o.end,
          ...(typeof o.note === "string" && o.note ? { note: o.note } : {}),
        };
        any = true;
      }
    }
  }
  return any ? out : null;
}

/**
 * The work window that actually applies on a given date. Falls back to the flat
 * workStart/workEnd when no per-weekday pattern is set. `null` means a day off —
 * which is not the same as "no data", and the planner must treat it differently.
 */
export function windowForDate(
  profile: { workStart: string; workEnd: string; weekPattern?: unknown },
  dateKey: string
): { window: DayWindow; source: "pattern" | "fallback" } {
  const pattern = asWeekPattern(profile.weekPattern);
  if (!pattern) return { window: { start: profile.workStart, end: profile.workEnd }, source: "fallback" };
  const d = weekdayKey(dateKey);
  if (!(d in pattern)) return { window: { start: profile.workStart, end: profile.workEnd }, source: "fallback" };
  return { window: pattern[d] ?? null, source: "pattern" };
}

/** One-line human summary of the week shape, for the AI context. */
export function renderWeekPattern(profile: { workStart: string; workEnd: string; weekPattern?: unknown }): string | null {
  const pattern = asWeekPattern(profile.weekPattern);
  if (!pattern) return null;
  return WEEKDAY_KEYS.map((d) => {
    if (!(d in pattern)) return `${DAY_LABEL[d]} ${profile.workStart}-${profile.workEnd}`;
    const w = pattern[d];
    if (!w) return `${DAY_LABEL[d]} off`;
    return `${DAY_LABEL[d]} ${w.start}-${w.end}${w.note ? ` (${w.note})` : ""}`;
  }).join(", ");
}

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
export function renderSnapshot(s: Snapshot, forDate?: string): string {
  const p = s.profile;
  const target = forDate && forDate !== s.today ? forDate : s.today;
  const isToday = target === s.today;
  const dayWord = isToday ? "TODAY" : `The day being planned (${target})`;
  const { window: todayWindow, source } = windowForDate(p, target);
  const weekShape = renderWeekPattern(p);

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
    `Wakes ${p.wakeTime}, sleeps ${p.sleepTime}. Preferred focus block ${p.focusMins}min / ${p.breakMins}min break.`,
    todayWindow
      ? `${dayWord} is a work day: shift ${todayWindow.start}–${todayWindow.end}${
          todayWindow.note ? ` (${todayWindow.note})` : ""
        }. Those exact times are fixed. Do NOT schedule anything inside that shift — plan around it.`
      : source === "pattern"
        ? `${dayWord} is a day OFF work. There is NO shift at all — do not place a work block anywhere. Free time is the whole day, but it is rest/family/project time, not a working day.`
        : `Work window ${p.workStart}–${p.workEnd} (no weekly pattern set).`,
    weekShape ? `Weekly shape: ${weekShape}` : null,
    p.energyPattern ? `Energy pattern: ${p.energyPattern}` : null,
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
