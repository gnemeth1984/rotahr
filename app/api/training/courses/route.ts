// @ts-nocheck
export const dynamic = "force-dynamic";

/**
 * GET /api/training/courses
 *
 * Lists the in-house courses and who has done them. Any signed-in employee can
 * see the list and their own status; the roster of everybody else is only
 * returned to someone with the "training" permission.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { COURSES } from "@/lib/training/courses";
import { CLEANING_CHECK_TYPES } from "@/lib/training/kit";

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + months);
  return out;
}

function statusOf(completedAt: Date | null, validMonths: number) {
  if (!completedAt) return { status: "NOT_STARTED", expiresAt: null as Date | null };
  const expiresAt = addMonths(completedAt, validMonths);
  const days = (expiresAt.getTime() - Date.now()) / 86400000;
  if (days < 0) return { status: "EXPIRED", expiresAt };
  if (days <= 30) return { status: "EXPIRING_SOON", expiresAt };
  return { status: "VALID", expiresAt };
}

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ courses: [], me: null, roster: null });

  const me = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true, firstName: true, lastName: true },
  });

  // Menu and equipment readiness — course quality depends on both, so surface
  // them here rather than making somebody find out inside a lesson.
  const [
    dishCount,
    checkedCount,
    assetCount,
    stockCount,
    haccpCount,
    cleaningCount,
    deliveryCount,
    customerCount,
    shiftCount,
    breakCount,
  ] = await Promise.all([
    prisma.dish.count({ where: { businessId, active: true } }),
    prisma.dish.count({
      where: { businessId, active: true, allergenCheckedAt: { not: null } },
    }),
    prisma.asset.count({ where: { businessId, status: { not: "retired" } } }),
    prisma.stockItem.count({ where: { businessId } }),
    prisma.hACCPEquipment.count({ where: { businessId } }),
      prisma.hACCPRecord.count({
        where: { businessId, checkType: { in: [...CLEANING_CHECK_TYPES] } },
      }),
      prisma.hACCPRecord.count({ where: { businessId, checkType: "delivery" } }),
      prisma.customer.count({ where: { businessId } }),
      // Shift hangs off the employee, not the business, so the count goes
      // through the venue's own staff.
      prisma.shift.count({ where: { employee: { businessId } } }),
      prisma.clockEvent.count({ where: { businessId, type: "break_start" } }),
    ]);

  const completions = await prisma.courseCompletion.findMany({
    where: { businessId, passed: true },
    select: {
      id: true,
      employeeId: true,
      courseSlug: true,
      score: true,
      total: true,
      completedAt: true,
    },
    orderBy: { completedAt: "desc" },
  });

  // Latest passing attempt per employee per course.
  const latest = new Map<string, (typeof completions)[number]>();
  for (const c of completions) {
    const key = `${c.employeeId}:${c.courseSlug}`;
    if (!latest.has(key)) latest.set(key, c);
  }

  const canSeeRoster = !isResponse(await requirePermission("training"));

  let employees: { id: string; firstName: string; lastName: string }[] = [];
  if (canSeeRoster) {
    employees = await prisma.employee.findMany({
      where: { businessId, active: true },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
  }

  const courses = COURSES.map((c) => {
    const mine = me ? latest.get(`${me.id}:${c.slug}`) : undefined;
    const mineStatus = statusOf(mine?.completedAt ?? null, c.validMonths);

    const roster = canSeeRoster
      ? employees.map((e) => {
          const done = latest.get(`${e.id}:${c.slug}`);
          const s = statusOf(done?.completedAt ?? null, c.validMonths);
          return {
            employeeId: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
            completedAt: done?.completedAt ?? null,
            score: done ? `${done.score}/${done.total}` : null,
            status: s.status,
            expiresAt: s.expiresAt,
          };
        })
      : null;

    return {
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      minutes: c.minutes,
      validMonths: c.validMonths,
      passMark: c.passMark,
      usesMenu: c.usesMenu,
      usesAssets: c.usesAssets,
      usesStock: c.usesStock,
      usesHaccp: c.usesHaccp,
      usesCleaning: c.usesCleaning,
      usesDeliveries: c.usesDeliveries,
      usesCustomers: c.usesCustomers,
      usesShifts: c.usesShifts,
      mine: {
        completedAt: mine?.completedAt ?? null,
        score: mine ? `${mine.score}/${mine.total}` : null,
        status: mineStatus.status,
        expiresAt: mineStatus.expiresAt,
      },
      roster,
      rosterDone: roster ? roster.filter((r) => r.status === "VALID").length : null,
      rosterTotal: roster ? roster.length : null,
    };
  });

  return NextResponse.json({
    courses,
    me: me ? { id: me.id, name: `${me.firstName} ${me.lastName}`.trim() } : null,
    canSeeRoster,
    menu: { dishes: dishCount, checked: checkedCount },
    equipment: { assets: assetCount },
    stock: { items: stockCount },
    haccp: { units: haccpCount },
    cleaning: { records: cleaningCount },
    deliveries: { records: deliveryCount },
    customers: { profiles: customerCount },
    shifts: { total: shiftCount, breaksRecorded: breakCount },
  });
}
