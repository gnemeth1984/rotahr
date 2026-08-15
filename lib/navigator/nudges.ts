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
  /** How long before a shift discretionary nudges go quiet (4.3). 0 disables it. */
  preShiftQuietMins: number;
  /** How long after a shift ends discretionary nudges stay quiet (4.3). */
  postShiftQuietMins: number;
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
  /**
   * Most recent energy check-in, when it's recent enough to still be true.
   * Null means "no idea", which is treated as normal energy rather than low --
   * assuming someone is depleted when they haven't said so would water down
   * every nudge for the majority of runs.
   */
  energy: { value: number; ageMins: number } | null;
  /**
   * Active snoozes (5.2). A snooze suppresses one (kind, refKey) pair until a
   * time the user chose. This is a FILTER on candidates, deliberately not a
   * change to how candidates compete with each other — the burst cap and the
   * priority order in finalize() are untouched.
   */
  snoozes: { kind: string; refKey: string; until: Date; condition: string | null }[];
};

/** A check-in older than this tells us nothing about right now. */
export const ENERGY_FRESH_MINS = 240;

/** 1-2 out of 5. Below this, asking for a 45-minute errand is just noise. */
const LOW_ENERGY_AT = 2;

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

/**
 * Blocks that reserve time without committing it -- free/buffer/flex. Errands
 * belong here. "rest" is excluded on purpose: relaxing is a real activity and a
 * nudge to file paperwork during it is precisely the interruption to avoid.
 */
const OPEN_BLOCK_KINDS = new Set(["buffer", "free", "flex", "open", "spare"]);

function isOpenBlock(b: NudgeBlock): boolean {
  if (OPEN_BLOCK_KINDS.has(String(b.kind || "").toLowerCase())) return true;
  return /\b(free|spare|buffer|open|flex)\b/i.test(b.label || "");
}

/**
 * How long a task must exist before it can be nudged as an errand. Long enough
 * that adding a task isn't instantly answered by a notification about it, short
 * enough that something jotted down last night surfaces the next free hour.
 */
const MIN_ERRAND_AGE_HOURS = 3;

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

/** Order by importance, then cap the burst. Structure first, nagging last. */
function finalize(out: Nudge[]): Nudge[] {
  const priority: NudgeKind[] = ["block", "due_today", "errand", "overdue", "stuck", "evening", "idle"];
  return out
    .sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))
    .slice(0, 2);
}

