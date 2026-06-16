// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { managerService } from "@/lib/services/manager.service";

export async function GET(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const managers = await managerService.list(session.user.businessId);
  return NextResponse.json({ managers });
}
