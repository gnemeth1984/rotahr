/**
 * Navigator stores dates as @db.Date. Everything is anchored to the user's
 * local day, not UTC instants, so a plan made at 23:30 belongs to that day.
 */

/** Midnight UTC for a YYYY-MM-DD string — the canonical @db.Date value. */
export function dayFromKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** YYYY-MM-DD for a Date, read in UTC (matching how @db.Date round-trips). */
export function keyFromDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today's key in a given IANA timezone. */
export function todayKey(timezone = "Europe/Dublin"): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA gives YYYY-MM-DD
}

/** Current HH:mm in a given IANA timezone. */
export function nowTime(timezone = "Europe/Dublin"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export function addDaysKey(key: string, days: number): string {
  const d = dayFromKey(key);
  d.setUTCDate(d.getUTCDate() + days);
  return keyFromDay(d);
}

/** Monday-anchored week start for a key. */
export function weekStartKey(key: string): string {
  const d = dayFromKey(key);
  const dow = d.getUTCDay(); // 0 = Sunday
  const back = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - back);
  return keyFromDay(d);
}

export function weekdayName(key: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    weekday: "long",
    timeZone: "UTC",
  }).format(dayFromKey(key));
}

/** Minutes between two HH:mm strings (b - a), never negative. */
export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.max(0, bh * 60 + bm - (ah * 60 + am));
}

export function addMinutesToTime(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
