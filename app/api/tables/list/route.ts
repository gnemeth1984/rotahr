// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { tableService } from "@/lib/services/table.service";

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
  const dateParam = searchParams.get("date");
  const timeParam = searchParams.get("time");
  const partySizeParam = searchParams.get("partySize");

  try {
    // If date + time + partySize provided, return available tables only
    if (dateParam && timeParam && partySizeParam) {
      const partySize = parseInt(partySizeParam, 10);
      if (isNaN(partySize) || partySize < 1) {
        return NextResponse.json({ error: "Invalid partySize" }, { status: 400 });
      }

      const dateTime = new Date(dateParam);
      if (/^\d{2}:\d{2}$/.test(timeParam)) {
        const [h, m] = timeParam.split(":").map(Number);
        dateTime.setHours(h, m, 0, 0);
      }

      if (isNaN(dateTime.getTime())) {
        return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
      }

      const tables = await tableService.findAvailable(businessId, partySize, dateTime);
      return NextResponse.json({ tables, available: true });
    }

    const tables = await tableService.list(businessId);
    return NextResponse.json({ tables });
  } catch (err) {
    console.error("[tables/list]", err);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}
