// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { managerService, addManagerSchema } from "@/lib/services/manager.service";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN");
  if (isResponse(session)) return session;

  const body = await req.json();
  const parsed = addManagerSchema.safeParse({ ...body, businessId: session.user.businessId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const manager = await managerService.add(parsed.data);
    return NextResponse.json({ manager }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
