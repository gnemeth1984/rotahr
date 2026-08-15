/**
 * Nudge decision engine.
 *
 * Deliberately pure: no Prisma, no clock, no env. Everything it needs is passed
 * in, so the awkward cases (mid-shift, quiet hours, day off, already-sent) are
 * testable without a database. The cron route does the IO; this decides.
 *
 * Design rule that matters most here: a reminder that arrives at a moment the
 * user cannot act on it is worse than no reminder, because it teaches them to
 * ignore the channel. So every nudge is gated on "could he actually do this
 * right now?" — not just "is it time?".
 */

export type NudgeKind =
  | "block"
  | "due_today"
  | "overdue"
  | "errand"
  | "stuck"
  | "idle"
  | "evening";

export type Nudge = {
  kind: NudgeKind;
  refKey: string;
  title: string;
  body: string;
  link: string;
};

export type NudgeBlock = {
  start: string;
  end: string;
  label: string;
  kind: string;
  taskId?: string;
};

export type NudgeTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  effortMins: number | null;
  startTrigger: string | null;
  dueDate: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type NudgePrefs = {
  notifyEnabled: boolean;
  notifyLeadMins: number;
  notifyBlocks: boolean;
  notifyDueToday: boolean;
  notifyOverdue: boolean;
  notifyErrands: boolean;
  notifyStuck: boolean;
  notifyIdle: boolean;
  notifyEvening: boolean;
  notifyDuringShift: boolean;
  quietStart: string;
  quietEnd: string;
  wakeTime: string;
};

export type NudgeCtx = {
  /** The instant this run happens. Passed in so the module stays deterministic. */
  now: Date;
  /** Minutes since local midnight, in the user's timezone. */
  nowMins: number;
  /** YYYY-MM-DD in the user's timezone. */
  dateKey: string;
  prefs: NudgePrefs;
  /** Today's shift, or null when it's a day off. */
  shift: { start: string; end: string; note?: string } | null;
  /** True when the week pattern explicitly marks today as off. */
  isDayOff: boolean;
  planExists: boolean;
  blocks: NudgeBlock[];
  hasReflection: boolean;
  tasks: NudgeTask[];
  /** Nudges already sent today, for dedup and per-day caps. */
  sentToday: { kind: string; refKey: string; sentAt: Date }[];
  /** Minutes-since-midnight of the most recent nudge today, if any. */
  lastSentMins: number | null;
};

