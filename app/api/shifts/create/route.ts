// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { shiftService, createShiftSchema } from "@/lib/services/shift.service";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createShiftSchema.safeParse({ ...body, businessId: session.user.businessId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const shift = await shiftService.create(parsed.data, session.user.businessId);
    return NextResponse.json({ shift }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
