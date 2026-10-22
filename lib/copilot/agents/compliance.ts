/**
 * Compliance Monitor — one daily list of food-safety, staff and allergen risks.
 *
 * Rules (all deterministic):
 *  - HACCP: scheduled checks that are past due (60 min grace) and not logged,
 *    today and yesterday; failed checks in the last 7 days with no later pass
 *    or corrective action.
 *  - Certificates: expired or expiring within 30 days. An expired food-safety
 *    or alcohol certificate on someone rostered in the next 7 days is high.
 *  - Rest: < 11 hours between two rostered shifts for the same person in the
 *    next 7 days (EU Working Time Directive daily rest, Ireland & UK).
 *  - Allergens: active dishes whose allergen matrix was never confirmed, or not
 *    in the last 180 days.
 *  - Ops tasks: one-off tasks past their due date and still open.
 */
import { prisma } from "@/lib/db";
import { AGENT_LABELS, type AgentResult, type CopilotScope, type Finding, sortFindings, statusFromFindings } from "../types";
import { addDaysYmd, dayStartUtc, localYmd, weekdayOfYmd, zonedToUtc } from "../time";

export const CHECK_LABELS: Record<string, string> = {
  fridge_temp: "Fridge temperature",
  freezer_temp: "Freezer temperature",
  hot_holding: "Hot holding",
  cooking_temp: "Cooking temperature",
  cooling: "Cooling record",
  delivery: "Delivery check",
  cleaning_daily: "Daily cleaning",
  cleaning_weekly: "Weekly cleaning",
  cleaning_deep: "Deep clean",
  opening_checks: "Opening checks",
  closing_checks: "Closing checks",
  pest_control: "Pest control",
  corrective_action: "Corrective action",
};

const CRITICAL_CERTS = new Set(["HACCP", "FOOD_SAFETY", "ALCOHOL"]);
const DUE_GRACE_MS = 60 * 60 * 1000;
/**
 * Minimum daily rest between shifts by market. Ireland/UK: 11h (Working Time
 * Directive / Regulations). Australia: 10h is the common award minimum.
 * Canada: 8h federal baseline. US: no general rule, so no check.
 */
export const MIN_REST_HOURS: Record<string, number | null> = { EUR: 11, GBP: 11, AUD: 10, CAD: 8, USD: null };
const ALLERGEN_STALE_DAYS = 180;
const DAY_MS = 86_400_000;

export interface ComplianceInput {
  now: Date;
  timezone: string;
  today: string;
  currency?: string;
  schedules: { checkType: string; times: unknown; daysOfWeek: unknown; active: boolean }[];
  records: { checkType: string; checkedAt: Date; status: string }[];
  certs: {
    id: string;
    title: string;
    category: string;
    expiryDate: Date | null;
    employeeId: string;
    employeeLabel: string;
  }[];
  shifts: { id: string; employeeId: string | null; employeeLabel: string; startTime: Date; endTime: Date }[];
  dishes: { id: string; name: string; allergenCheckedAt: Date | null }[];
  tasks: { id: string; title: string; dueDate: Date | null }[];
}

const label = (t: string) => CHECK_LABELS[t] ?? t.replace(/_/g, " ");
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function missedChecks(input: ComplianceInput, ymd: string): { checkType: string; due: number; done: number }[] {
  const weekday = weekdayOfYmd(ymd);
  const start = dayStartUtc(ymd, input.timezone).getTime();
  const end = dayStartUtc(addDaysYmd(ymd, 1), input.timezone).getTime();
  const out: { checkType: string; due: number; done: number }[] = [];
  for (const s of input.schedules) {
    if (!s.active) continue;
    const days = Array.isArray(s.daysOfWeek) ? (s.daysOfWeek as number[]) : [];
    if (days.length > 0 && !days.includes(weekday)) continue;
    const times = (Array.isArray(s.times) ? (s.times as string[]) : []).filter((t) => /^\d{1,2}:\d{2}$/.test(t));
    const due = times.filter((t) => zonedToUtc(ymd, t, input.timezone).getTime() + DUE_GRACE_MS <= input.now.getTime()).length;
    if (due === 0) continue;
    const done = input.records.filter(
      (r) => r.checkType === s.checkType && r.checkedAt.getTime() >= start && r.checkedAt.getTime() < end,
    ).length;
    if (done < due) out.push({ checkType: s.checkType, due, done });
  }
  return out;
}

