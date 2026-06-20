// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { expenseService, updateExpenseSchema } from "@/lib/services/expense.service";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  try {
    const body = await req.json();
    const data = updateExpenseSchema.parse(body);
    const expense = await expenseService.update(params.id, businessId, data);
    return NextResponse.json({ expense });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// DELETE — soft delete only (TCA 1997 s.886: VAT records must be retained 6 years)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  try {
    await expenseService.softDelete(params.id, businessId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
