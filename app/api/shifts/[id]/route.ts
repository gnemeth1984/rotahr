import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { shiftService, updateShiftSchema } from "@/lib/services/shift.service";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateShiftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const shift = await shiftService.update(params.id, session.user.businessId, parsed.data);
    return NextResponse.json({ shift });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
