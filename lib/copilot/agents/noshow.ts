/**
 * No-show Guard — which upcoming bookings are most likely not to turn up, how
 * many covers to actually expect, and a ready-to-send confirmation message.
 *
 * The score is a transparent additive model, not a black box, so a manager can
 * see *why* a booking is flagged:
 *
 *   base         this venue's own no-show rate over the last 180 days
 *                (clamped 2–20%; 5% when there is too little history)
 *   + 0.22       per previous no-show by the same guest (max 3 counted)
 *   + 0.06       per previous cancellation (max 3 counted)
 *   + 0.05       first-time guest (no previous visits on record)
 *   × 0.6        regular (3+ attended visits and no no-shows)
 *   + 0.05       booked 21+ days ahead      − 0.02 booked same day
 *   + 0.03/0.06  party of 6+ / 8+
 *   − 0.02       an occasion is noted (birthdays turn up)
 *
 * The guest is matched by customerId, else by email, else by phone, across the
 * whole business (a guest who no-showed at one venue is the same guest).
 * Nothing is sent: findings carry a draft message the manager can copy.
 */
import { prisma } from "@/lib/db";
import { normaliseReservationStatus } from "@/lib/reservations/status";
import { AGENT_LABELS, type AgentResult, type CopilotScope, type Finding, sortFindings, statusFromFindings } from "../types";
import { addDaysYmd, diffDaysYmd, formatYmd, ymdToStoredRange } from "../time";
import { loadReservations, type ResRow } from "../data";

export const NOSHOW_AHEAD_DAYS = 14;
const FINDING_DAYS = 7;
const HIGH_RISK = 0.35;
const MEDIUM_RISK = 0.2;

export interface GuestHistory {
  noShows: number;
  cancels: number;
  attended: number;
}

export interface NoShowBooking {
  id: string;
  ymd: string;
  time: string;
  partySize: number;
  status: string;
  createdAt: Date;
  occasion: string | null;
  visitCount: number;
  guestFirstName: string;
  guestLabel: string;
  history: GuestHistory;
}

export interface NoShowInput {
  today: string;
  businessName: string;
  /** Venue's own no-show rate, or null when too little history. */
  baseRate: number | null;
  bookings: NoShowBooking[];
}

