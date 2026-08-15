import { prisma } from "@/lib/db";
import { dayFromKey, addDaysKey } from "./dates";

/**
 * 1.3 Momentum score.
 *
 * A single 0-100 number answering "am I actually moving, or just planning?".
 * Deliberately read-only — it derives entirely from rows that already exist, so
 * there is nothing to keep in sync and nothing that can rot.
 *
 * Design rules that matter for an ADHD user:
 * - It measures the LAST 7 DAYS, not today. One bad day must not tank it, or the
 *   number becomes another thing to feel guilty about.
 * - Every component saturates. Doing 40 tasks does not score higher than doing
 *   12, so it can never turn into a treadmill that rewards overwork.
 * - Nothing here is ever negative. The worst possible score is 0, not a debt.
 * - "Started" counts, not just "finished" — initiation is the actual hard part.
 */

const WINDOW_DAYS = 7;

// Each component contributes at most this many points. Sums to 100.
const WEIGHTS = {
  tasksDone: 30,
  focusMins: 25,
  habits: 20,
  reflection: 10,
  starts: 15,
} as const;

// The level at which a component is considered "full marks" for a week.
const TARGETS = {
  tasksDone: 12, // ~2/day
  focusMins: 300, // 5 hours of real focus
  reflection: 4, // days closed out with a reflection
  starts: 7, // focus sessions or tasks moved to doing
} as const;

/** Fraction of a target, hard-clamped to 0..1 so nothing can over-contribute. */
function ratio(value: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, value / target));
}

export type MomentumBand = "stalled" | "warming" | "moving" | "flying";

function band(score: number): MomentumBand {
  if (score >= 75) return "flying";
  if (score >= 45) return "moving";
  if (score >= 20) return "warming";
  return "stalled";
}

export type Momentum = {
  score: number;
  band: MomentumBand;
  /** Change vs the previous 7 days, in points. Positive = speeding up. */
  delta: number;
  /** One short honest line. No cheerleading. */
  summary: string;
  parts: {
    label: string;
    /** Points earned out of that component's max. */
    points: number;
    max: number;
    detail: string;
  }[];
};

type Window = {
  tasksDone: number;
  focusMins: number;
  habitHits: number;
  habitTarget: number;
  reflections: number;
  starts: number;
};

async function collect(userId: string, fromKey: string, toKeyExclusive: string): Promise<Window> {
  const from = dayFromKey(fromKey);
  const to = dayFromKey(toKeyExclusive);
  // Task/focus timestamps are full DateTimes, so compare against the same
  // midnight boundaries the date-keyed rows use.
  const fromTs = new Date(`${fromKey}T00:00:00.000Z`);
  const toTs = new Date(`${toKeyExclusive}T00:00:00.000Z`);

  const [done, sessions, habits, habitLogs, plans, started] = await Promise.all([
    prisma.navTask.count({
      where: { userId, status: "done", completedAt: { gte: fromTs, lt: toTs } },
    }),
    prisma.navFocusSession.findMany({
      where: { userId, startedAt: { gte: fromTs, lt: toTs } },
      select: { actualMins: true, plannedMins: true, endedAt: true },
    }),
    prisma.navHabit.findMany({ where: { userId, active: true }, select: { targetPerWk: true } }),
    prisma.navHabitLog.count({ where: { userId, done: true, date: { gte: from, lt: to } } }),
    prisma.navDayPlan.count({
      where: { userId, date: { gte: from, lt: to }, reflection: { not: null } },
    }),
    prisma.navTask.count({
      where: { userId, status: "doing", updatedAt: { gte: fromTs, lt: toTs } },
    }),
  ]);

  // Only count time actually spent. An abandoned session with no actualMins
  // contributes nothing, otherwise starting-and-bailing would inflate the score.
  const focusMins = sessions.reduce((sum, s) => sum + (s.actualMins ?? 0), 0);

  return {
    tasksDone: done,
    focusMins,
    habitHits: habitLogs,
    habitTarget: habits.reduce((sum, h) => sum + h.targetPerWk, 0),
    reflections: plans,
    starts: sessions.length + started,
  };
}

function scoreOf(w: Window): number {
  const habitRatio = w.habitTarget > 0 ? ratio(w.habitHits, w.habitTarget) : 0;
  const raw =
    ratio(w.tasksDone, TARGETS.tasksDone) * WEIGHTS.tasksDone +
    ratio(w.focusMins, TARGETS.focusMins) * WEIGHTS.focusMins +
    habitRatio * WEIGHTS.habits +
    ratio(w.reflections, TARGETS.reflection) * WEIGHTS.reflection +
    ratio(w.starts, TARGETS.starts) * WEIGHTS.starts;
  return Math.round(raw);
}

const SUMMARY: Record<MomentumBand, string> = {
  stalled: "Not much moved this week. Pick one small thing and start it.",
  warming: "Some movement. The gap is consistency, not effort.",
  moving: "Solid week. This is what a normal good week looks like.",
  flying: "Strong week across the board. Protect whatever you changed.",
};

export async function momentumFor(userId: string, todayKeyStr: string): Promise<Momentum> {
  // Current window is the last 7 days INCLUDING today; previous is the 7 before it.
  const curFrom = addDaysKey(todayKeyStr, -(WINDOW_DAYS - 1));
  const curTo = addDaysKey(todayKeyStr, 1);
  const prevFrom = addDaysKey(curFrom, -WINDOW_DAYS);

  const [cur, prev] = await Promise.all([
    collect(userId, curFrom, curTo),
    collect(userId, prevFrom, curFrom),
  ]);

  const score = scoreOf(cur);
  const prevScore = scoreOf(prev);
  const habitRatio = cur.habitTarget > 0 ? ratio(cur.habitHits, cur.habitTarget) : 0;

  return {
    score,
    band: band(score),
    delta: score - prevScore,
    summary: SUMMARY[band(score)],
    parts: [
      {
        label: "Tasks finished",
        points: Math.round(ratio(cur.tasksDone, TARGETS.tasksDone) * WEIGHTS.tasksDone),
        max: WEIGHTS.tasksDone,
        detail: `${cur.tasksDone} in 7 days`,
      },
      {
        label: "Focus time",
        points: Math.round(ratio(cur.focusMins, TARGETS.focusMins) * WEIGHTS.focusMins),
        max: WEIGHTS.focusMins,
        detail: `${Math.round(cur.focusMins / 60)}h ${cur.focusMins % 60}m logged`,
      },
      {
        label: "Habits",
        points: Math.round(habitRatio * WEIGHTS.habits),
        max: WEIGHTS.habits,
        detail: cur.habitTarget ? `${cur.habitHits}/${cur.habitTarget} hits` : "none set up",
      },
      {
        label: "Things started",
        points: Math.round(ratio(cur.starts, TARGETS.starts) * WEIGHTS.starts),
        max: WEIGHTS.starts,
        detail: `${cur.starts} starts`,
      },
      {
        label: "Days closed out",
        points: Math.round(ratio(cur.reflections, TARGETS.reflection) * WEIGHTS.reflection),
        max: WEIGHTS.reflection,
        detail: `${cur.reflections} reflections`,
      },
    ],
  };
}
