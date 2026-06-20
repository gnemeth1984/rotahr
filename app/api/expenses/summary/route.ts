// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { expenseService } from "@/lib/services/expense.service";

export async function GET(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const from = searchParams.get("from") ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const to = searchParams.get("to") ?? new Date().toISOString();

  try {
    const summary = await expenseService.summary(businessId, from, to);
    return NextResponse.json({ summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
