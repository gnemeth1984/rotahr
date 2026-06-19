// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requireRole, isResponse } from "@/lib/auth/middleware";
import { employeeService, updateEmployeeSchema } from "@/lib/services/employee.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const employee = await employeeService.getById(params.id, session.user.businessId);
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  return NextResponse.json({ employee });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return PUT(req, { params });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireRole("ADMIN", "MANAGER");
  if (isResponse(session)) return session;

  if (!session.user.businessId) {
    return NextResponse.json({ error: "No business associated" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const employee = await employeeService.update(params.id, session.user.businessId, parsed.data);
    return NextResponse.json({ employee });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
