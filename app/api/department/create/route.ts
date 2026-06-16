// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { departmentService, createDepartmentSchema } from "@/lib/services/department.service";

export async function POST(req: NextRequest) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createDepartmentSchema.safeParse({ ...body, businessId: session.user.businessId });
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const department = await departmentService.create(parsed.data.name, parsed.data.businessId);
  return NextResponse.json({ department }, { status: 201 });
}
