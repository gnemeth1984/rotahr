// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { expenseService, updateExpenseSchema } from "@/lib/services/expense.service";
import { UserRole as Role } from "@/types/roles";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.MANAGER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
// Sets status to "deleted" — record remains in DB, excluded from all views/exports.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.MANAGER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  try {
    await expenseService.softDelete(params.id, businessId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
