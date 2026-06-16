// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { tableService, createTableSchema } from "@/lib/services/table.service";
import { UserRole as Role } from "@/types/roles";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "No business associated with account" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const table = await tableService.create(parsed.data, businessId);
    return NextResponse.json({ table }, { status: 201 });
  } catch (err) {
    console.error("[tables/create]", err);
    return NextResponse.json({ error: "Failed to create table" }, { status: 500 });
  }
}
