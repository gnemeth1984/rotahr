// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireBusiness, isResponse } from "@/lib/auth/middleware";
import { businessService } from "@/lib/services/business.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireBusiness(params.id, "ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  const business = await businessService.getById(params.id);
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  return NextResponse.json({ business });
}
