import type { DayWindow } from "./context";

/**
 * The model is good at shaping a day and bad at respecting a hard boundary.
 * So the shift is enforced in code, not in the prompt: exactly one "work"
 * block, exactly the real shift times, and nothing scheduled inside it.
 */

export type PlanBlock = {
  start: string;
  end: string;
  label: string;
  kind: string;
  why?: string;
  taskId?: string;
};

const toMins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (m: number) => {
  const clamped = Math.max(0, Math.min(1439, m));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
};

const valid = (b: PlanBlock) =>
  typeof b?.start === "string" &&
  typeof b?.end === "string" &&
  /^\d{2}:\d{2}$/.test(b.start) &&
  /^\d{2}:\d{2}$/.test(b.end) &&
  toMins(b.end) > toMins(b.start);

const byStart = (a: PlanBlock, b: PlanBlock) => toMins(a.start) - toMins(b.start);

/** Minimum surviving length for a clipped block, in minutes. */
const MIN_BLOCK = 5;

export function enforceShiftWindow(
  raw: unknown,
  shift: DayWindow,
  source: "pattern" | "fallback"
): PlanBlock[] {
  const blocks = (Array.isArray(raw) ? (raw as PlanBlock[]) : []).filter(valid);

  // Day off — the model sometimes invents a shift anyway. Strip every work block.
  if (!shift) {
    const kept = blocks.filter((b) => b.kind !== "work");
    return source === "pattern" ? kept.sort(byStart) : kept.sort(byStart);
  }

  const s = toMins(shift.start);
  const e = toMins(shift.end);
  const work = blocks.filter((b) => b.kind === "work");

  const around: PlanBlock[] = [];
  for (const b of blocks) {
    if (b.kind === "work") continue;
    let bs = toMins(b.start);
    let be = toMins(b.end);

    if (bs >= s && be <= e) continue; // fully inside the shift — drop
    if (bs < s && be > s) be = s; // overlaps the start (or spans) — keep the pre-shift part
    else if (bs < e && be > e) bs = e; // overlaps the end — keep the post-shift part

    if (be - bs < MIN_BLOCK) continue;
    around.push({ ...b, start: toTime(bs), end: toTime(be) });
  }

  const shiftBlock: PlanBlock = {
    start: shift.start,
    end: shift.end,
    label: work[0]?.label?.trim() || "Work shift",
    kind: "work",
    why: work[0]?.why || "Fixed shift — plan around it",
  };

  return [...around, shiftBlock].sort(byStart);
}

/**
 * 4.3 Shift buffering.
 *
 * A shift does not begin when it begins. It begins when you have to stop
 * everything, eat, change and travel — and it doesn't end at clock-off either,
 * because nothing useful happens in the half hour after a double. Left implicit,
 * that time silently gets planned as if it were free, the plan fails, and the
 * plan stops being trusted.
 *
 * So the buffers are made explicit as real blocks. Two consequences fall out for
 * free: the existing "block" nudge announces them (no new nudge kind, no change
 * to nudge arbitration), and anything the model tried to schedule there gets
 * pushed out by the same clipping logic the shift itself uses.
 *
 * Content is fixed, not generated: at 20 minutes before a shift nobody reads a
 * paragraph, and a static label is one glance.
 */
export function withShiftBuffers(
  blocks: PlanBlock[],
  shift: DayWindow,
  preMins: number,
  postMins: number
): PlanBlock[] {
  if (!shift) return blocks;

  const s = toMins(shift.start);
  const e = toMins(shift.end);
  const pre = Math.max(0, Math.min(120, Math.round(preMins)));
  const post = Math.max(0, Math.min(120, Math.round(postMins)));

  const buffers: PlanBlock[] = [];

  // Pre-shift: only if it fits in the actual day (a 06:00 shift has no room for
  // a 45-minute prep block at 05:15 — inventing one just adds a failed block).
  if (pre >= MIN_BLOCK && s - pre >= 0) {
    buffers.push({
      start: toTime(s - pre),
      end: shift.start,
      label: "Pre-shift: eat, water, kit",
      kind: "prep",
      why: "Eat properly and fill a bottle now — this is the last chance before service.",
    });
  }

  if (post >= MIN_BLOCK && e + post <= 1439) {
    buffers.push({
      start: shift.end,
      end: toTime(e + post),
      label: "Decompress",
      kind: "rest",
      why: "Sit down, eat, say how it went. Do not start anything new in here.",
    });
  }

  if (!buffers.length) return blocks;

  const bufferRanges = buffers.map((b) => [toMins(b.start), toMins(b.end)] as const);
  const overlapsBuffer = (bs: number, be: number) =>
    bufferRanges.some(([rs, re]) => bs < re && be > rs);

  // Clip everything else out of the buffer windows, using the same rules as the
  // shift itself: fully inside is dropped, partial overlap is trimmed, and a
  // stub shorter than MIN_BLOCK is not worth keeping.
  const kept: PlanBlock[] = [];
  for (const b of blocks) {
    let bs = toMins(b.start);
    let be = toMins(b.end);

    // The shift block is untouchable, and the buffers sit outside it by design.
    if (b.kind === "work") {
      kept.push(b);
      continue;
    }
    if (!overlapsBuffer(bs, be)) {
      kept.push(b);
      continue;
    }

    for (const [rs, re] of bufferRanges) {
      if (bs >= rs && be <= re) {
        bs = be = 0; // swallowed by the buffer
        break;
      }
      if (bs < rs && be > rs && be <= re) be = rs;
      else if (bs >= rs && bs < re && be > re) bs = re;
    }

    if (be - bs >= MIN_BLOCK) kept.push({ ...b, start: toTime(bs), end: toTime(be) });
  }

  return [...kept, ...buffers].sort(byStart);
}
