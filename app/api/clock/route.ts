// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { computeShiftState, getBreakEntitlement } from "@/lib/services/clock.service";

// GET — current clock status + today's events
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const allStaff = searchParams.get("allStaff") === "true";

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  const role = session.user.role;

  // Manager: all staff status view
  if (allStaff && (role === "MANAGER" || role === "ADMIN")) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const employees = await prisma.employee.findMany({
      where: { businessId, active: true },
      select: { id: true, firstName: true, lastName: true },
    });

    const clockEvents = await prisma.clockEvent.findMany({
      where: { businessId, timestamp: { gte: todayStart, lte: todayEnd } },
      orderBy: { timestamp: "asc" },
    });

    const staffStatuses = employees.map((emp) => {
      const empEvents = clockEvents.filter((e) => e.employeeId === emp.id);
      const last = empEvents[empEvents.length - 1];
      return {
        employeeId: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        status: last ? last.type : "no-events",
        lastEvent: last?.timestamp ?? null,
      };
    });

    return NextResponse.json({ staffStatuses });
  }

  // Single employee view
  const targetId = employeeId ?? me?.id;
  if (!targetId) return NextResponse.json({ error: "No employee found" }, { status: 404 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const events = await prisma.clockEvent.findMany({
    where: { employeeId: targetId, businessId, timestamp: { gte: todayStart, lte: todayEnd } },
    orderBy: { timestamp: "asc" },
  });

  const lastEvent = events[events.length - 1];

  const state = computeShiftState(events);
  const entitlement = getBreakEntitlement(state);
  const hoursToday = Math.round((state.workedMs / 3600000) * 100) / 100;

  return NextResponse.json({
    isClockedIn: state.isClockedIn,
    isOnBreak: state.isOnBreak,
    hoursToday,
    breakMinutesTaken: Math.round(state.breakMs / 60000),
    breakEntitlement: entitlement,
    events,
    lastEvent,
  });
}

// POST — clock in or out
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const { type, note, latitude, longitude } = await req.json();

  if (!["in", "out", "break_start", "break_end"].includes(type)) {
    return NextResponse.json({ error: "type must be 'in', 'out', 'break_start' or 'break_end'" }, { status: 400 });
  }

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id } });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  if (type === "break_start" || type === "break_end") {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todaysEvents = await prisma.clockEvent.findMany({
      where: { employeeId: me.id, businessId, timestamp: { gte: todayStart, lte: todayEnd } },
      orderBy: { timestamp: "asc" },
    });
    const state = computeShiftState(todaysEvents);
    if (type === "break_start" && !state.isClockedIn) {
      return NextResponse.json({ error: "Must be clocked in to start a break" }, { status: 400 });
    }
    if (type === "break_start" && state.isOnBreak) {
      return NextResponse.json({ error: "Already on break" }, { status: 400 });
    }
    if (type === "break_end" && !state.isOnBreak) {
      return NextResponse.json({ error: "Not currently on break" }, { status: 400 });
    }
  }

  const event = await prisma.clockEvent.create({
    data: {
      employeeId: me.id,
      businessId,
      type,
      note: note ?? null,
      latitude: latitude != null ? parseFloat(latitude) : null,
      longitude: longitude != null ? parseFloat(longitude) : null,
    },
  });

  return NextResponse.json({ event });
}
