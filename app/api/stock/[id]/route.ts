// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
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

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;
  const body = await req.json();
  const result = updateSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  const existing = await prisma.stockItem.findFirst({ where: { id: params.id, businessId } });
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
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;
  const existing = await prisma.stockItem.findFirst({ where: { id: params.id, businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.stockItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
