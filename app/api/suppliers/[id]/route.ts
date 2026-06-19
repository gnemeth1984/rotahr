// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  contactName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

async function requireManager(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) return null;
  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) return null;
  return { session, businessId };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.id, businessId: auth.businessId },
    include: {
      stockItems: { orderBy: { name: "asc" } },
      _count: { select: { orders: true } },
    },
  });

  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ supplier });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  const existing = await prisma.supplier.findFirst({ where: { id: params.id, businessId: auth.businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supplier = await prisma.supplier.update({ where: { id: params.id }, data: result.data });
  return NextResponse.json({ supplier });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.supplier.findFirst({ where: { id: params.id, businessId: auth.businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete
  await prisma.supplier.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