export function decideNudges(ctx: NudgeCtx): Nudge[] {
  const { prefs, nowMins, tasks, blocks, shift } = ctx;
  if (!prefs.notifyEnabled) return [];

  // Asleep, or meant to be.
  //
  // One deliberate exception, applied in section 1: the lead-time nudge for a
  // block that starts the moment quiet hours end. Without it the first block of
  // every day is unreachable -- a 5-minute lead on an 07:00 block lands at 06:55,
  // inside the quiet window, and was being dropped silently every morning.
  const quietNow = inQuietHours(nowMins, prefs.quietStart, prefs.quietEnd);

  const shiftStart = shift ? toMins(shift.start) : null;
  const shiftEnd = shift ? toMins(shift.end) : null;
  const onShiftNow =
    shiftStart != null && shiftEnd != null && nowMins >= shiftStart && nowMins < shiftEnd;

  // On shift: he's at work, the phone stays in the pocket.
  if (onShiftNow && !prefs.notifyDuringShift) return [];

  // ── Snoozed? (5.2) ───────────────────────────────────────────────────────
  // A conditional snooze can only be released EARLY, never extended past its
  // hard `until` — otherwise a condition that never becomes true (an energy
  // check-in he never files) would silence a nudge forever.
  const isSnoozed = (kind: NudgeKind, refKey: string) => {
    const s = ctx.snoozes.find((x) => x.kind === kind && x.refKey === refKey);
    if (!s) return false;
    if (ctx.now.getTime() >= s.until.getTime()) return false;
    if (s.condition === "energy3") {
      const recovered =
        ctx.energy != null && ctx.energy.ageMins <= ENERGY_FRESH_MINS && ctx.energy.value >= 3;
      if (recovered) return false;
    }
    return true;
  };

  // ── Shift buffer silence (4.3) ───────────────────────────────────────────
  // The window either side of a shift is not usable time: he's getting ready, or
  // he's wrecked. Buzzing then is the fastest way to teach someone to ignore the
  // channel. Block nudges still fire — the pre-shift prep and decompress blocks
  // ARE the buffers, and announcing them is the whole point.
  const inShiftBuffer =
    shiftStart != null &&
    shiftEnd != null &&
    ((nowMins >= shiftStart - ctx.preShiftQuietMins && nowMins < shiftStart) ||
      (nowMins >= shiftEnd && nowMins < shiftEnd + ctx.postShiftQuietMins));

  const sentKey = new Set(ctx.sentToday.map((s) => `${s.kind}::${s.refKey}`));
  const countOf = (kind: NudgeKind) => ctx.sentToday.filter((s) => s.kind === kind).length;
  const already = (kind: NudgeKind, refKey: string) => sentKey.has(`${kind}::${refKey}`);
  const capped = (kind: NudgeKind) => {
    const cap = DAILY_CAP[kind];
    return cap != null && countOf(kind) >= cap;
  };

  const out: Nudge[] = [];
  const push = (n: Nudge) => {
    if (already(n.kind, n.refKey) || capped(n.kind) || isSnoozed(n.kind, n.refKey)) return;
    out.push(n);
  };

  // Running on empty? Nothing is suppressed because of it -- the same nudges
  // still fire -- but what they ask for shrinks. A depleted person told to
  // "knock out that 40-minute job" just closes the notification.
  const lowEnergy =
    ctx.energy != null && ctx.energy.ageMins <= ENERGY_FRESH_MINS && ctx.energy.value <= LOW_ENERGY_AT;

  // ── 1. Block starting ────────────────────────────────────────────────────
  // The core structure nudge: "this is what you're doing next, starting now".
  if (prefs.notifyBlocks && ctx.planExists) {
    const lead = Math.max(0, prefs.notifyLeadMins);
    for (const b of blocks) {
      const bs = toMins(b.start);
      const delta = bs - nowMins;
      if (delta < 0 || delta > lead) continue;

      // During quiet hours only one thing may speak: the block that starts as
      // quiet ends. Anything starting later can wait until quiet is over.
      if (quietNow && inQuietHours(bs, prefs.quietStart, prefs.quietEnd)) continue;

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

  // Past this point every nudge is discretionary, so quiet hours win — and so
  // does the shift buffer, for the same reason.
  if (quietNow || inShiftBuffer) return finalize(out);

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
  //
  // But an open-ended holding block is not an interruption to protect. A real
  // plan often contains one long "Free Day" / buffer block covering the whole
  // afternoon, and treating that as busy silenced errands for the entire day --
  // exactly the window they exist for.
  const activeBlock = blocks.find((b) => nowMins >= toMins(b.start) && nowMins < toMins(b.end));
  const activeIsOpenEnded = activeBlock ? isOpenBlock(activeBlock) : false;
  const nextBlockStart = blocks
    .map((b) => toMins(b.start))
    .filter((s) => s > nowMins)
    .sort((a, b) => a - b)[0];
  const gapMins = nextBlockStart != null ? nextBlockStart - nowMins : 24 * 60 - nowMins;
  const isFree = (!activeBlock || activeIsOpenEnded) && gapMins >= 20;

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
        .filter(
          (t) => (ctx.now.getTime() - t.createdAt.getTime()) / 3600000 >= MIN_ERRAND_AGE_HOURS
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      // On a low-energy day, only the genuinely tiny errands are offered, and
      // shortest wins over oldest. Nothing is skipped forever -- a 40-minute
      // job simply waits for a run where he hasn't said he's flat.
      const eligible = lowEnergy
        ? stale
            .filter((t) => (t.effortMins ?? 15) <= 15)
            .sort((a, b) => (a.effortMins ?? 15) - (b.effortMins ?? 15))
        : stale;

      const pick = eligible.find((t) => !already("errand", t.id));
      if (pick) {
        const ageHours = (ctx.now.getTime() - pick.createdAt.getTime()) / 3600000;
        const ageDays = Math.floor(ageHours / 24);
        const age =
          ageDays >= 1 ? `${ageDays} day${ageDays > 1 ? "s" : ""}` : `${Math.floor(ageHours)}h`;
        const mins = pick.effortMins ?? 15;
        push({
          kind: "errand",
          refKey: pick.id,
          title: lowEnergy
            ? `Low battery — ${pick.title}`
            : `Free ${gapMins >= 60 ? "hour" : `${gapMins} min`} — ${pick.title}`,
          body: lowEnergy
            ? pick.startTrigger
              ? `Small one, ~${mins} min. Just: ${pick.startTrigger}`
              : `Small one, ~${mins} min. Sitting ${age}. Low effort, then stop.`
            : pick.startTrigger
              ? `${age} old, ~${mins} min. Start: ${pick.startTrigger}`
              : `Sitting ${age} already, ~${mins} min. Do it now and it's gone.`,
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
        body: lowEnergy
          ? "Started but not moving, and you're running low. Hit Smallest step and do just that."
          : "Started but not moving. Break it into one 15-min step, or park it honestly.",
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

  return finalize(out);
}
