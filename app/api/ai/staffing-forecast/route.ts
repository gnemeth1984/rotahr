// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { generateStaffingForecast } from "@/lib/ai/staffing-forecast";
import { UserRole as Role } from "@/types/roles";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");

  let targetDate: Date;
  if (dateParam) {
    targetDate = new Date(dateParam);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: "Invalid date parameter" }, { status: 400 });
    }
  } else {
    targetDate = new Date();
  }

  try {
    const forecast = await generateStaffingForecast(businessId, targetDate);
    return NextResponse.json({ forecast });
  } catch (err) {
    console.error("[ai/staffing-forecast]", err);
    return NextResponse.json({ error: "Failed to generate staffing forecast" }, { status: 500 });
  }
}
