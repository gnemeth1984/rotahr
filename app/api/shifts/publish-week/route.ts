// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { notifyUsers } from "@/lib/services/appNotification.service";
import { format } from "date-fns";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const body = await req.json();
  const { mondayDate } = body;

  if (!mondayDate) {
    return NextResponse.json({ error: "mondayDate required" }, { status: 400 });
  }

  const monday = new Date(mondayDate);
  monday.setHours(0, 0, 0, 0);

  if (monday.getDay() !== 1) {
    return NextResponse.json({ error: "mondayDate must be a Monday" }, { status: 400 });
  }

  const templates = await prisma.shiftTemplate.findMany({
    where: { businessId, active: true },
    include: {
      employee: { select: { id: true, departmentId: true } },
    },
  });

  if (templates.length === 0) {
    return NextResponse.json({ created: 0, message: "No active templates found" });
  }

  const shiftsToCreate = [];

  for (const tmpl of templates) {
    let offset: number;
    if (tmpl.dayOfWeek === 0) {
      offset = 6;
    } else {
      offset = tmpl.dayOfWeek - 1;
    }

    const shiftDate = new Date(monday);
    shiftDate.setDate(monday.getDate() + offset);

    const startTime = new Date(shiftDate);
    startTime.setHours(tmpl.startHour, tmpl.startMinute, 0, 0);

    const endTime = new Date(shiftDate);
    endTime.setHours(tmpl.endHour, tmpl.endMinute, 0, 0);

    if (endTime <= startTime) {
      endTime.setDate(endTime.getDate() + 1);
    }

    const existing = await prisma.shift.findFirst({
      where: { businessId, employeeId: tmpl.employeeId, startTime },
    });

    if (!existing) {
      shiftsToCreate.push({
        businessId,
        employeeId: tmpl.employeeId,
        departmentId: tmpl.employee.departmentId ?? null,
        startTime,
        endTime,
        role: tmpl.role ?? null,
        status: "SCHEDULED",
      });
    }
  }

  const created = await prisma.shift.createMany({ data: shiftsToCreate });

  // Notify all affected employees
  if (created.count > 0) {
    const employeeIds = [...new Set(shiftsToCreate.map((s) => s.employeeId).filter(Boolean))];
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { userId: true },
    });
    const userIds = employees.map((e) => e.userId).filter(Boolean) as string[];
    if (userIds.length > 0) {
      const weekStr = format(monday, "MMM d");
      await notifyUsers(userIds, {
        type: "rota",
        title: "Rota published",
        body: `Your schedule for the week of ${weekStr} is now available.`,
        link: "/shifts",
      });
    }
  }

  return NextResponse.json({ created: created.count, skipped: templates.length - created.count });
}
