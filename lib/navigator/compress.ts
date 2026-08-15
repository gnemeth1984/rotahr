/**
 * 4.2 Day Compression.
 *
 * The failure mode this exists for: the day starts at 09:00, it's now 13:40, and
 * the plan on screen still says 09:00. Every block is wrong, so the whole plan
 * gets ignored — not because the plan was bad, but because it's stale. The
 * ADHD-relevant part is that re-planning from scratch costs a decision the person
 * has already proven they can't make today, so this does it mechanically instead.
 *
 * Rules, in priority order:
 *  1. Never touch the work block. A shift is a hard external commitment.
 *  2. Never schedule anything into the past.
 *  3. Keep the ORDER the user already agreed to — resequencing is a new plan and
 *     a new decision. Compression only changes when and how long.
 *  4. Shrink before dropping, and drop from the bottom (least important last).
 *  5. Nothing survives below MIN_KEEP minutes: a 4-minute "workout" is a lie.
 *
 * Pure: no clock, no DB, no AI. Everything is passed in so the awkward cases are
 * testable.
 */

export type CompressBlock = {
  start: string;
  end: string;
  label: string;
  kind: string;
  why?: string;
  taskId?: string;
  done?: boolean;
};

const toMins = (t: string): number => {
  const [h, m] = String(t).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

const toTime = (m: number): string => {
  const c = Math.max(0, Math.min(1439, Math.round(m)));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};

/** Below this a block stops being a real activity, so it's dropped instead. */
const MIN_KEEP = 10;

/**
 * How long after a block was due can it still be reclaimed into the day.
 *
 * A block missed an hour ago is drift worth fixing. Breakfast missed thirteen
 * hours ago is not: re-placing it would schedule breakfast for 22:30, which is
 * how a rescue feature ends up producing something obviously stupid and getting
 * ignored. Past this window a missed block is history, and stays where it is.
 */
const RECLAIM_AFTER_MINS = 6 * 60;

/**
 * Kinds that are never re-placed when missed, regardless of the window. Sleep is
 * anchored to the night, not to whatever gap is left in the evening.
 */
const NEVER_REPLACE = new Set(["sleep", "night", "bed", "wake", "shift", "work"]);

const isNeverReplaced = (b: CompressBlock): boolean =>
  NEVER_REPLACE.has(String(b.kind || "").toLowerCase()) || /\b(sleep|bed|asleep|night)\b/i.test(b.label || "");

/** A gap left between blocks so a compressed day isn't a wall of back-to-back. */
const SEAM = 0;

/**
 * How far each kind may be squeezed, as a fraction of its planned length.
 * Meals and rest resist hardest: skipping food is what turns a late day into a
 * wrecked one, which is the exact spiral this feature is supposed to interrupt.
 */
const FLOOR: Record<string, number> = {
  meal: 0.7,
  food: 0.7,
  rest: 0.6,
  break: 0.5,
  admin: 0.4,
  deep: 0.5,
  focus: 0.5,
  workout: 0.5,
  habit: 0.4,
  buffer: 0.2,
  free: 0.2,
};
const DEFAULT_FLOOR = 0.5;

/**
 * How droppable each kind is when shrinking alone isn't enough. Higher goes first.
 *
 * Meals sit at the bottom deliberately: skipping food is what turns a late day
 * into a wrecked evening, which is the exact spiral compression exists to
 * interrupt. Unlisted kinds land mid-scale — droppable, but only after the
 * genuinely spare time has gone.
 */
const DROPPABILITY: Record<string, number> = {
  buffer: 100,
  free: 100,
  flex: 100,
  open: 100,
  spare: 100,
  habit: 80,
  admin: 70,
  social: 60,
  workout: 50,
  deep: 40,
  focus: 40,
  prep: 30,
  break: 25,
  rest: 20,
  meal: 5,
  food: 5,
};
const DEFAULT_DROPPABILITY = 45;

export type CompressResult = {
  blocks: CompressBlock[];
  /** Blocks that could not be fitted at all, so the UI can say so out loud. */
  dropped: CompressBlock[];
  /** Minutes of planned work that no longer fit in the day. */
  lostMins: number;
  /** One-line summary for the UI. */
  summary: string;
};

/**
 * @param raw        the current plan blocks
 * @param nowMins    minutes since local midnight
 * @param dayEndMins when the day is over (usually sleepTime)
 * @param shift      today's shift, untouchable
 */
export function compressDay(
  raw: unknown,
  nowMins: number,
  dayEndMins: number,
  shift: { start: string; end: string } | null
): CompressResult {
  const all = (Array.isArray(raw) ? (raw as CompressBlock[]) : [])
    .filter(
      (b) =>
        b &&
        typeof b.start === "string" &&
        typeof b.end === "string" &&
        /^\d{2}:\d{2}$/.test(b.start) &&
        /^\d{2}:\d{2}$/.test(b.end)
    )
    .sort((a, b) => toMins(a.start) - toMins(b.start));

  const shiftStart = shift ? toMins(shift.start) : null;
  const shiftEnd = shift ? toMins(shift.end) : null;

  const isWork = (b: CompressBlock) => b.kind === "work";

  // Ticked off: leave it exactly as it is. Rewriting history makes the day feel
  // like it never happened, which is demoralising and also loses the record of
  // what actually got done.
  //
  // A block that has simply ENDED without being ticked is the opposite case: it
  // is precisely the drift this whole function exists to fix, so it goes back in
  // the queue to be re-placed. Leaving it sitting in the past would make
  // "rescue the day" a no-op on the days it's needed most.
  //
  // Mid-flight right now (started, not finished) is kept as-is — he's doing it.
  const inProgress = (b: CompressBlock) => toMins(b.start) <= nowMins && toMins(b.end) > nowMins;
  const staleBeyondUse = (b: CompressBlock) => nowMins - toMins(b.end) > RECLAIM_AFTER_MINS;
  const keepAsIs = (b: CompressBlock) =>
    b.done === true ||
    isWork(b) ||
    inProgress(b) ||
    isNeverReplaced(b) ||
    (toMins(b.end) <= nowMins && staleBeyondUse(b));

  const keptAsIs = all.filter(keepAsIs);
  const pending = all.filter((b) => !keepAsIs(b));

  // Anything kept because it's happening right now still occupies the clock, so
  // the layout must not start until it's finished.
  const activeEnd = keptAsIs
    .filter((b) => !isWork(b) && inProgress(b))
    .reduce((n, b) => Math.max(n, toMins(b.end)), 0);

  // Free windows left in the day: everything from now to day end, minus the shift.
  const windows: { start: number; end: number }[] = [];
  const pushWindow = (s: number, e: number) => {
    if (e - s >= MIN_KEEP) windows.push({ start: s, end: e });
  };
  const from = Math.max(nowMins, activeEnd, 0);
  if (shiftStart != null && shiftEnd != null && shiftEnd > from) {
    if (shiftStart > from) pushWindow(from, Math.min(shiftStart, dayEndMins));
    if (shiftEnd < dayEndMins) pushWindow(Math.max(shiftEnd, from), dayEndMins);
  } else {
    pushWindow(from, dayEndMins);
  }

  const capacity = windows.reduce((n, w) => n + (w.end - w.start), 0);
  const wanted = pending.reduce((n, b) => n + Math.max(0, toMins(b.end) - toMins(b.start)), 0);

  // Decide which pending blocks survive. Shrink everything to its floor first;
  // if even the floors don't fit, drop from the sacrificial end.
  const survivors = [...pending];
  const dropped: CompressBlock[] = [];
  const floorOf = (b: CompressBlock) => {
    const len = Math.max(0, toMins(b.end) - toMins(b.start));
    const f = FLOOR[String(b.kind || "").toLowerCase()] ?? DEFAULT_FLOOR;
    return Math.max(MIN_KEEP, Math.round(len * f));
  };
  const dropRank = (b: CompressBlock) =>
    DROPPABILITY[String(b.kind || "").toLowerCase()] ?? DEFAULT_DROPPABILITY;

  const floorTotal = () => survivors.reduce((n, b) => n + floorOf(b), 0);
  while (survivors.length && floorTotal() + SEAM * (survivors.length - 1) > capacity) {
    // Most droppable kind first; among equals, the one latest in the day goes,
    // because the user has already mentally committed to what comes next.
    let worst = 0;
    for (let i = 1; i < survivors.length; i++) {
      const a = survivors[i];
      const b = survivors[worst];
      if (dropRank(a) > dropRank(b) || (dropRank(a) === dropRank(b) && toMins(a.start) > toMins(b.start))) {
        worst = i;
      }
    }
    dropped.push(survivors.splice(worst, 1)[0]);
  }

  // Scale the survivors to fit, never below their floor and never above their
  // original length — compression only ever takes time away.
  const survivorWanted = survivors.reduce((n, b) => n + Math.max(0, toMins(b.end) - toMins(b.start)), 0);
  const ratio = survivorWanted > 0 ? Math.min(1, capacity / survivorWanted) : 1;

  const lengths = survivors.map((b) => {
    const len = Math.max(0, toMins(b.end) - toMins(b.start));
    return Math.max(floorOf(b), Math.min(len, Math.round(len * ratio)));
  });

  // Lay them out in order across the free windows.
  const placed: CompressBlock[] = [];
  let wi = 0;
  let cursor = windows.length ? windows[0].start : from;
  for (let i = 0; i < survivors.length; i++) {
    let len = lengths[i];
    while (wi < windows.length) {
      const w = windows[wi];
      if (cursor < w.start) cursor = w.start;
      const room = w.end - cursor;
      if (room >= Math.max(MIN_KEEP, Math.min(len, MIN_KEEP))) {
        len = Math.min(len, room);
        placed.push({ ...survivors[i], start: toTime(cursor), end: toTime(cursor + len) });
        cursor += len + SEAM;
        break;
      }
      wi++;
      cursor = wi < windows.length ? windows[wi].start : cursor;
    }
    if (wi >= windows.length) {
      // Ran out of day. Everything from here on is honestly dropped.
      dropped.push(...survivors.slice(i));
      break;
    }
  }

  const blocks = [...keptAsIs, ...placed].sort((a, b) => toMins(a.start) - toMins(b.start));
  const lostMins = Math.max(0, wanted - placed.reduce((n, b) => n + (toMins(b.end) - toMins(b.start)), 0));

  const summary = !pending.length
    ? "Nothing to compress — everything left is either done or already under way."
    : dropped.length
      ? `Compressed ${placed.length} block${placed.length === 1 ? "" : "s"} into the time you actually have. ${dropped.length} didn't fit and moved off today.`
      : `Compressed ${placed.length} block${placed.length === 1 ? "" : "s"} to fit the time left. Nothing dropped.`;

  return { blocks, dropped, lostMins, summary };
}

/**
 * Is compressing worth offering right now? Only when the plan is visibly stale:
 * a block that should have started at least this long ago never did.
 */
export const STALE_AFTER_MINS = 45;

export function planIsStale(raw: unknown, nowMins: number): boolean {
  const blocks = (Array.isArray(raw) ? (raw as CompressBlock[]) : []).filter(
    (b) => b && typeof b.start === "string" && /^\d{2}:\d{2}$/.test(b.start)
  );
  if (!blocks.length) return false;
  // Upper bound as well as lower: something missed this morning is not a reason
  // to keep offering a rescue at 10pm. There has to be time left to rescue.
  return blocks.some((b) => {
    if (b.kind === "work" || b.done === true || isNeverReplaced(b)) return false;
    const missedBy = nowMins - toMins(b.end);
    return missedBy >= STALE_AFTER_MINS && missedBy <= RECLAIM_AFTER_MINS;
  });
}
