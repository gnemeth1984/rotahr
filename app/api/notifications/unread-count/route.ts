// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  getEmployeeByEmail,
  getUnreadCount,
} from "@/lib/services/notification.service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ count: 0 });
    }

    const businessId = session.user.businessId;
    if (!businessId) {
      return NextResponse.json({ count: 0 });
    }

    const employee = await getEmployeeByEmail(session.user.email, businessId);
    if (!employee) {
      return NextResponse.json({ count: 0 });
    }

    const count = await getUnreadCount(employee.id);
    return NextResponse.json({ count });
  } catch (err) {
    console.error("GET /api/notifications/unread-count", err);
    return NextResponse.json({ count: 0 });
  }
}
