// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET  — list swap requests for the business (managers see all; staff see their own)
// POST — offer a shift for swap
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  // Find the employee record for this user
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true },
  });

  const where = isManager
    ? { businessId }
    : { businessId, OR: [{ offererId: employee?.id }, { receiverId: employee?.id }] };

  const swaps = await prisma.shiftSwapRequest.findMany({
    where,
    include: {
      offerer: { select: { id: true, firstName: true, lastName: true } },
      receiver: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Attach shift details
  const shiftIds = [
    ...swaps.map((s) => s.offeredShiftId),
    ...swaps.map((s) => s.receiverShiftId).filter(Boolean),
  ];
  const shifts = await prisma.shift.findMany({
    where: { id: { in: shiftIds } },
    select: { id: true, date: true, startTime: true, endTime: true, role: true },
  });
  const shiftMap = Object.fromEntries(shifts.map((s) => [s.id, s]));

  const result = swaps.map((s) => ({
    ...s,
    offeredShift: shiftMap[s.offeredShiftId] ?? null,
    receiverShift: s.receiverShiftId ? (shiftMap[s.receiverShiftId] ?? null) : null,
  }));

  return NextResponse.json({ swaps: result });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { offeredShiftId, receiverShiftId } = body;
  if (!offeredShiftId) return NextResponse.json({ error: "offeredShiftId required" }, { status: 400 });

  // Confirm shift belongs to this employee
  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true },
  });
  if (!employee) return NextResponse.json({ error: "No employee record" }, { status: 400 });

  const shift = await prisma.shift.findUnique({ where: { id: offeredShiftId } });
  if (!shift || shift.employeeId !== employee.id) {
    return NextResponse.json({ error: "Shift not found or not yours" }, { status: 404 });
  }

  // Check no open swap already exists for this shift
  const existing = await prisma.shiftSwapRequest.findFirst({
    where: { offeredShiftId, status: { in: ["open", "pending"] } },
  });
  if (existing) return NextResponse.json({ error: "Swap already pending for this shift" }, { status: 409 });

  const swap = await prisma.shiftSwapRequest.create({
    data: {
      businessId,
      offererId: employee.id,
      offeredShiftId,
      receiverShiftId: receiverShiftId ?? null,
      status: "open",
    },
  });

  return NextResponse.json({ swap }, { status: 201 });
}

// PATCH — staff accepts an open swap
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businessId = session.user.businessId;
  const body = await req.json();
  const { swapId, action } = body; // action: "accept" | "cancel"

  const employee = await prisma.employee.findFirst({
    where: { userId: session.user.id, businessId },
    select: { id: true },
  });
  if (!employee) return NextResponse.json({ error: "No employee record" }, { status: 400 });

  const swap = await prisma.shiftSwapRequest.findUnique({ where: { id: swapId } });
  if (!swap || swap.businessId !== businessId) {
    return NextResponse.json({ error: "Swap not found" }, { status: 404 });
  }

  if (action === "accept") {
    if (swap.status !== "open") return NextResponse.json({ error: "Swap not open" }, { status: 400 });
    if (swap.offererId === employee.id) return NextResponse.json({ error: "Cannot accept your own swap" }, { status: 400 });

    // EU Working Time Directive check — ensure receiver won't breach 11h rest
    // (basic: check no shift within 11h of offered shift)
    const offeredShift = await prisma.shift.findUnique({ where: { id: swap.offeredShiftId } });
    const tenHoursMs = 11 * 60 * 60 * 1000;
    const nearbyShifts = await prisma.shift.findMany({
      where: {
        employeeId: employee.id,
        startTime: {
          gte: new Date(new Date(offeredShift.startTime).getTime() - tenHoursMs),
          lte: new Date(new Date(offeredShift.endTime).getTime() + tenHoursMs),
        },
      },
    });
    if (nearbyShifts.length > 0) {
      return NextResponse.json({
        error: "Cannot accept — this shift breaches the 11-hour rest requirement (Working Time Act 1997).",
      }, { status: 422 });
    }

    await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { receiverId: employee.id, status: "pending" },
    });
    return NextResponse.json({ ok: true, status: "pending" });
  }

  if (action === "cancel") {
    if (swap.offererId !== employee.id) return NextResponse.json({ error: "Not your swap" }, { status: 403 });
    await prisma.shiftSwapRequest.update({ where: { id: swapId }, data: { status: "cancelled" } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
