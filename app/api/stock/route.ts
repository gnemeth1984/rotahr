// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { z } from "zod";

const stockSchema = z.object({
  name: z.string().min(1),
  supplierId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  unit: z.string().default("unit"),
  category: z.string().default("general"),
  lastPrice: z.number().optional().nullable(),
  reorderLevel: z.number().optional().nullable(),
  currentStock: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  lastExpenseId: z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;
  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const items = await prisma.stockItem.findMany({
    where: {
      businessId,
      ...(supplierId ? { supplierId } : {}),
      ...(category ? { category } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: [{ supplier: { name: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;
  const body = await req.json();
  const result = stockSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  const item = await prisma.stockItem.create({
    data: { businessId, ...result.data },
    include: { supplier: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ item }, { status: 201 });
}
