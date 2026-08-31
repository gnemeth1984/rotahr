// @ts-nocheck
/**
 * Course assignments — shared resolution.
 *
 * A manager can make an in-house course required for the whole venue, one
 * department, one role, or one named person, with a due date. Rotahr then
 * chases it through the existing notification system.
 *
 * Both the API route and the nightly cron resolve assignments through this
 * file, so a status shown on screen and a status used to send a nudge can
 * never disagree. The status semantics are deliberately identical to
 * GET /api/training/courses (statusOf there), so the team board and the
 * assignment list always tell the same story.
 */

import { prisma } from "@/lib/db";
import { getCourse } from "@/lib/training/courses";

export const ASSIGNMENT_SCOPES = ["business", "department", "role", "employee"] as const;
export type AssignmentScope = (typeof ASSIGNMENT_SCOPES)[number];

export function isAssignmentScope(v: unknown): v is AssignmentScope {
  return typeof v === "string" && (ASSIGNMENT_SCOPES as readonly string[]).includes(v);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

/** Same rules as GET /api/training/courses. Kept byte-for-byte in behaviour. */
export function statusOf(completedAt: Date | null, validMonths: number) {
  if (!completedAt) return { status: "NOT_STARTED", expiresAt: null as Date | null };
  const expiresAt = addMonths(completedAt, validMonths);
  const days = (expiresAt.getTime() - Date.now()) / 86400000;
  if (days < 0) return { status: "EXPIRED", expiresAt };
  if (days <= 30) return { status: "EXPIRING_SOON", expiresAt };
  return { status: "VALID", expiresAt };
}

export type EmployeeLite = {
  id: string;
  firstName: string;
  lastName: string;
  role: string | null;
  departmentId: string | null;
  userId: string | null;
};

/** Active staff of one venue, with the fields every scope needs to resolve. */
export async function loadEmployees(businessId: string): Promise<EmployeeLite[]> {
  return prisma.employee.findMany({
    where: { businessId, active: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      departmentId: true,
      userId: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
}

/**
 * Latest passing attempt per employee per course, keyed `${employeeId}:${slug}`.
 * Same first-wins-on-desc pattern the courses route uses.
 */
export async function latestPassMap(businessId: string) {
  const completions = await prisma.courseCompletion.findMany({
    where: { businessId, passed: true },
    select: { employeeId: true, courseSlug: true, score: true, total: true, completedAt: true },
    orderBy: { completedAt: "desc" },
  });
  const latest = new Map<string, (typeof completions)[number]>();
  for (const c of completions) {
    const key = `${c.employeeId}:${c.courseSlug}`;
    if (!latest.has(key)) latest.set(key, c);
  }
  return latest;
}

export type AssignmentLike = {
  id: string;
  courseSlug: string;
  scope: string;
  departmentId: string | null;
  role: string | null;
  employeeId: string | null;
};

/**
 * Which employees an assignment actually covers.
 *
 * Employee.role is free text and inconsistent across venues, so a role match is
 * case-insensitive and trimmed. Shift.role is dirtier still and is deliberately
 * never consulted here.
 */
export function targetsFor(a: AssignmentLike, employees: EmployeeLite[]): EmployeeLite[] {
  if (a.scope === "business") return employees;
  if (a.scope === "department") {
    if (!a.departmentId) return [];
    return employees.filter((e) => e.departmentId === a.departmentId);
  }
  if (a.scope === "role") {
    if (!a.role) return [];
    const want = a.role.trim().toLowerCase();
    return employees.filter((e) => (e.role || "").trim().toLowerCase() === want);
  }
  if (a.scope === "employee") {
    if (!a.employeeId) return [];
    return employees.filter((e) => e.id === a.employeeId);
  }
  return [];
}

export function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** Whole days from today until the due date. Negative means overdue. */
export function daysUntil(due: Date, now: Date = new Date()): number {
  return Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86400000);
}

export type ResolvedTarget = {
  employeeId: string;
  name: string;
  userId: string | null;
  status: string;
  completedAt: Date | null;
  expiresAt: Date | null;
  score: string | null;
};

export type ResolvedAssignment = {
  targets: ResolvedTarget[];
  done: number;
  total: number;
  outstanding: number;
  courseTitle: string;
  validMonths: number;
  daysUntilDue: number;
  overdue: boolean;
};

/**
 * Overlay training status onto an assignment's target list.
 *
 * "done" means the person holds a current pass — VALID. An EXPIRED or
 * EXPIRING_SOON record still counts as outstanding, because the point of the
 * assignment is that the venue can prove the training is current.
 */
export function resolveAssignment(
  a: AssignmentLike & { dueDate: Date },
  employees: EmployeeLite[],
  latest: Map<string, { score: number; total: number; completedAt: Date }>,
  now: Date = new Date()
): ResolvedAssignment {
  const course = getCourse(a.courseSlug);
  const validMonths = course?.validMonths ?? 12;

  const targets: ResolvedTarget[] = targetsFor(a, employees).map((e) => {
    const done = latest.get(`${e.id}:${a.courseSlug}`);
    const s = statusOf(done?.completedAt ?? null, validMonths);
    return {
      employeeId: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      userId: e.userId,
      status: s.status,
      completedAt: done?.completedAt ?? null,
      expiresAt: s.expiresAt,
      score: done ? `${done.score}/${done.total}` : null,
    };
  });

  const doneCount = targets.filter((t) => t.status === "VALID").length;
  const d = daysUntil(a.dueDate, now);

  return {
    targets,
    done: doneCount,
    total: targets.length,
    outstanding: targets.length - doneCount,
    courseTitle: course?.title ?? a.courseSlug,
    validMonths,
    daysUntilDue: d,
    overdue: d < 0,
  };
}