export const toMins = (t: string): number => {
  const [h, m] = String(t).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

const LINK = "/navigator";

/** Caps per day, per kind. Block nudges are uncapped on purpose — they're the structure. */
const DAILY_CAP: Partial<Record<NudgeKind, number>> = {
  overdue: 2,
  errand: 2,
  stuck: 1,
  idle: 2,
};

/** True when `mins` falls in the quiet window, which normally wraps midnight. */
export function inQuietHours(mins: number, quietStart: string, quietEnd: string): boolean {
  const s = toMins(quietStart);
  const e = toMins(quietEnd);
  if (s === e) return false;
  if (s < e) return mins >= s && mins < e;
  return mins >= s || mins < e;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Small, low-stakes, easily-forgotten: the passport-paperwork class of task. */
function isErrand(t: NudgeTask): boolean {
  if (t.status !== "todo") return false;
  // A due date means it already has a deadline driving it. Errands are the
  // things with nothing at all pulling them forward.
  if (t.dueDate) return false;
  const small = t.effortMins != null && t.effortMins <= 30;
  const lowStakes = t.priority === "quickwin" || t.priority === "later";
  return small || lowStakes;
}

export function decideNudges(ctx: NudgeCtx): Nudge[] {
  const { prefs, nowMins, tasks, blocks, shift } = ctx;
  if (!prefs.notifyEnabled) return [];

  // Asleep, or meant to be. Nothing is urgent enough.
  if (inQuietHours(nowMins, prefs.quietStart, prefs.quietEnd)) return [];

  const shiftStart = shift ? toMins(shift.start) : null;
  const shiftEnd = shift ? toMins(shift.end) : null;
  const onShiftNow =
    shiftStart != null && shiftEnd != null && nowMins >= shiftStart && nowMins < shiftEnd;

  // On shift: he's at work, the phone stays in the pocket.
  if (onShiftNow && !prefs.notifyDuringShift) return [];

  const sentKey = new Set(ctx.sentToday.map((s) => `${s.kind}::${s.refKey}`));
  const countOf = (kind: NudgeKind) => ctx.sentToday.filter((s) => s.kind === kind).length;
  const already = (kind: NudgeKind, refKey: string) => sentKey.has(`${kind}::${refKey}`);
  const capped = (kind: NudgeKind) => {
    const cap = DAILY_CAP[kind];
    return cap != null && countOf(kind) >= cap;
  };

  const out: Nudge[] = [];
  const push = (n: Nudge) => {
    if (!already(n.kind, n.refKey) && !capped(n.kind)) out.push(n);
  };

  // ── 1. Block starting ────────────────────────────────────────────────────
  // The core structure nudge: "this is what you're doing next, starting now".
  if (prefs.notifyBlocks && ctx.planExists) {
    const lead = Math.max(0, prefs.notifyLeadMins);
    for (const b of blocks) {
      const bs = toMins(b.start);
      const delta = bs - nowMins;
      if (delta < 0 || delta > lead) continue;

      // Don't buzz for anything that begins inside the shift — he can't act on it.
      const insideShift =
        shiftStart != null && shiftEnd != null && bs > shiftStart && bs < shiftEnd;
      if (insideShift && !prefs.notifyDuringShift) continue;

      const when = delta === 0 ? "now" : `in ${delta} min`;
      const isWork = b.kind === "work";
      const title = isWork
        ? `Shift starts ${when}`
        : `${b.label} — ${when}`;
      const body = isWork
        ? `${b.start}–${b.end}${shift?.note ? `. ${shift.note}` : ""}`
        : `${b.start}–${b.end} · ${b.kind}. Start it before you look at anything else.`;
      push({ kind: "block", refKey: `${b.start}-${b.label}`.slice(0, 120), title, body, link: LINK });
    }
  }

  // ── 2. Due today (one morning summary) ───────────────────────────────────
  if (prefs.notifyDueToday) {
    const wake = toMins(prefs.wakeTime);
    const quietEnd = toMins(prefs.quietEnd);
    const openAt = Math.max(wake, quietEnd) + 30;
    if (nowMins >= openAt) {
      const due = tasks.filter(
        (t) => t.status !== "done" && t.dueDate && dayKey(t.dueDate) === ctx.dateKey
      );
      if (due.length) {
        const names = due.slice(0, 3).map((t) => t.title);
        push({
          kind: "due_today",
          refKey: ctx.dateKey,
          title: `${due.length} thing${due.length > 1 ? "s" : ""} due today`,
          body: names.join(" · ") + (due.length > 3 ? ` · +${due.length - 3} more` : ""),
          link: LINK,
        });
      }
    }
  }

  // ── 3. Overdue ───────────────────────────────────────────────────────────
  if (prefs.notifyOverdue) {
    const overdue = tasks
      .filter((t) => t.status !== "done" && t.dueDate && dayKey(t.dueDate) < ctx.dateKey)
      .sort((a, b) => (a.dueDate!.getTime() - b.dueDate!.getTime()));
    for (const t of overdue.slice(0, 2)) {
      const days = Math.max(
        1,
        Math.round((Date.parse(`${ctx.dateKey}T00:00:00Z`) - t.dueDate!.getTime()) / 86400000)
      );
      push({
        kind: "overdue",
        refKey: t.id,
        title: `${days}d overdue: ${t.title}`,
        body: t.startTrigger
          ? `Start here: ${t.startTrigger}`
          : "Either do it now, park it, or bin it. Leaving it costs more.",
        link: LINK,
      });
    }
  }

  // Is he mid-block right now? Errand/idle nudges must not interrupt.
  const activeBlock = blocks.find((b) => nowMins >= toMins(b.start) && nowMins < toMins(b.end));
  const nextBlockStart = blocks
    .map((b) => toMins(b.start))
    .filter((s) => s > nowMins)
    .sort((a, b) => a - b)[0];
  const gapMins = nextBlockStart != null ? nextBlockStart - nowMins : 24 * 60 - nowMins;
  const isFree = !activeBlock && gapMins >= 20;

  // ── 4. Errands — the small stuff that quietly rots ───────────────────────
  // This is the one that matters: passport paperwork, checking a delivery,
  // ordering shoes. No deadline, no drama, so it never wins attention on its
  // own. Surface exactly ONE, oldest first, only in real free time.
  if (prefs.notifyErrands && isFree) {
    const lastErrand = ctx.sentToday
      .filter((s) => s.kind === "errand")
      .map((s) => s.sentAt.getTime())
      .sort((a, b) => b - a)[0];
    const hoursSince = lastErrand ? (ctx.now.getTime() - lastErrand) / 3600000 : 99;

    if (hoursSince >= 3) {
      const stale = tasks
        .filter(isErrand)
        .filter((t) => (ctx.now.getTime() - t.createdAt.getTime()) / 86400000 >= 1)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const pick = stale.find((t) => !already("errand", t.id));
      if (pick) {
        const age = Math.max(
          1,
          Math.round((ctx.now.getTime() - pick.createdAt.getTime()) / 86400000)
        );
        const mins = pick.effortMins ?? 15;
        push({
          kind: "errand",
          refKey: pick.id,
          title: `Free ${gapMins >= 60 ? "hour" : `${gapMins} min`} — ${pick.title}`,
          body: pick.startTrigger
            ? `${age}d old, ~${mins} min. Start: ${pick.startTrigger}`
            : `Sitting for ${age} days, ~${mins} min. Do it now and it's gone.`,
          link: LINK,
        });
      }
    }
  }

  // ── 5. Stuck in "doing" ──────────────────────────────────────────────────
  if (prefs.notifyStuck) {
    const stuck = tasks
      .filter((t) => t.status === "doing")
      .filter((t) => (ctx.now.getTime() - t.updatedAt.getTime()) / 86400000 >= 2)
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())[0];
    if (stuck) {
      const days = Math.max(2, Math.round((ctx.now.getTime() - stuck.updatedAt.getTime()) / 86400000));
      push({
        kind: "stuck",
        refKey: stuck.id,
        title: `Still open ${days}d: ${stuck.title}`,
        body: "Started but not moving. Break it into one 15-min step, or park it honestly.",
        link: LINK,
      });
    }
  }

  // ── 6. Idle in free time ─────────────────────────────────────────────────
  if (prefs.notifyIdle && isFree && !ctx.planExists) {
    const quiet = ctx.lastSentMins == null || nowMins - ctx.lastSentMins >= 60;
    if (quiet) {
      const bucket = `h${Math.floor(nowMins / 120)}`;
      push({
        kind: "idle",
        refKey: bucket,
        title: "No plan for today yet",
        body: "Two taps: open Navigator, set your energy, get the day laid out.",
        link: LINK,
      });
    }
  }

  // ── 7. Close the day ─────────────────────────────────────────────────────
  if (prefs.notifyEvening && ctx.planExists && !ctx.hasReflection) {
    const quietStart = toMins(prefs.quietStart);
    if (nowMins >= quietStart - 45 && nowMins < quietStart) {
      push({
        kind: "evening",
        refKey: ctx.dateKey,
        title: "Close the day",
        body: "What went well, where it stalled, rate it out of 5. Two minutes.",
        link: LINK,
      });
    }
  }

  // Even in chatty mode, never fire a burst — 2 per run maximum, structure first.
  const priority: NudgeKind[] = ["block", "due_today", "errand", "overdue", "stuck", "evening", "idle"];
  return out
    .sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))
    .slice(0, 2);
}
