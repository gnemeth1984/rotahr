import { prisma } from "@/lib/db";
import { dayFromKey, addDaysKey } from "./dates";

/**
 * 4.1 Time Debt.
 *
 * One number: "you're carrying 2.5 hours of time debt". The point is NOT to
 * shame. The point is that ADHD time-blindness makes an overdue pile feel
 * infinite — a vague dread with no size. Naming the size is what makes it
 * finishable, because 2.5 hours is a Saturday morning and "everything I've ever
 * postponed" is not.
 *
 * Design rules:
 * - Read-only. Derives from existing rows, same as momentum. Nothing to sync.
 * - It counts MINUTES OF WORK OWED, not sins. Ignored nudges and skipped blocks
 *   are converted to the actual time they represent, so the number stays a
 *   quantity of work rather than a behaviour score.
 * - Capped. Debt above the cap reads "12h+" instead of climbing forever, because
 *   an uncapped number just becomes another reason to give up.
 * - Two components from the original spec are deliberately absent: sleep deficit
 *   (we don't collect sleep data, and estimating it from wakeTime would be
 *   fiction) and meal delays (NavMeal has no planned time to be late against).
 *   A made-up component would make the whole number untrustworthy.
 */

/** How far back overdue work still counts. Older than this is not debt, it's a decision. */
const LOOKBACK_DAYS = 21;

/** Assumed length of an overdue task with no estimate. Conservative on purpose. */
const ASSUMED_TASK_MINS = 25;

/** What one skipped block costs: its own planned length, capped so a 4h block doesn't dominate. */
const MAX_BLOCK_MINS = 90;

/** What one ignored nudge costs. It's a proxy for "a small thing didn't happen". */
const IGNORED_NUDGE_MINS = 10;

/** Above this, the display stops counting. */
const CAP_MINS = 12 * 60;

export type TimeDebtPart = {
  label: string;
  mins: number;
  detail: string;
};

export type TimeDebtBand = "clear" | "light" | "heavy" | "buried";

export type TimeDebt = {
  /** Total minutes owed, uncapped. */
  mins: number;
  /** Display string, e.g. "2.5 hours" or "12h+". */
  label: string;
  band: TimeDebtBand;
  /** One line telling him what to actually do about it. */
  advice: string;
  parts: TimeDebtPart[];
  /** The single best thing to clear first, if there is one. */
  firstMove: { taskId: string; title: string; mins: number; startTrigger: string | null } | null;
};

function band(mins: number): TimeDebtBand {
  if (mins < 30) return "clear";
  if (mins < 180) return "light";
  if (mins < 420) return "heavy";
  return "buried";
}

const ADVICE: Record<TimeDebtBand, string> = {
  clear: "Nothing meaningful owed. Don't invent work to fill it.",
  light: "One focused session clears this. Book it before it compounds.",
  heavy: "This needs a deliberate half-day, not more evenings of good intentions.",
  buried: "Too big to work through. Bin or park half of it first — that IS the fix.",
};

function humanHours(mins: number): string {
  if (mins >= CAP_MINS) return `${Math.floor(CAP_MINS / 60)}h+`;
  if (mins < 60) return `${mins} min`;
  const h = mins / 60;
  // One decimal reads as a real quantity ("2.5 hours"); rounding to 3 reads as a guess.
  return `${(Math.round(h * 2) / 2).toFixed(1).replace(/\.0$/, "")} hours`;
}

