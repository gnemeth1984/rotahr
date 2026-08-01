// Service-hours guard for high-frequency crons.
//
// Why this exists: our Neon database has scale-to-zero enabled, so it is billed
// per CU-hour only while awake. Every cron run wakes it and holds it awake for
// the full suspend delay (5 min). Crons that run overnight therefore cost real
// money while doing nothing useful. Returning early — BEFORE any Prisma call —
// lets the compute stay suspended.
//
// IMPORTANT: call isQuietHours() before importing/using prisma in the handler.
// A single query is enough to wake the compute for the whole suspend window.

const DUBLIN_TZ = "Europe/Dublin";

/**
 * Current hour (0-23) and minute in Dublin local time, regardless of server TZ.
 * Vercel runs functions in UTC, so we cannot use Date#getHours() here — it
 * would be an hour off during Irish Summer Time.
 */
export function dublinNow(now: Date = new Date()): { hour: number; minute: number; dayOfWeek: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBLIN_TZ,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = days.indexOf(get("weekday"));

  return { hour, minute, dayOfWeek };
}

/**
 * True when the current Dublin time falls inside the quiet window [startHour, endHour).
 * Handles windows that cross midnight (e.g. 1 -> 5 does not, 23 -> 5 does).
 */
export function isQuietHours(startHour: number, endHour: number, now: Date = new Date()): boolean {
  const { hour } = dublinNow(now);
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  // window wraps past midnight
  return hour >= startHour || hour < endHour;
}

/** Standard JSON body for a cron that skipped itself. */
export function quietHoursResponse(startHour: number, endHour: number, now: Date = new Date()) {
  const { hour, minute } = dublinNow(now);
  return {
    skipped: true,
    reason: "quiet_hours",
    quietWindow: `${String(startHour).padStart(2, "0")}:00-${String(endHour).padStart(2, "0")}:00 Europe/Dublin`,
    dublinTime: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}
