// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import {
  getEmployeeByEmail,
  getNotificationsForEmployee,
} from "@/lib/services/notification.service";

export async function GET() {
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
      return NextResponse.json({ notifications: [] });
    }

    const notifications = await getNotificationsForEmployee(employee.id);
    return NextResponse.json({ notifications });
  } catch (err) {
    console.error("GET /api/notifications/list", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