export interface ScoredBooking extends NoShowBooking {
  risk: number;
  band: "high" | "medium" | "low";
  reasons: string[];
  expectedCovers: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function scoreBooking(b: NoShowBooking, baseRate: number | null): ScoredBooking {
  const reasons: string[] = [];
  let p = baseRate == null ? 0.05 : clamp(baseRate, 0.02, 0.2);
  const h = b.history;
  if (h.noShows > 0) {
    p += 0.22 * Math.min(3, h.noShows);
    reasons.push(`${plural(h.noShows, "previous no-show")}`);
  }
  if (h.cancels > 0) {
    p += 0.06 * Math.min(3, h.cancels);
    reasons.push(`${plural(h.cancels, "previous cancellation")}`);
  }
  const visits = Math.max(h.attended, b.visitCount);
  if (visits === 0 && h.noShows === 0 && h.cancels === 0) {
    p += 0.05;
    reasons.push("first visit");
  } else if (visits >= 3 && h.noShows === 0) {
    p *= 0.6;
    reasons.push(`regular (${visits} visits)`);
  }
  const lead = diffDaysYmd(b.createdAt.toISOString().slice(0, 10), b.ymd);
  if (lead >= 21) {
    p += 0.05;
    reasons.push(`booked ${lead} days ahead`);
  } else if (lead <= 0) {
    p -= 0.02;
  }
  if (b.partySize >= 8) {
    p += 0.06;
    reasons.push(`party of ${b.partySize}`);
  } else if (b.partySize >= 6) {
    p += 0.03;
    reasons.push(`party of ${b.partySize}`);
  }
  if (b.occasion && b.occasion.trim()) p -= 0.02;
  const risk = clamp(p, 0.01, 0.9);
  const band = risk >= HIGH_RISK ? "high" : risk >= MEDIUM_RISK ? "medium" : "low";
  return { ...b, risk, band, reasons, expectedCovers: b.partySize * (1 - risk) };
}

export function confirmationDraft(b: Pick<NoShowBooking, "guestFirstName" | "partySize" | "ymd" | "time">, businessName: string): string {
  const name = b.guestFirstName ? ` ${b.guestFirstName}` : "";
  return (
    `Hi${name}, it's ${businessName}. Just confirming your table for ${b.partySize} on ${formatYmd(b.ymd)} at ${b.time}. ` +
    `Could you reply to let us know you're still coming? If plans have changed, no problem — just tell us so we can offer the table to someone else. Thanks!`
  );
}

export function computeNoShow(input: NoShowInput): Omit<AgentResult, "agent" | "label"> & { scored: ScoredBooking[] } {
  const scored = input.bookings.map((b) => scoreBooking(b, input.baseRate)).sort((a, b) => (a.ymd + a.time).localeCompare(b.ymd + b.time));
  const findings: Finding[] = [];
  const lastFindingDay = addDaysYmd(input.today, FINDING_DAYS - 1);

  for (const s of scored) {
    if (s.ymd > lastFindingDay) continue;
    if (s.band === "low") continue;
    const lead = diffDaysYmd(input.today, s.ymd);
    const when = lead === 0 ? "Today" : lead === 1 ? "Tomorrow" : formatYmd(s.ymd);
    const deposit = s.partySize >= 8 || s.history.noShows >= 2;
    const action = deposit ? "call to confirm, and consider a deposit for future bookings" : "send a confirmation";
    // A medium risk only becomes a finding when it is a big table or soon.
    if (s.band === "medium" && s.partySize < 6 && lead > 1) continue;
    findings.push({
      id: `noshow-${s.id}`,
      severity: s.band === "high" && lead <= 2 ? "high" : s.band === "high" ? "medium" : "low",
      title: `${when} ${s.time}, party of ${s.partySize}: ${pct(s.risk)} no-show risk — ${action}`,
      detail: s.reasons.length ? `Why: ${s.reasons.join(", ")}.` : undefined,
      href: "/bookings",
      subjects: [{ type: "reservation", id: s.id, label: `${s.guestLabel} · ${formatYmd(s.ymd)} ${s.time} · ${s.partySize} covers` }],
      draft: { kind: "message", label: "Confirmation message", text: confirmationDraft(s, input.businessName) },
    });
  }

  // Per-day expected covers.
  const days = Array.from({ length: NOSHOW_AHEAD_DAYS }, (_, i) => addDaysYmd(input.today, i));
  const rows = days
    .map((d) => {
      const on = scored.filter((s) => s.ymd === d);
      const covers = on.reduce((a, s) => a + s.partySize, 0);
      const expected = on.reduce((a, s) => a + s.expectedCovers, 0);
      const risky = on.filter((s) => s.band === "high").length;
      return { d, n: on.length, covers, expected, risky };
    })
    .filter((r) => r.n > 0);

  const todayRow = rows.find((r) => r.d === input.today);
  const weekRows = rows.filter((r) => r.d <= lastFindingDay);
  const weekCovers = weekRows.reduce((a, r) => a + r.covers, 0);
  const weekExpected = Math.round(weekRows.reduce((a, r) => a + r.expected, 0));
  const highRisk = scored.filter((s) => s.band === "high" && s.ymd <= lastFindingDay).length;

  const sorted = sortFindings(findings).slice(0, 15);
  return {
    status: statusFromFindings(sorted),
    headline:
      scored.length === 0
        ? "No upcoming bookings to check."
        : `${todayRow ? `Today ~${Math.round(todayRow.expected)} of ${todayRow.covers} booked covers expected. ` : ""}` +
          `Next 7 days ~${weekExpected} of ${weekCovers} covers; ${plural(highRisk, "high-risk booking")}.`,
    findings: sorted,
    metrics: {
      upcomingBookings: scored.length,
      weekCoversBooked: weekCovers,
      weekCoversExpected: weekExpected,
      highRisk,
      venueNoShowRate: input.baseRate == null ? null : Math.round(input.baseRate * 1000) / 10,
    },
    table: {
      columns: ["Day", "Bookings", "Covers", "Expected", "High risk"],
      rows: rows.map((r) => [formatYmd(r.d), r.n, r.covers, Math.round(r.expected), r.risky]),
    },
    scored,
  };
}

/** Upcoming = still expected to arrive (pending/confirmed), from today. */
export function isUpcoming(r: Pick<ResRow, "status" | "ymd">, today: string): boolean {
  const s = normaliseReservationStatus(r.status);
  return (s === "confirmed" || s === "pending") && r.ymd >= today;
}

const keyOf = (r: { customerId: string | null; customerEmail: string | null; customerPhone: string | null }) => {
  const keys: string[] = [];
  if (r.customerId) keys.push(`c:${r.customerId}`);
  const e = r.customerEmail?.trim().toLowerCase();
  if (e) keys.push(`e:${e}`);
  const p = r.customerPhone?.replace(/[^\d+]/g, "");
  if (p && p.replace(/\D/g, "").length >= 7) keys.push(`p:${p}`);
  return keys;
};

export function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}

