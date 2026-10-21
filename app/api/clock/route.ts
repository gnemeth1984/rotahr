// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { computeShiftState, getBreakEntitlement } from "@/lib/services/clock.service";
import { logActivity } from "@/lib/services/activity.service";
import { computeAccess, readOnlyPayload } from "@/lib/billing/access";
import { evaluateGeofence, resolveGeofence } from "@/lib/geo/geofence";

// GET — current clock status + today's events
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });
  const { searchParams } = new URL(req.url);
  const employeeId = searchParams.get("employeeId");
  const allStaff = searchParams.get("allStaff") === "true";

  const me = await prisma.employee.findFirst({ where: { userId: session.user.id, businessId } });
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

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });
  const { type, note, latitude, longitude, accuracy } = await req.json();

  if (!["in", "out", "break_start", "break_end"].includes(type)) {
    return NextResponse.json({ error: "type must be 'in', 'out', 'break_start' or 'break_end'" }, { status: 400 });
  }

  // Read-only gate, handled here rather than in middleware because the whole
  // decision is in the body: this one route covers both clock in and clock out.
  //
  // Clocking IN starts new work, so an expired trial blocks it. Clocking OUT,
  // and ending a break, must ALWAYS work — someone is standing in a kitchen
  // right now and their pay depends on this timestamp. A paywall that strands
  // an open timesheet is a payroll problem, not a conversion tactic.
  if (type === "in") {
    const biz = await prisma.business.findUnique({
      where: { id: businessId },
      select: { lsStatus: true, trialEndsAt: true, foundingMember: true },
    });
    // A founding member past their term is in "rota" mode, where clocking in
    // stays free forever — so only true read-only blocks it here.
    const access = computeAccess({
      lsStatus: biz?.lsStatus,
      trialEndsAt: biz?.trialEndsAt,
      foundingMember: biz?.foundingMember,
    });
    if (access.mode === "readonly") {
      return NextResponse.json(readOnlyPayload(access), { status: 402 });
    }
  }

  const me = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true, venueId: true },
  });
  if (!me) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Server-side geofence. The browser check on the clock page is advisory only —
  // anyone can POST here directly — so the decision has to be made again here.
  //
  // Clock IN is blocked when the premises pin is set and the device is not
  // within the radius (or sends no location). Clock OUT and breaks are never
  // blocked — an open timesheet someone cannot close is a payroll problem —
  // but every event records where it happened so a manager can review it.
  const fence = await resolveGeofence(businessId, me.venueId);
  const geo = evaluateGeofence(fence, latitude, longitude, accuracy);
  if (type === "in" && fence && geo.status !== "inside") {
    return NextResponse.json(
      {
        error:
          geo.status === "no_location"
            ? "Location is required to clock in here. Allow location access and try again."
            : `You are ${geo.distanceM}m from the premises — you need to be within ${fence.radius}m to clock in.`,
        code: geo.status === "no_location" ? "GEO_REQUIRED" : "GEO_OUTSIDE",
        geoStatus: geo.status,
        distanceM: geo.distanceM,
        radiusM: fence.radius,
      },
      { status: 403 }
    );
  }

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
      note:
        geo.status === "outside" || (geo.status === "no_location" && type === "out")
          ? [note, `[Geofence: ${geo.status === "outside" ? `${geo.distanceM}m from premises` : "no location sent"}]`]
              .filter(Boolean)
              .join(" ")
          : note ?? null,
      latitude: geo.lat,
      longitude: geo.lng,
      geoStatus: geo.status,
      geoDistanceM: geo.distanceM,
    },
  });

  if (type === "in" || type === "out") {
    logActivity({
      businessId,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email,
      action: type === "in" ? "clock_in" : "clock_out",
      details: { employeeId: me.id },
    }).catch(() => {});
  }

  return NextResponse.json({ event });
}
