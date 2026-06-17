// @ts-nocheck
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getFlagsForReservation } from "@/lib/services/notification.service";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const flags = await getFlagsForReservation(params.id);
    return NextResponse.json({ flags });
  } catch (err) {
    console.error("GET /api/bookings/[id]/flags", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
