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
