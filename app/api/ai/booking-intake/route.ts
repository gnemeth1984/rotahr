// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { processBookingIntake } from "@/lib/ai/booking-intake";
import { reservationService } from "@/lib/services/reservation.service";
import { sendNotification } from "@/lib/services/notification.service";
import { prisma } from "@/lib/db";
import { z } from "zod";

const IntakeSchema = z.object({
  message: z.string().min(1),
  autoCreate: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = ((session.user as any).businessId as string | undefined) ?? "christys-bar-seed-id";


  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = IntakeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  const { message, autoCreate } = parsed.data;

  try {
    const intake = await processBookingIntake(message, businessId);

    let reservation = null;
    let blockedReason: string | null = null;

    if (autoCreate && !intake.canCreate) {
      const missing: string[] = [];
      if (!intake.parsed.customerName) missing.push("customer name");
      if (!intake.parsed.partySize) missing.push("party size");
      if (!intake.parsed.date || !intake.parsed.time) missing.push("date/time");
      blockedReason = `Could not auto-create — missing: ${missing.join(", ")}. Please add these details to your message.`;
    }

    if (autoCreate && intake.canCreate) {
      reservation = await reservationService.create(
        {
          customerName: intake.parsed.customerName,
          customerEmail: intake.parsed.customerEmail ?? undefined,
          customerPhone: intake.parsed.customerPhone ?? undefined,
          partySize: intake.parsed.partySize,
          date: intake.parsed.date,
          time: intake.parsed.time,
          notes: intake.parsed.notes ?? undefined,
          dietary: intake.parsed.dietary ?? undefined,
          occasion: intake.parsed.occasion ?? undefined,
          tableId: intake.tableAssignment.tableId ?? undefined,
          kitchenNotes: intake.kitchenNotes,
          upsellNotes: intake.upsellSuggestions,
          aiWarnings: intake.warnings.join("\n"),
          aiTranscript: message,
        },
        businessId,
        session.user.id
      );
    }

    // Notify all managers & admins in the business when a booking is auto-created
    if (reservation) {
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
            message: `New booking via AI: ${intake.parsed.customerName}, party of ${intake.parsed.partySize} on ${intake.parsed.date} at ${intake.parsed.time}`,
          })
        )
      );
    }

    return NextResponse.json({
      intake,
      reservation,
      autoCreated: reservation !== null,
      blockedReason,
    });
  } catch (err: any) {
    console.error("[ai/booking-intake]", err?.message ?? err);
    return NextResponse.json({ error: err?.message ?? "Booking intake failed" }, { status: 500 });
  }
}
