// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  supplierId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  unit: z.string().optional(),
  category: z.string().optional(),
  lastPrice: z.number().optional().nullable(),
  reorderLevel: z.number().optional().nullable(),
  currentStock: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  lastExpenseId: z.string().optional().nullable(),
  lastOrdered: z.string().optional().nullable(),
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  const existing = await prisma.stockItem.findFirst({ where: { id: params.id, businessId: auth.businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: any = { ...result.data };
  if (data.lastOrdered) data.lastOrdered = new Date(data.lastOrdered);

  const item = await prisma.stockItem.update({
    where: { id: params.id },
    data,
    include: { supplier: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.stockItem.findFirst({ where: { id: params.id, businessId: auth.businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.stockItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
