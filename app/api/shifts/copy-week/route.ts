// @ts-nocheck
// Copy all shifts from one week to another
// POST /api/shifts/copy-week { fromMonday: "YYYY-MM-DD", toMonday: "YYYY-MM-DD", keepAssignments: boolean }
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const { fromMonday, toMonday, keepAssignments = true } = await req.json();
  if (!fromMonday || !toMonday) {
    return NextResponse.json({ error: "fromMonday and toMonday required" }, { status: 400 });
  }

  const from = new Date(fromMonday);
  const to = new Date(toMonday);
  const fromSunday = new Date(from);
  fromSunday.setDate(from.getDate() + 6);
  fromSunday.setHours(23, 59, 59, 999);
  from.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((to.getTime() - from.getTime()) / 86400000);

  // Get all employees for this business to validate ownership
  const bizEmployees = await prisma.employee.findMany({
    where: { businessId },
    select: { id: true },
  });
  const empIds = new Set(bizEmployees.map((e) => e.id));

  const sourceShifts = await prisma.shift.findMany({
    where: {
      employeeId: { in: Array.from(empIds) },
      date: { gte: from, lte: fromSunday },
    },
  });

  if (sourceShifts.length === 0) {
    return NextResponse.json({ error: "No shifts found in source week", copied: 0 }, { status: 404 });
  }

  // Check if target week already has shifts
  const toSunday = new Date(to);
  toSunday.setDate(to.getDate() + 6);
  toSunday.setHours(23, 59, 59, 999);
  to.setHours(0, 0, 0, 0);

  const existingCount = await prisma.shift.count({
    where: {
      employeeId: { in: Array.from(empIds) },
      date: { gte: to, lte: toSunday },
    },
  });

  // Create copies
  const created = await prisma.$transaction(
    sourceShifts.map((s) => {
      const newDate = new Date(s.date);
      newDate.setDate(newDate.getDate() + dayDiff);
      const newStart = new Date(s.startTime);
      newStart.setDate(newStart.getDate() + dayDiff);
      const newEnd = new Date(s.endTime);
      newEnd.setDate(newEnd.getDate() + dayDiff);

      return prisma.shift.create({
        data: {
          date: newDate,
          startTime: newStart,
          endTime: newEnd,
          role: s.role,
          published: false, // always create as draft
          employeeId: keepAssignments ? s.employeeId : null,
          venueId: s.venueId ?? null,
          overtimeHours: 0,
        },
      });
    })
  );

  return NextResponse.json({
    copied: created.length,
    targetWeek: toMonday,
    existingShiftsInTarget: existingCount,
  });
}
