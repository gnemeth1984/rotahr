import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { reservationService } from "@/lib/services/reservation.service";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  try {
    const reservations = await reservationService.list(businessId, { date, status });
    return NextResponse.json({ reservations });
  } catch (err) {
    console.error("[bookings/list]", err);
    return NextResponse.json({ error: "Failed to fetch reservations" }, { status: 500 });
  }
}
