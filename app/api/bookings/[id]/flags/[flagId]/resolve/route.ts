// @ts-nocheck
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { resolveFlag } from "@/lib/services/notification.service";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string; flagId: string } }
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

    const flag = await resolveFlag(params.flagId);
    return NextResponse.json({ flag });
  } catch (err) {
    console.error("PATCH /api/bookings/[id]/flags/[flagId]/resolve", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