export function computeCompliance(input: ComplianceInput): Omit<AgentResult, "agent" | "label"> {
  const findings: Finding[] = [];
  const { now, today } = input;
  const yesterday = addDaysYmd(today, -1);

  // ── HACCP: missed scheduled checks ────────────────────────────────────────
  let missedToday = 0;
  for (const [ymd, sev, word] of [
    [today, "high", "today"],
    [yesterday, "medium", "yesterday"],
  ] as const) {
    for (const m of missedChecks(input, ymd)) {
      const missed = m.due - m.done;
      if (ymd === today) missedToday += missed;
      findings.push({
        id: `haccp-missed-${m.checkType}-${ymd}`,
        severity: sev,
        title: `${label(m.checkType)}: ${missed} of ${m.due} scheduled ${m.due === 1 ? "check" : "checks"} not logged ${word}`,
        detail: "Log it now, or record why it was missed — an inspector will look for the gap.",
        href: "/haccp",
        subjects: [{ type: "check", label: label(m.checkType) }],
      });
    }
  }

  // ── HACCP: unresolved fails in the last 7 days ────────────────────────────
  const weekAgo = now.getTime() - 7 * DAY_MS;
  const fails = input.records.filter((r) => r.status === "fail" && r.checkedAt.getTime() >= weekAgo);
  let unresolvedFails = 0;
  const failTypes = new Map<string, number>();
  for (const f of fails) {
    const resolved = input.records.some(
      (r) =>
        r.checkedAt.getTime() > f.checkedAt.getTime() &&
        ((r.checkType === f.checkType && r.status === "pass") || r.checkType === "corrective_action"),
    );
    if (!resolved) {
      unresolvedFails++;
      failTypes.set(f.checkType, (failTypes.get(f.checkType) ?? 0) + 1);
    }
  }
  for (const [type, n] of failTypes) {
    findings.push({
      id: `haccp-fail-${type}`,
      severity: "high",
      title: `${label(type)} failed ${n === 1 ? "once" : `${n} times`} this week with no passing re-check or corrective action`,
      detail: "Re-check, and log the corrective action taken (discarded food, engineer called, etc.).",
      href: "/haccp",
      subjects: [{ type: "check", label: label(type) }],
    });
  }

  // ── Certificates ─────────────────────────────────────────────────────────
  const weekAhead = now.getTime() + 7 * DAY_MS;
  const rostered = new Set(
    input.shifts
      .filter((s) => s.employeeId && s.startTime.getTime() >= now.getTime() - 12 * 3600_000 && s.startTime.getTime() <= weekAhead)
      .map((s) => s.employeeId as string),
  );
  const expiredOnRota: ComplianceInput["certs"] = [];
  const expiredOther: ComplianceInput["certs"] = [];
  const expiringSoon: ComplianceInput["certs"] = [];
  for (const c of input.certs) {
    if (!c.expiryDate) continue;
    const t = c.expiryDate.getTime();
    if (t < now.getTime()) {
      (CRITICAL_CERTS.has(c.category) && rostered.has(c.employeeId) ? expiredOnRota : expiredOther).push(c);
    } else if (t <= now.getTime() + 30 * DAY_MS) {
      expiringSoon.push(c);
    }
  }
  if (expiredOnRota.length) {
    findings.push({
      id: "certs-expired-rostered",
      severity: "high",
      title: `${plural(expiredOnRota.length, "rostered staff member")} with an expired food-safety or alcohol certificate`,
      detail: "They are on the rota in the next 7 days. Book the refresher or adjust the rota.",
      href: "/training",
      subjects: expiredOnRota.map((c) => ({ type: "employee", id: c.employeeId, label: `${c.employeeLabel} — ${c.title}` })),
    });
  }
  if (expiredOther.length) {
    findings.push({
      id: "certs-expired",
      severity: "medium",
      title: `${plural(expiredOther.length, "certificate")} expired`,
      href: "/training",
      subjects: expiredOther.map((c) => ({ type: "employee", id: c.employeeId, label: `${c.employeeLabel} — ${c.title}` })),
    });
  }
  if (expiringSoon.length) {
    const within14 = expiringSoon.some((c) => (c.expiryDate as Date).getTime() <= now.getTime() + 14 * DAY_MS);
    findings.push({
      id: "certs-expiring",
      severity: within14 ? "medium" : "low",
      title: `${plural(expiringSoon.length, "certificate")} expiring in the next 30 days`,
      href: "/training",
      subjects: expiringSoon.map((c) => ({
        type: "employee",
        id: c.employeeId,
        label: `${c.employeeLabel} — ${c.title} (${localYmd(c.expiryDate as Date, input.timezone)})`,
      })),
    });
  }

  // ── Rest-gap breaches on the upcoming rota ───────────────────────────────
  const byEmp = new Map<string, ComplianceInput["shifts"]>();
  for (const s of input.shifts) {
    if (!s.employeeId) continue;
    const list = byEmp.get(s.employeeId) ?? [];
    list.push(s);
    byEmp.set(s.employeeId, list);
  }
  const minRest = MIN_REST_HOURS[input.currency ?? "EUR"] ?? null;
  const restBreaches: { employeeId: string; label: string; hours: number; at: Date }[] = [];
  for (const [employeeId, list] of minRest ? byEmp : new Map<string, ComplianceInput["shifts"]>()) {
    list.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.startTime.getTime() < now.getTime()) continue; // only the upcoming rota
      const gapH = (cur.startTime.getTime() - prev.endTime.getTime()) / 3600_000;
      // gap <= 0 is an overlap/split shift on the same day — not a rest period.
      if (gapH > 0 && gapH < (minRest as number) && localYmd(prev.startTime, input.timezone) !== localYmd(cur.startTime, input.timezone)) {
        restBreaches.push({ employeeId, label: cur.employeeLabel, hours: Math.round(gapH * 10) / 10, at: cur.startTime });
      }
    }
  }
  if (restBreaches.length) {
    findings.push({
      id: "rest-gaps",
      severity: "high",
      title: `${plural(restBreaches.length, "shift")} on the rota leave less than ${minRest} hours' rest since the previous shift`,
      detail: `${minRest} consecutive hours' daily rest is the legal minimum where you trade. Move a start or an end time.`,
      href: "/rota",
      subjects: restBreaches.map((b) => ({
        type: "employee",
        id: b.employeeId,
        label: `${b.label} — ${b.hours}h before ${localYmd(b.at, input.timezone)}`,
      })),
    });
  }

  // ── Allergen matrix freshness ────────────────────────────────────────────
  const never = input.dishes.filter((d) => !d.allergenCheckedAt);
  const stale = input.dishes.filter(
    (d) => d.allergenCheckedAt && now.getTime() - d.allergenCheckedAt.getTime() > ALLERGEN_STALE_DAYS * DAY_MS,
  );
  if (never.length) {
    findings.push({
      id: "allergens-never",
      severity: "medium",
      title: `${plural(never.length, "active dish", "active dishes")} with an allergen matrix nobody has confirmed`,
      detail: "Confirm the 14 allergens against the supplier spec and tick 'checked' on each dish.",
      href: "/recipes",
      subjects: never.slice(0, 20).map((d) => ({ type: "dish", id: d.id, label: d.name })),
    });
  }
  if (stale.length) {
    findings.push({
      id: "allergens-stale",
      severity: "low",
      title: `${plural(stale.length, "dish", "dishes")} not allergen-checked in over ${ALLERGEN_STALE_DAYS} days`,
      href: "/recipes",
      subjects: stale.slice(0, 20).map((d) => ({ type: "dish", id: d.id, label: d.name })),
    });
  }

  // ── Overdue one-off tasks ────────────────────────────────────────────────
  const overdue = input.tasks.filter((t) => t.dueDate && t.dueDate.getTime() < now.getTime());
  if (overdue.length) {
    findings.push({
      id: "tasks-overdue",
      severity: "medium",
      title: `${plural(overdue.length, "ops task")} past due`,
      href: "/log-book",
      subjects: overdue.slice(0, 20).map((t) => ({ type: "task", id: t.id, label: t.title })),
    });
  }

  const sorted = sortFindings(findings);
  const high = sorted.filter((f) => f.severity === "high").length;
  return {
    status: statusFromFindings(sorted),
    headline:
      sorted.length === 0
        ? "Nothing outstanding: checks logged, certificates in date, rota rest gaps OK."
        : high
          ? `${plural(high, "compliance issue")} to deal with today.`
          : `${plural(sorted.length, "item")} to keep an eye on.`,
    businessWide: true,
    findings: sorted,
    metrics: {
      missedChecksToday: missedToday,
      unresolvedFails,
      certsExpired: expiredOnRota.length + expiredOther.length,
      certsExpiring: expiringSoon.length,
      restBreaches: restBreaches.length,
      dishesUnchecked: never.length,
      tasksOverdue: overdue.length,
    },
  };
}

