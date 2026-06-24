// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/services/appNotification.service";

// POST — manager approves or rejects a pending swap
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId;
  const body = await req.json();
  const { swapId, decision, managerNote } = body; // decision: "approved" | "rejected"

  if (!swapId || !decision) return NextResponse.json({ error: "swapId and decision required" }, { status: 400 });

  const swap = await prisma.shiftSwapRequest.findUnique({
    where: { id: swapId },
    include: {
      offerer: { select: { userId: true, firstName: true } },
      receiver: { select: { userId: true, firstName: true } },
    },
  });
  if (!swap || swap.businessId !== businessId) {
    return NextResponse.json({ error: "Swap not found" }, { status: 404 });
  }
  if (swap.status !== "pending") {
    return NextResponse.json({ error: "Swap is not pending" }, { status: 400 });
  }

  if (decision === "approved") {
    // Reassign the offered shift to the receiver
    await prisma.shift.update({
      where: { id: swap.offeredShiftId },
      data: { employeeId: swap.receiverId },
    });
    // If receiver's shift was part of the deal, reassign it to offerer
    if (swap.receiverShiftId) {
      await prisma.shift.update({
        where: { id: swap.receiverShiftId },
        data: { employeeId: swap.offererId },
      });
    }
    await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: "approved", managedById: session.user.id, managerNote: managerNote ?? null },
    });

    // Notify both parties
    if (swap.offerer.userId) {
      await createNotification({ userId: swap.offerer.userId, type: "shift", title: "Shift swap approved", body: "Your shift swap request was approved by management." });
    }
    if (swap.receiver?.userId) {
      await createNotification({ userId: swap.receiver.userId, type: "shift", title: "Shift swap approved", body: `Your shift swap with ${swap.offerer.firstName} was approved.` });
    }
  } else {
    await prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: "rejected", managedById: session.user.id, managerNote: managerNote ?? null },
    });
    if (swap.receiver?.userId) {
      await createNotification({ userId: swap.receiver.userId, type: "shift", title: "Shift swap rejected", body: `The swap request was not approved. ${managerNote ?? ""}` });
    }
  }

  return NextResponse.json({ ok: true, decision });
}
