// @ts-nocheck
// Shared logic for computing worked/break time from a day's ClockEvents.
// Event types: "in" | "out" | "break_start" | "break_end"

export type ClockEventLite = {
  type: string;
  timestamp: Date | string;
};

export type ShiftState = {
  isClockedIn: boolean;   // clocked in AND not on break (actively working)
  isOnBreak: boolean;
  workedMs: number;       // total worked time excluding breaks
  breakMs: number;        // total break time taken
  clockedInAt: Date | null; // when the current working segment started (null if not working)
  onBreakSince: Date | null;
};

export function computeShiftState(events: ClockEventLite[], now: Date = new Date()): ShiftState {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let clockInTime: Date | null = null;
  let onBreakSince: Date | null = null;
  let workedMs = 0;
  let breakMs = 0;

  for (const e of sorted) {
    const ts = new Date(e.timestamp);
    if (e.type === "in") {
      clockInTime = ts;
    } else if (e.type === "break_start") {
      if (clockInTime) {
        workedMs += ts.getTime() - clockInTime.getTime();
        clockInTime = null;
      }
      onBreakSince = ts;
    } else if (e.type === "break_end") {
      if (onBreakSince) {
        breakMs += ts.getTime() - onBreakSince.getTime();
        onBreakSince = null;
      }
      clockInTime = ts;
    } else if (e.type === "out") {
      if (clockInTime) {
        workedMs += ts.getTime() - clockInTime.getTime();
        clockInTime = null;
      }
      if (onBreakSince) {
        breakMs += ts.getTime() - onBreakSince.getTime();
        onBreakSince = null;
      }
    }
  }

  if (clockInTime) workedMs += now.getTime() - clockInTime.getTime();
  if (onBreakSince) breakMs += now.getTime() - onBreakSince.getTime();

  return {
    isClockedIn: clockInTime !== null,
    isOnBreak: onBreakSince !== null,
    workedMs,
    breakMs,
    clockedInAt: clockInTime,
    onBreakSince,
  };
}

// ── Irish Organisation of Working Time Act 1997, Section 12 ───────────────────
// > 4.5 hours worked  → entitled to a 15-minute break
// > 6 hours worked    → entitled to a 30-minute break (may include the first 15 min)
export const BREAK_15_THRESHOLD_MS = 4.5 * 60 * 60 * 1000;
export const BREAK_30_THRESHOLD_MS = 6 * 60 * 60 * 1000;
export const BREAK_15_MIN_MS = 15 * 60 * 1000;
export const BREAK_30_MIN_MS = 30 * 60 * 1000;

export type BreakEntitlement = {
  dueLevel: "none" | "15" | "30"; // highest break entitlement reached
  satisfied: boolean;             // has taken enough break time for that level
  minutesShort: number;           // how many break minutes still owed (0 if satisfied)
};

export function getBreakEntitlement(state: ShiftState): BreakEntitlement {
  const totalActiveMs = state.workedMs; // worked time (excludes breaks) drives entitlement
  if (totalActiveMs >= BREAK_30_THRESHOLD_MS) {
    const short = Math.max(0, BREAK_30_MIN_MS - state.breakMs);
    return { dueLevel: "30", satisfied: short === 0, minutesShort: Math.ceil(short / 60000) };
  }
  if (totalActiveMs >= BREAK_15_THRESHOLD_MS) {
    const short = Math.max(0, BREAK_15_MIN_MS - state.breakMs);
    return { dueLevel: "15", satisfied: short === 0, minutesShort: Math.ceil(short / 60000) };
  }
  return { dueLevel: "none", satisfied: true, minutesShort: 0 };
}