export async function runNoShow(scope: CopilotScope): Promise<AgentResult & { scored: ScoredBooking[] }> {
  const all = await loadReservations(scope);
  const lastDay = addDaysYmd(scope.date, NOSHOW_AHEAD_DAYS - 1);
  const upcoming = all.filter((r) => isUpcoming(r, scope.date) && r.ymd <= lastDay);

  // Venue base rate from the last 180 days of finished bookings.
  const past = all.filter((r) => r.ymd < scope.date);
  const finished = past.filter((r) => {
    const s = normaliseReservationStatus(r.status);
    return s === "completed" || s === "seated" || s === "no_show";
  });
  const pastNoShows = finished.filter((r) => normaliseReservationStatus(r.status) === "no_show").length;
  const baseRate = finished.length >= 30 ? pastNoShows / finished.length : null;

  // Guest history across the whole business, matched by id/email/phone.
  const ids = [...new Set(upcoming.map((r) => r.customerId).filter(Boolean) as string[])];
  const emails = [
    ...new Set(upcoming.flatMap((r) => { const e = r.customerEmail?.trim(); return e ? [e, e.toLowerCase()] : []; })),
  ];
  const phones = [...new Set(upcoming.map((r) => r.customerPhone?.trim()).filter(Boolean) as string[])];
  const history = new Map<string, Map<string, string>>(); // key → (reservationId → status)
  if (upcoming.length && (ids.length || emails.length || phones.length)) {
    const prior = await prisma.reservation.findMany({
      where: {
        businessId: scope.businessId,
        date: { ...ymdToStoredRange(addDaysYmd(scope.date, -730), addDaysYmd(scope.date, -1)) },
        OR: [
          ...(ids.length ? [{ customerId: { in: ids } }] : []),
          ...(emails.length ? [{ customerEmail: { in: emails } }] : []),
          ...(phones.length ? [{ customerPhone: { in: phones } }] : []),
        ],
      },
      select: { id: true, status: true, customerId: true, customerEmail: true, customerPhone: true },
      take: 5000,
    });
    for (const p of prior) {
      for (const k of keyOf(p)) {
        const m = history.get(k) ?? new Map<string, string>();
        m.set(p.id, p.status);
        history.set(k, m);
      }
    }
  }

  const bookings: NoShowBooking[] = upcoming.map((r) => {
    // Union of all prior bookings matched by any of this guest's keys, deduped by reservation id.
    const seen = new Map<string, string>();
    for (const k of keyOf(r)) for (const [id, st] of history.get(k) ?? []) seen.set(id, st);
    const h: GuestHistory = { noShows: 0, cancels: 0, attended: 0 };
    for (const st of seen.values()) {
      const s = normaliseReservationStatus(st);
      if (s === "no_show") h.noShows++;
      else if (s === "cancelled") h.cancels++;
      else if (s === "completed" || s === "seated") h.attended++;
    }
    return {
      id: r.id,
      ymd: r.ymd,
      time: r.time,
      partySize: r.partySize,
      status: r.status,
      createdAt: r.createdAt,
      occasion: r.occasion,
      visitCount: r.customer?.visitCount ?? 0,
      guestFirstName: firstName(r.customerName),
      guestLabel: r.customerName || "Guest",
      history: h,
    };
  });

  const out = computeNoShow({ today: scope.date, businessName: scope.businessName, baseRate, bookings });
  return { agent: "noshow", label: AGENT_LABELS.noshow, ...out };
}

