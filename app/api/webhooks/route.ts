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
      const { userId, date, startTime, endTime, title } = data;
      const booking = await prisma.booking.create({
        data: { userId, date: new Date(date), startTime, endTime, title },
      });
      return NextResponse.json({ success: true, booking });
    }

    case "booking.cancel": {
      const { bookingId } = data;
      await prisma.booking.update({
        where: { id: bookingId },
        data: { status: "CANCELLED" },
      });
      return NextResponse.json({ success: true });
    }

    case "timeoff.approve": {
      const { requestId, managerId } = data;
      await prisma.timeOffRequest.update({
        where: { id: requestId },
        data: { status: "APPROVED", managedById: managerId },
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
