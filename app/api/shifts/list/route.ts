import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { shiftService } from "@/lib/services/shift.service";

export async function GET(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const filters = {
    employeeId: searchParams.get("employeeId") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    published: searchParams.has("published") ? searchParams.get("published") === "true" : undefined,
  };

  const shifts = await shiftService.list(session.user.businessId, filters);
  return NextResponse.json({ shifts });
}
