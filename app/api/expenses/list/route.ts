// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { expenseService } from "@/lib/services/expense.service";

export async function GET(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const { searchParams } = new URL(req.url);
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  try {
    const expenses = await expenseService.list(businessId, {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });
    return NextResponse.json({ expenses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
