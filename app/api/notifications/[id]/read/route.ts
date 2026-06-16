// @ts-nocheck
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getEmployeeByEmail,
  markRead,
} from "@/lib/services/notification.service";

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ error: "No business" }, { status: 400 });
    }

    const employee = await getEmployeeByEmail(session.user.email, businessId);
    if (!employee) {
      return NextResponse.json({ error: "Not an employee" }, { status: 403 });
    }

    await markRead(params.id, employee.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/notifications/[id]/read", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