export function employeeLabel(e: { firstName?: string | null; lastName?: string | null } | null | undefined): string {
  if (!e) return "Unassigned";
  const last = e.lastName?.trim();
  return `${e.firstName ?? ""}${last ? " " + last[0] + "." : ""}`.trim() || "Staff member";
}

export async function runCompliance(scope: CopilotScope): Promise<AgentResult> {
  const { businessId, now, timezone, date: today, venueId } = scope;
  const since = dayStartUtc(addDaysYmd(today, -8), timezone);
  const until = new Date(now.getTime() + 8 * DAY_MS);

  const [schedules, records, certs, shifts, dishes, tasks] = await Promise.all([
    prisma.hACCPSchedule.findMany({ where: { businessId, active: true } }),
    prisma.hACCPRecord.findMany({
      where: { businessId, checkedAt: { gte: since } },
      select: { checkType: true, checkedAt: true, status: true },
    }),
    prisma.trainingCertification.findMany({
      where: { businessId, expiryDate: { not: null, lte: new Date(now.getTime() + 30 * DAY_MS) }, employee: { active: true } },
      select: {
        id: true,
        title: true,
        category: true,
        expiryDate: true,
        employeeId: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.shift.findMany({
      where: {
        employee: { businessId },
        startTime: { gte: new Date(now.getTime() - 2 * DAY_MS), lte: until },
        ...(venueId ? { venueId } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        startTime: true,
        endTime: true,
        employee: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.dish.findMany({
      where: { businessId, active: true },
      select: { id: true, name: true, allergenCheckedAt: true },
    }),
    prisma.opsTask.findMany({
      where: {
        businessId,
        completed: false,
        frequency: "once",
        dueDate: { not: null, lt: now },
        ...(venueId ? { OR: [{ venueId }, { venueId: null }] } : {}),
      },
      select: { id: true, title: true, dueDate: true },
      take: 100,
    }),
  ]);

  const out = computeCompliance({
    now,
    timezone,
    today,
    currency: scope.currency,
    schedules,
    records,
    certs: certs.map((c) => ({ ...c, employeeLabel: employeeLabel(c.employee) })),
    shifts: shifts.map((s) => ({ ...s, employeeLabel: employeeLabel(s.employee) })),
    dishes,
    tasks,
  });
  return { agent: "compliance", label: AGENT_LABELS.compliance, ...out };
}
