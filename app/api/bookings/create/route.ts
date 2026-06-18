// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { reservationService } from "@/lib/services/reservation.service";
import { sendNotification } from "@/lib/services/notification.service";
import { detectConflicts } from "@/lib/ai/conflict-detection";
import { prisma } from "@/lib/db";
import { z } from "zod";

const CreateReservationSchema = z.object({
  customerName: z.string().min(1),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  partySize: z.number().int().min(1).max(50),
  date: z.string(), // ISO date string "YYYY-MM-DD"
  time: z.string(), // ISO datetime string or "HH:MM"
  tableId: z.string().optional(),
  notes: z.string().optional(),
  dietary: z.string().optional(),
  occasion: z.string().optional(),
  kitchenNotes: z.string().optional(),
  upsellNotes: z.string().optional(),
  skipConflictCheck: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateReservationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const data = parsed.data;

  // Conflict detection (unless explicitly skipped)
  if (!data.skipConflictCheck) {
    const proposedDate = new Date(data.date);
    if (/^\d{2}:\d{2}$/.test(data.time)) {
      const [h, m] = data.time.split(":").map(Number);
      proposedDate.setHours(h, m, 0, 0);
    }

    const conflicts = await detectConflicts({
      businessId,
      proposedDate,
      partySize: data.partySize,
      tableId: data.tableId,
    });

    if (!conflicts.canProceed) {
      return NextResponse.json({
        error: "Booking blocked due to conflicts",
        conflicts: conflicts.conflicts,
        canProceed: false,
      }, { status: 409 });
    }
  }

  try {
    const reservation = await reservationService.create(
      {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        partySize: data.partySize,
        date: data.date,
        time: data.time,
        tableId: data.tableId,
        notes: data.notes,
        dietary: data.dietary,
        occasion: data.occasion,
        kitchenNotes: data.kitchenNotes,
        upsellNotes: data.upsellNotes,
      },
      businessId,
      session.user.id
    );
    // Notify all managers & admins
    const managers = await prisma.employee.findMany({
      where: {
        businessId,
        role: { in: ["manager", "admin", "MANAGER", "ADMIN"] },
        active: true,
      },
      select: { id: true },
    });

    await Promise.allSettled(
      managers.map((m) =>
        sendNotification({
          reservationId: reservation.id,
          employeeId: m.id,
          message: `New booking: ${data.customerName}, party of ${data.partySize} on ${data.date} at ${data.time}`,
        })
      )
    );

    return NextResponse.json({ reservation }, { status: 201 });
  } catch (err) {
    console.error("[bookings/create]", err);
    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}
