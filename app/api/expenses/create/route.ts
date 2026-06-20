// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { expenseService, createExpenseSchema } from "@/lib/services/expense.service";

export async function POST(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  try {
    const body = await req.json();
    const data = createExpenseSchema.parse({
      ...body,
      businessId: session.user.businessId ?? "christys-bar-seed-id",
      createdById: session.user.id,
    });
    const expense = await expenseService.create(data);
    return NextResponse.json({ expense });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed to create expense" }, { status: 400 });
  }
}
