// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Webhook handler for external integrations (e.g., calendar systems, HR tools)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");

  if (secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { event, data } = body;

  switch (event) {
    case "booking.create": {
      const { customerName, customerPhone, customerEmail, partySize, date, time, businessId, tableId } = data;
      const reservation = await prisma.reservation.create({
        data: {
          customerName: customerName ?? "Webhook Guest",
          customerPhone: customerPhone ?? null,
          customerEmail: customerEmail ?? null,
          partySize: partySize ?? 1,
          date: new Date(date),
          time: time ?? "19:00",
          businessId,
          tableId: tableId ?? null,
        },
      });
      return NextResponse.json({ success: true, reservation });
    }

    case "booking.cancel": {
      const { reservationId } = data;
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { status: "cancelled" },
      });
      return NextResponse.json({ success: true });
    }

    case "timeoff.approve": {
      const { requestId } = data;
      await prisma.timeOffRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED" },
      });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json(
        { error: `Unknown event: ${event}` },
        { status: 400 }
      );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    supportedEvents: ["booking.create", "booking.cancel", "timeoff.approve"],
  });
}
