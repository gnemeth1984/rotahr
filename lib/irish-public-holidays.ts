/**
 * Irish Public Holidays (Bank Holidays)
 * Based on Organisation of Working Time Act 1997 (as amended)
 * 10 public holidays per year in Ireland.
 */

export interface PublicHoliday {
  date: string; // ISO YYYY-MM-DD
  name: string;
  isPremiumPay: boolean; // always true for Irish PHs — double time or day in lieu
}

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Easter Sunday for a given year (Anonymous Gregorian algorithm) */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** First Monday on or after a given date */
function firstMondayOnOrAfter(year: number, month: number, day: number): Date {
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();
  if (dow === 1) return d;
  const diff = dow === 0 ? 1 : 8 - dow;
  return new Date(year, month - 1, day + diff);
}

/** First Monday of a given month */
function firstMondayOf(year: number, month: number): Date {
  return firstMondayOnOrAfter(year, month, 1);
}

export function getIrishPublicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const holidays: PublicHoliday[] = [
    // 1 January
    { date: isoDate(new Date(year, 0, 1)), name: "New Year's Day", isPremiumPay: true },
    // St Brigid's Day — first Monday in February (from 2023) or 1 Feb if Monday
    {
      date: isoDate(firstMondayOnOrAfter(year, 2, 1)),
      name: year >= 2023 ? "St Brigid's Day" : "1 February",
      isPremiumPay: true,
    },
    // St Patrick's Day — 17 March
    { date: isoDate(new Date(year, 2, 17)), name: "St Patrick's Day", isPremiumPay: true },
    // Easter Monday
    { date: isoDate(easterMonday), name: "Easter Monday", isPremiumPay: true },
    // May Bank Holiday — first Monday in May
    { date: isoDate(firstMondayOf(year, 5)), name: "May Bank Holiday", isPremiumPay: true },
    // June Bank Holiday — first Monday in June
    { date: isoDate(firstMondayOf(year, 6)), name: "June Bank Holiday", isPremiumPay: true },
    // August Bank Holiday — first Monday in August
    { date: isoDate(firstMondayOf(year, 8)), name: "August Bank Holiday", isPremiumPay: true },
    // October Bank Holiday — last Monday in October
    {
      date: isoDate(lastMondayOf(year, 10)),
      name: "October Bank Holiday",
      isPremiumPay: true,
    },
    // Christmas Day — 25 December
    { date: isoDate(new Date(year, 11, 25)), name: "Christmas Day", isPremiumPay: true },
    // St Stephen's Day — 26 December
    { date: isoDate(new Date(year, 11, 26)), name: "St Stephen's Day", isPremiumPay: true },
  ];

  return holidays;
}

function lastMondayOf(year: number, month: number): Date {
  // Go to last day of month and walk back to Monday
  const lastDay = new Date(year, month, 0); // day 0 of next month = last day of this month
  const dow = lastDay.getDay();
  const diff = dow === 1 ? 0 : dow === 0 ? 6 : dow - 1;
  return new Date(year, month - 1, lastDay.getDate() - diff);
}

/** Check if a date string is an Irish public holiday */
export function getHolidayForDate(
  dateStr: string,
  year?: number
): PublicHoliday | undefined {
  const d = new Date(dateStr);
  const y = year ?? d.getFullYear();
  return getIrishPublicHolidays(y).find((h) => h.date === dateStr);
}

/** Get all holidays in a date range */
export function getHolidaysInRange(from: Date, to: Date): PublicHoliday[] {
  const years = new Set<number>();
  for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.add(y);

  const all: PublicHoliday[] = [];
  for (const y of years) all.push(...getIrishPublicHolidays(y));

  return all.filter((h) => {
    const d = new Date(h.date);
    return d >= from && d <= to;
  });
}
