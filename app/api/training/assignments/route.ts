// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * GET/POST/DELETE /api/training/assignments
 *
 * Assign & chase. A manager makes an in-house course required for the whole
 * venue, a department, a role or one named person, with a due date. Rotahr then
 * nudges through the existing notification system (see the course-assignments
 * cron).
 *
 * GET returns "mine" to any signed-in employee — the courses they personally
 * have been told to do. The venue-wide list with per-assignment progress is
 * only returned to someone holding the "training" permission.
 *
 * Status semantics come from lib/training/assignments.ts, which mirrors
 * GET /api/training/courses exactly, so the team board and this list can never
 * disagree about whether somebody is up to date.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { COURSES, getCourse } from "@/lib/training/courses";
import {
  isAssignmentScope,
  loadEmployees,
  latestPassMap,
  resolveAssignment,
  targetsFor,
  daysUntil,
} from "@/lib/training/assignments";
import { logActivity } from "@/lib/services/activity.service";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) {
    return NextResponse.json({ mine: [], all: null, canAssign: false, roles: [], departments: [] });
  }

  const me = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true, role: true, departmentId: true },
  });

  const assignments = await prisma.courseAssignment.findMany({
    where: { businessId, active: true },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  const employees = await loadEmployees(businessId);
  const latest = await latestPassMap(businessId);

  // What this person has personally been told to do. Resolved through the same
  // helper, so a nudge and the badge on their course card always match.
  const mine: any[] = [];
  if (me) {
    for (const a of assignments) {
      const targets = targetsFor(a, employees);
      const hit = targets.find((t) => t.id === me.id);
      if (!hit) continue;
      const r = resolveAssignment(a, employees, latest);
      const mineRow = r.targets.find((t) => t.employeeId === me.id);
      mine.push({
        id: a.id,
        courseSlug: a.courseSlug,
        courseTitle: r.courseTitle,
        dueDate: a.dueDate,
        note: a.note,
        daysUntilDue: a.dueDate ? daysUntil(a.dueDate) : null,
        overdue: r.overdue,
        status: mineRow?.status ?? "NOT_STARTED",
        completedAt: mineRow?.completedAt ?? null,
        expiresAt: mineRow?.expiresAt ?? null,
      });
    }
  }

  const canAssign = !isResponse(await requirePermission("training"));

  if (!canAssign) {
    return NextResponse.json({
      mine,
      all: null,
      canAssign: false,
      roles: [],
      departments: [],
      courses: COURSES.map((c) => ({ slug: c.slug, title: c.title })),
    });
  }

  // Role options come from this venue's own distinct Employee.role strings.
  // Employee.role is free text and inconsistent across businesses, so the only
  // safe list is the one this venue actually uses. Shift.role is dirtier still
  // and is never consulted.
  const roles = Array.from(
    new Set(employees.map((e) => (e.role || "").trim()).filter((r) => r.length > 0))
  ).sort((a, b) => a.localeCompare(b));

  // Departments are clean, but two venues have none at all — the UI must cope
  // with an empty list rather than offering a scope that cannot resolve.
  const departments = await prisma.department.findMany({
    where: { businessId },
    select: { id: true, name: true, _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  });

  const all = assignments.map((a) => {
    const r = resolveAssignment(a, employees, latest);
    const dept = a.departmentId ? departments.find((d) => d.id === a.departmentId) : null;
    return {
      id: a.id,
      courseSlug: a.courseSlug,
      courseTitle: r.courseTitle,
      scope: a.scope,
      scopeLabel:
        a.scope === "business"
          ? "Everyone"
          : a.scope === "department"
            ? dept?.name
              ? `${dept.name} department`
              : "Department (removed)"
            : a.scope === "role"
              ? a.role || "Role"
              : r.targets[0]?.name || "One person",
      departmentId: a.departmentId,
      role: a.role,
      employeeId: a.employeeId,
      dueDate: a.dueDate,
      note: a.note,
      createdAt: a.createdAt,
      done: r.done,
      total: r.total,
      outstanding: r.outstanding,
      daysUntilDue: r.daysUntilDue,
      overdue: r.overdue,
      // Only the people still to do it — the whole point is who to chase.
      outstandingNames: r.targets
        .filter((t) => t.status !== "VALID")
        .map((t) => ({ employeeId: t.employeeId, name: t.name, status: t.status })),
    };
  });

  return NextResponse.json({
    mine,
    all,
    canAssign: true,
    roles,
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      employees: d._count.employees,
    })),
    employees: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`.trim(),
      role: e.role,
    })),
    courses: COURSES.map((c) => ({ slug: c.slug, title: c.title, minutes: c.minutes })),
  });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("training");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const { courseSlug, scope, departmentId, role, employeeId, dueDate, note } = body || {};

  // Courses are code, not rows, so the slug is validated here rather than by a
  // foreign key.
  if (!courseSlug || !getCourse(courseSlug)) {
    return NextResponse.json({ error: "Unknown course" }, { status: 400 });
  }
  if (!isAssignmentScope(scope)) {
    return NextResponse.json({ error: "scope must be business, department, role or employee" }, { status: 400 });
  }
  if (!dueDate) return NextResponse.json({ error: "dueDate required" }, { status: 400 });

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) {
    return NextResponse.json({ error: "dueDate is not a date" }, { status: 400 });
  }
  // Store the end of the chosen day, so a course due "today" is not overdue at
  // 09:00 on the day it was set.
  due.setHours(23, 59, 59, 999);

  // Each scope must carry the one field it resolves through, and that field must
  // belong to this business.
  let deptId: string | null = null;
  let roleStr: string | null = null;
  let empId: string | null = null;

  if (scope === "department") {
    if (!departmentId) return NextResponse.json({ error: "departmentId required" }, { status: 400 });
    const dept = await prisma.department.findFirst({
      where: { id: departmentId, businessId },
      select: { id: true },
    });
    if (!dept) return NextResponse.json({ error: "Department not found" }, { status: 404 });
    deptId = dept.id;
  }

  if (scope === "role") {
    const wanted = String(role || "").trim();
    if (!wanted) return NextResponse.json({ error: "role required" }, { status: 400 });
    const exists = await prisma.employee.findFirst({
      where: { businessId, active: true, role: { equals: wanted, mode: "insensitive" } },
      select: { id: true },
    });
    if (!exists) return NextResponse.json({ error: "No active staff hold that role" }, { status: 400 });
    roleStr = wanted;
  }

  if (scope === "employee") {
    if (!employeeId) return NextResponse.json({ error: "employeeId required" }, { status: 400 });
    const emp = await prisma.employee.findFirst({
      where: { id: employeeId, businessId },
      select: { id: true },
    });
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    empId = emp.id;
  }

  const created = await prisma.courseAssignment.create({
    data: {
      businessId,
      courseSlug,
      scope,
      departmentId: deptId,
      role: roleStr,
      employeeId: empId,
      dueDate: due,
      note: note ? String(note).slice(0, 500) : null,
      createdById: session.user.id,
    },
  });

  // logActivity takes `details` as an object, and never personal data — it
  // feeds Navigator, which feeds an external model. Slug, scope and count only.
  logActivity({
    businessId,
    userId: session.user.id,
    userName: session.user.name,
    action: "course_assigned",
    details: { courseSlug, scope, assignmentId: created.id },
  });

  return NextResponse.json({ assignment: created }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requirePermission("training");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.courseAssignment.findFirst({
    where: { id, businessId },
    select: { id: true, courseSlug: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Deactivated rather than deleted — the completions it caused stay meaningful,
  // and a manager can see what was once required.
  await prisma.courseAssignment.update({ where: { id }, data: { active: false } });

  logActivity({
    businessId,
    userId: session.user.id,
    userName: session.user.name,
    action: "course_assignment_removed",
    details: { courseSlug: existing.courseSlug, assignmentId: id },
  });

  return NextResponse.json({ ok: true });
}
