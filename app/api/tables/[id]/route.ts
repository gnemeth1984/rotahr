// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { tableService, updateTableSchema } from "@/lib/services/table.service";
import { UserRole as Role } from "@/types/roles";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

  const parsed = updateTableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const table = await tableService.update(params.id, businessId, parsed.data);
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ table });
  } catch (err) {
    console.error("[tables/[id] PATCH]", err);
    return NextResponse.json({ error: "Failed to update table" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
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

  try {
    const table = await tableService.remove(params.id, businessId);
    if (!table) return NextResponse.json({ error: "Table not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tables/[id] DELETE]", err);
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
  }
}
