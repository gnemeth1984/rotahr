/**
 * Booking Forecast — final covers for each of the next 7 days from the
 * *pace* of bookings, then staffing guidance at the peak hour.
 *
 * Pace: for a target day D that is L days away, look at the same weekday in
 * each of the previous 8 weeks (H). For each H, count the covers that were
 * already on the books at the equivalent moment (same lead time, same time of
 * day) and the covers that actually came. The median of final ÷ on-the-books
 * is the pick-up multiplier for D. Needs ≥ 3 comparable weeks; otherwise falls
 * back to the weekday average, then to what is booked.
 *
 * Staffing: peak-hour covers ÷ AISettings ratios (kitchen, floor) and
 * minBarStaff, against the shifts on the rota for that hour. Suggestions only;
 * the rota is never changed.
 */
import { AGENT_LABELS, type AgentResult, type CopilotScope, type Finding, sortFindings, statusFromFindings } from "../types";
import { isNonAttending, normaliseReservationStatus } from "@/lib/reservations/status";
import { addDaysYmd, diffDaysYmd, formatYmd, parseHour, zonedToUtc } from "../time";
import { loadReservations, loadShifts, loadStaffingSettings, type ShiftRow, type StaffingSettings } from "../data";

const DAY_MS = 86_400_000;
const HISTORY_WEEKS = 8;
const MIN_PACE_WEEKS = 3;

export interface BookingRes {
  ymd: string;
  time: string;
  partySize: number;
  status: string;
  createdAt: Date;
}

export interface BookingsInput {
  now: Date;
  today: string;
  timezone: string;
  reservations: BookingRes[];
  shifts: Pick<ShiftRow, "ymd" | "startTime" | "endTime" | "bucket">[];
  settings: StaffingSettings;
  days?: number;
}