export async function timeDebtFor(userId: string, todayKeyStr: string): Promise<TimeDebt> {
  const todayDate = dayFromKey(todayKeyStr);
  const fromKey = addDaysKey(todayKeyStr, -LOOKBACK_DAYS);
  const fromDate = dayFromKey(fromKey);
  const fromTs = new Date(`${fromKey}T00:00:00.000Z`);

  const [overdue, pushed, plans, nudges, focusToday] = await Promise.all([
    // 1. Work with a deadline that has passed.
    prisma.navTask.findMany({
      where: {
        userId,
        status: { in: ["todo", "doing"] },
        archivedAt: null,
        dueDate: { lt: todayDate, gte: fromDate },
      },
      select: { id: true, title: true, effortMins: true, startTrigger: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    // 2. Work he scheduled for a past day and never did. A self-set date he blew
    //    past is still owed time, even with no external deadline.
    prisma.navTask.findMany({
      where: {
        userId,
        status: { in: ["todo", "doing"] },
        archivedAt: null,
        dueDate: null,
        scheduledFor: { lt: todayDate, gte: fromDate },
      },
      select: { id: true, title: true, effortMins: true, startTrigger: true },
    }),
    // 3. Blocks that came and went untouched.
    prisma.navDayPlan.findMany({
      where: { userId, date: { gte: fromDate, lte: todayDate } },
      select: { date: true, blocks: true },
    }),
    // 4. Nudges sent with nothing following them.
    prisma.navNudge.findMany({
      where: { userId, sentAt: { gte: fromTs } },
      select: { kind: true, refKey: true, sentAt: true },
    }),
    prisma.navFocusSession.findMany({
      where: { userId, startedAt: { gte: fromTs } },
      select: { startedAt: true },
    }),
  ]);

  // --- overdue + pushed ----------------------------------------------------
  const overdueMins = overdue.reduce((n, t) => n + (t.effortMins ?? ASSUMED_TASK_MINS), 0);
  const pushedMins = pushed.reduce((n, t) => n + (t.effortMins ?? ASSUMED_TASK_MINS), 0);

  // --- skipped blocks ------------------------------------------------------
  // A block counts as skipped only when it's fully in the past, isn't the shift,
  // and was never ticked done. Today's not-yet-reached blocks are not debt.
  const toMins = (t: unknown) => {
    const [h, m] = String(t ?? "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  let skippedMins = 0;
  let skippedCount = 0;
  for (const p of plans) {
    const isToday = p.date.toISOString().slice(0, 10) === todayKeyStr;
    const blocks = Array.isArray(p.blocks) ? (p.blocks as Record<string, unknown>[]) : [];
    for (const b of blocks) {
      if (b?.kind === "work" || b?.done === true) continue;
      // Only whole past days are judged. Judging today mid-afternoon would count
      // blocks he is still perfectly capable of doing.
      if (isToday) continue;
      const s = toMins(b?.start);
      const e = toMins(b?.end);
      if (s == null || e == null || e <= s) continue;
      skippedMins += Math.min(MAX_BLOCK_MINS, e - s);
      skippedCount++;
    }
  }

  // --- ignored nudges ------------------------------------------------------
  // "Ignored" = nothing was started within the hour after it landed. Imperfect,
  // but it uses only data we already have and it errs toward forgiving.
  const focusTimes = focusToday.map((f) => f.startedAt.getTime()).sort((a, b) => a - b);
  const actedAfter = (t: number) => focusTimes.some((f) => f >= t && f - t <= 60 * 60 * 1000);
  const ignored = nudges.filter(
    (n) => n.kind !== "block" && n.kind !== "evening" && !actedAfter(n.sentAt.getTime())
  );
  const ignoredMins = ignored.length * IGNORED_NUDGE_MINS;

  const mins = overdueMins + pushedMins + skippedMins + ignoredMins;

  // The first move is the smallest overdue thing, not the most important one.
  // Clearing debt is about restarting the engine; picking the biggest item is
  // how people stall out for another three weeks.
  const candidates = [...overdue, ...pushed].sort(
    (a, b) => (a.effortMins ?? ASSUMED_TASK_MINS) - (b.effortMins ?? ASSUMED_TASK_MINS)
  );
  const first = candidates[0] ?? null;

  return {
    mins,
    label: humanHours(mins),
    band: band(mins),
    advice: ADVICE[band(mins)],
    parts: [
      {
        label: "Past due",
        mins: overdueMins,
        detail: overdue.length ? `${overdue.length} task${overdue.length === 1 ? "" : "s"}` : "none",
      },
      {
        label: "Pushed off",
        mins: pushedMins,
        detail: pushed.length
          ? `${pushed.length} scheduled and skipped`
          : "none",
      },
      {
        label: "Blocks missed",
        mins: skippedMins,
        detail: skippedCount ? `${skippedCount} in ${LOOKBACK_DAYS} days` : "none",
      },
      {
        label: "Nudges ignored",
        mins: ignoredMins,
        detail: ignored.length ? `${ignored.length} went unanswered` : "none",
      },
    ],
    firstMove: first
      ? {
          taskId: first.id,
          title: first.title,
          mins: first.effortMins ?? ASSUMED_TASK_MINS,
          startTrigger: first.startTrigger ?? null,
        }
      : null,
  };
}
