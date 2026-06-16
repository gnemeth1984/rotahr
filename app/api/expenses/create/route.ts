// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { expenseService, createExpenseSchema } from "@/lib/services/expense.service";
import { UserRole as Role } from "@/types/roles";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.MANAGER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
