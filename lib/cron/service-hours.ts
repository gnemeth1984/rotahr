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

/**
 * Offset of Europe/Dublin from UTC, in ms, at a given instant.
 * Positive during Irish Summer Time (+1h), zero in winter.
 */
function dublinOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: DUBLIN_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  const asIfUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asIfUtc - date.getTime();
}

/** Y/M/D of the current Dublin calendar day. */
function dublinYmd(now: Date): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: DUBLIN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = dtf.format(now).split("-").map(Number);
  return { year, month, day };
}

/**
 * Convert a Dublin wall-clock time ("HH:mm") on today's Dublin date into the
 * correct UTC instant.
 *
 * Vercel runs functions in UTC, so Date#setHours() would interpret the time as
 * UTC and land an hour early during Irish Summer Time. Schedule times entered
 * by managers in Settings are always Dublin wall-clock.
 */
export function dublinWallClockToUtc(hhmm: string, now: Date = new Date()): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const { year, month, day } = dublinYmd(now);
  const naive = Date.UTC(year, month - 1, day, h, m, 0, 0);
  // Resolve using the offset in effect at the approximate instant, then refine
  // once — this settles correctly either side of a DST transition.
  let guess = naive - dublinOffsetMs(new Date(naive));
  guess = naive - dublinOffsetMs(new Date(guess));
  return new Date(guess);
}

/** UTC instant of 00:00 on the current Dublin calendar day. */
export function dublinDayStartUtc(now: Date = new Date()): Date {
  return dublinWallClockToUtc("00:00", now);
}

/** UTC instant of 23:59:59.999 on the current Dublin calendar day. */
export function dublinDayEndUtc(now: Date = new Date()): Date {
  const start = dublinDayStartUtc(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
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