export interface DayForecast {
  ymd: string;
  booked: number;
  bookings: number;
  forecast: number;
  method: "pace" | "average" | "booked";
  multiplier: number | null;
  typical: number | null;
  peakHour: number | null;
  peakCovers: number;
  need: { kitchen: number; floor: number; bar: number };
  rota: { kitchen: number; floor: number; bar: number; total: number };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const attended = (status: string) => !isNonAttending(status);
const cancelled = (status: string) => normaliseReservationStatus(status) === "cancelled";

export function forecastDay(input: BookingsInput, ymd: string): DayForecast {
  const { now, today, settings } = input;
  const onDay = input.reservations.filter((r) => r.ymd === ymd);
  const live = onDay.filter((r) => attended(r.status));
  const booked = live.reduce((a, r) => a + r.partySize, 0);

  // Pace from the same weekday in previous weeks.
  const ratios: number[] = [];
  const finals: number[] = [];
  const histHourCovers = new Map<number, number>();
  for (let k = 1; k <= HISTORY_WEEKS; k++) {
    const h = addDaysYmd(ymd, -7 * k);
    if (h >= today) continue;
    const resH = input.reservations.filter((r) => r.ymd === h);
    if (!resH.length) continue;
    const final = resH.filter((r) => attended(r.status)).reduce((a, r) => a + r.partySize, 0);
    finals.push(final);
    for (const r of resH) {
      if (!attended(r.status)) continue;
      const hr = parseHour(r.time);
      if (hr != null) histHourCovers.set(hr, (histHourCovers.get(hr) ?? 0) + r.partySize);
    }
    const asOf = now.getTime() - diffDaysYmd(h, ymd) * DAY_MS;
    const onBooks = resH
      .filter((r) => r.createdAt.getTime() <= asOf && !cancelled(r.status))
      .reduce((a, r) => a + r.partySize, 0);
    if (onBooks > 0) ratios.push(final / onBooks);
  }

  const typical = finals.length ? Math.round(finals.reduce((a, b) => a + b, 0) / finals.length) : null;
  let forecast = booked;
  let method: DayForecast["method"] = "booked";
  let multiplier: number | null = null;
  if (ratios.length >= MIN_PACE_WEEKS && booked > 0) {
    multiplier = Math.min(4, Math.max(0.5, median(ratios)));
    forecast = Math.round(booked * multiplier);
    method = "pace";
  } else if (finals.length >= 2 && typical != null) {
    forecast = Math.max(booked, typical);
    method = "average";
  }

  // Peak hour: from today's bookings, else from history's shape.
  const hourCovers = new Map<number, number>();
  for (const r of live) {
    const hr = parseHour(r.time);
    if (hr != null) hourCovers.set(hr, (hourCovers.get(hr) ?? 0) + r.partySize);
  }
  const shape = booked > 0 ? hourCovers : histHourCovers;
  const shapeTotal = [...shape.values()].reduce((a, b) => a + b, 0);
  let peakHour: number | null = null;
  let peakShare = 0;
  for (const [hr, c] of shape) {
    if (c / (shapeTotal || 1) > peakShare) {
      peakShare = c / (shapeTotal || 1);
      peakHour = hr;
    }
  }
  const peakCovers = Math.round(forecast * peakShare);

  const need = {
    kitchen: peakCovers > 0 ? Math.max(1, Math.ceil(peakCovers / settings.kitchenRatio)) : 0,
    floor: peakCovers > 0 ? Math.max(1, Math.ceil(peakCovers / settings.floorRatio)) : 0,
    bar: peakCovers > 0 ? settings.minBarStaff : 0,
  };

  const rota = { kitchen: 0, floor: 0, bar: 0, total: 0 };
  const dayShifts = input.shifts.filter((s) => s.ymd === ymd);
  rota.total = dayShifts.length;
  if (peakHour != null) {
    const from = zonedToUtc(ymd, `${String(peakHour).padStart(2, "0")}:00`, input.timezone).getTime();
    const to = from + 3600_000;
    for (const s of dayShifts) {
      if (s.startTime.getTime() < to && s.endTime.getTime() > from && s.bucket !== "other") rota[s.bucket]++;
    }
  }

  return { ymd, booked, bookings: live.length, forecast, method, multiplier, typical, peakHour, peakCovers, need, rota };
}

const hh = (h: number | null) => (h == null ? "—" : `${String(h).padStart(2, "0")}:00`);

export function computeBookings(input: BookingsInput): Omit<AgentResult, "agent" | "label"> & { days: DayForecast[] } {
  const n = input.days ?? 7;
  const days = Array.from({ length: n }, (_, i) => forecastDay(input, addDaysYmd(input.today, i)));
  const findings: Finding[] = [];

  for (const d of days) {
    const lead = diffDaysYmd(input.today, d.ymd);
    const when = lead === 0 ? "Today" : lead === 1 ? "Tomorrow" : formatYmd(d.ymd);
    if (d.forecast < 10 || d.peakHour == null) continue;
    const shortK = d.need.kitchen - d.rota.kitchen;
    const shortF = d.need.floor - d.rota.floor;
    const shortB = d.need.bar - d.rota.bar;
    const soon = lead <= input.settings.rotaWarningDaysAhead;
    if (d.rota.total === 0) {
      findings.push({
        id: `nobody-${d.ymd}`,
        severity: soon ? "high" : "medium",
        title: `${when}: ~${d.forecast} covers forecast and nobody is on the rota yet`,
        href: "/rota",
      });
      continue;
    }
    if (shortK > 0 || shortF > 0 || shortB > 0) {
      const gaps = [shortK > 0 && `${shortK} kitchen`, shortF > 0 && `${shortF} floor`, shortB > 0 && `${shortB} bar`].filter(Boolean).join(", ");
      findings.push({
        id: `short-${d.ymd}`,
        severity: soon ? "high" : "medium",
        title: `${when}: short ${gaps} at the ${hh(d.peakHour)} peak (~${d.peakCovers} covers)`,
        detail: `Forecast ${d.forecast} covers (${d.booked} booked). Needs ${d.need.kitchen} kitchen / ${d.need.floor} floor / ${d.need.bar} bar on your ratios; rota has ${d.rota.kitchen} / ${d.rota.floor} / ${d.rota.bar}.`,
        href: "/rota",
      });
    } else if (d.method !== "booked" && d.rota.floor - d.need.floor >= 2 && d.rota.kitchen >= d.need.kitchen) {
      findings.push({
        id: `over-${d.ymd}`,
        severity: "low",
        title: `${when}: ${d.rota.floor} floor staff at the ${hh(d.peakHour)} peak for ~${d.peakCovers} covers — possible labour saving`,
        detail: `Your floor ratio needs ${d.need.floor}. Check before cutting: walk-ins aren't in the forecast.`,
        href: "/rota",
      });
    }
    if (d.typical != null && d.typical >= 10 && d.method !== "booked") {
      const vs = ((d.forecast - d.typical) / d.typical) * 100;
      if (Math.abs(vs) >= 30) {
        findings.push({
          id: `unusual-${d.ymd}`,
          severity: "low",
          title: `${when} is pacing ${vs > 0 ? "busier" : "quieter"} than a usual ${formatYmd(d.ymd).slice(0, 3)} (~${d.forecast} vs ~${d.typical} covers)`,
          detail: vs > 0 ? "Check prep levels and stock for the extra covers." : "A quiet night is a good one for a win-back offer to regulars.",
          href: "/bookings",
        });
      }
    }
  }

  const sorted = sortFindings(findings);
  const today = days[0];
  const weekBooked = days.reduce((a, d) => a + d.booked, 0);
  const weekForecast = days.reduce((a, d) => a + d.forecast, 0);
  return {
    status: statusFromFindings(sorted),
    headline:
      weekForecast === 0
        ? "No bookings or booking history for the next 7 days."
        : `Today ~${today.forecast} covers (${today.booked} booked). Next 7 days ~${weekForecast} covers, ${weekBooked} booked so far.`,
    findings: sorted,
    metrics: {
      todayBooked: today.booked,
      todayForecast: today.forecast,
      todayMethod: today.method,
      todayPeakHour: today.peakHour,
      weekBooked,
      weekForecast,
    },
    table: {
      columns: ["Day", "Booked", "Forecast", "Method", "Peak", "Need K/F/B", "Rota K/F/B"],
      rows: days.map((d) => [
        formatYmd(d.ymd),
        d.booked,
        d.forecast,
        d.method === "pace" ? `pace ×${d.multiplier?.toFixed(2)}` : d.method,
        d.peakHour == null ? "—" : `${hh(d.peakHour)} (~${d.peakCovers})`,
        d.peakHour == null ? "—" : `${d.need.kitchen}/${d.need.floor}/${d.need.bar}`,
        d.peakHour == null ? `${d.rota.total} shifts` : `${d.rota.kitchen}/${d.rota.floor}/${d.rota.bar}`,
      ]),
    },
    days,
  };
}

export async function runBookings(scope: CopilotScope): Promise<AgentResult & { days: DayForecast[] }> {
  const [reservations, shifts, settings] = await Promise.all([
    loadReservations(scope),
    loadShifts(scope),
    loadStaffingSettings(scope),
  ]);
  const out = computeBookings({ now: scope.now, today: scope.date, timezone: scope.timezone, reservations, shifts, settings });
  return { agent: "bookings", label: AGENT_LABELS.bookings, ...out };
}
