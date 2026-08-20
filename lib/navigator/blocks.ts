/**
 * One gate every day-plan block must pass before it is stored or rendered.
 *
 * Why this file exists: the chat tool `set_day_plan` writes whatever the model
 * hands back. A single truncated block ({ "start": "" } with no end/label) was
 * enough to take the whole Navigator page down — the UI read `b.end.split(":")`
 * and threw before anything rendered, on every load, permanently, because the
 * bad value was persisted. A malformed block must never reach the database, and
 * anything already in the database must never reach the UI.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const KINDS = [
  "deep",
  "admin",
  "meal",
  "move",
  "break",
  "transition",
  "rest",
  "social",
  "work",
  "buffer",
] as const;

export type PlanBlockKind = (typeof KINDS)[number];

export type SanePlanBlock = {
  start: string;
  end: string;
  label: string;
  kind: string;
  why?: string;
  taskId?: string;
  done?: boolean;
};

const mins = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** A block is only usable if it has a real HH:mm window and something to call it. */
export function isSanePlanBlock(b: unknown): b is SanePlanBlock {
  if (!b || typeof b !== "object") return false;
  const r = b as Record<string, unknown>;
  if (typeof r.start !== "string" || !HHMM.test(r.start)) return false;
  if (typeof r.end !== "string" || !HHMM.test(r.end)) return false;
  // A zero-length block is odd but harmless (the AI likes a 22:30-22:30 "Sleep"
  // marker to close the day). Only a window running backwards is garbage.
  if (mins(r.end) < mins(r.start)) return false;
  if (typeof r.label !== "string" || !r.label.trim()) return false;
  return true;
}

/**
 * Drop every block that can't be trusted, normalise the ones that can, and put
 * the day back in time order. Never throws, whatever shape it is handed.
 */
export function sanitisePlanBlocks(raw: unknown): SanePlanBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: SanePlanBlock[] = [];
  for (const item of raw) {
    if (!isSanePlanBlock(item)) continue;
    const r = item as unknown as Record<string, unknown>;
    const kind = typeof r.kind === "string" && (KINDS as readonly string[]).includes(r.kind) ? r.kind : "admin";
    const block: SanePlanBlock = {
      start: item.start,
      end: item.end,
      label: item.label.trim().slice(0, 200),
      kind,
    };
    if (typeof r.why === "string" && r.why.trim()) block.why = r.why.trim().slice(0, 300);
    if (typeof r.taskId === "string" && r.taskId.trim()) block.taskId = r.taskId.trim();
    if (r.done === true) block.done = true;
    out.push(block);
  }
  return out.sort((a, b) => mins(a.start) - mins(b.start));
}

/** How many blocks a payload lost to sanitising — worth logging, not hiding. */
export function droppedBlockCount(raw: unknown): number {
  if (!Array.isArray(raw)) return 0;
  return raw.length - sanitisePlanBlocks(raw).length;
}
