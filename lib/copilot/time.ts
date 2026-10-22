/**
 * Venue-local calendar helpers. The server runs in UTC; venues don't.
 *
 * Storage conventions this relies on (checked against staging data):
 *  - Reservation.date is a calendar day stored at 12:00 or 00:00 UTC, so its
 *    UTC date IS the booking's local date. Reservation.time is "HH:mm" local.
 *  - Shift.date is 00:00 UTC of the local day; startTime/endTime are instants.
 *  - Everything else (HACCP checkedAt, WastageRecord.date…) is an instant.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function localYmd(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function localHourMinute(instant: Date, timeZone: string): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { hour: get("hour") % 24, minute: get("minute") };
}

export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00Z");
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b (b − a). */
export function diffDaysYmd(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekdayOfYmd(ymd: string): number {
  return new Date(ymd + "T12:00:00Z").getUTCDay();
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatYmd(ymd: string): string {
  const d = new Date(ymd + "T12:00:00Z");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const m: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = Number(p.value);
  const asUtc = Date.UTC(m.year, m.month - 1, m.day, m.hour % 24, m.minute, m.second);
  return asUtc - instant.getTime();
}

/** UTC instant of a venue wall-clock time on a venue-local date. DST-safe. */
export function zonedToUtc(ymd: string, hhmm: string, timeZone: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = (hhmm || "00:00").split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h || 0, mi || 0, 0, 0);
  let guess = naive - offsetMs(new Date(naive), timeZone);
  guess = naive - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

export function dayStartUtc(ymd: string, timeZone: string): Date {
  return zonedToUtc(ymd, "00:00", timeZone);
}

/** The calendar date a Reservation.date / Shift.date value represents. */
export function storedDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Midday UTC of a calendar date — matches how Reservation.date is stored. */
export function ymdToStoredRange(fromYmd: string, toYmdInclusive: string): { gte: Date; lt: Date } {
  return {
    gte: new Date(fromYmd + "T00:00:00.000Z"),
    lt: new Date(addDaysYmd(toYmdInclusive, 1) + "T00:00:00.000Z"),
  };
}

export function parseHour(time: string | null | undefined): number | null {
  if (!time) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h < 24 ? h : null;
}
