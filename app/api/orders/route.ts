// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const createOrderSchema = z.object({
  supplierId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(z.object({
    stockItemId: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1),
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

export async function GET(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const supplierId = searchParams.get("supplierId");
  const status = searchParams.get("status");

  const orders = await prisma.supplierOrder.findMany({
    where: {
      businessId: auth.businessId,
      ...(supplierId ? { supplierId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      items: {
        include: { stockItem: { select: { id: true, name: true, unit: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orders });
}

export async function POST(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const result = createOrderSchema.safeParse(body);
  if (!result.success)
    return NextResponse.json({ error: "Invalid input", details: result.error.flatten() }, { status: 400 });

  // Verify supplier belongs to this business
  const supplier = await prisma.supplier.findFirst({
    where: { id: result.data.supplierId, businessId: auth.businessId },
  });
  if (!supplier) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const order = await prisma.supplierOrder.create({
    data: {
      businessId: auth.businessId,
      supplierId: result.data.supplierId,
      notes: result.data.notes,
      items: {
        create: result.data.items.map((item) => ({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice ?? null,
          notes: item.notes ?? null,
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      items: {
        include: { stockItem: { select: { id: true, name: true, unit: true } } },
      },
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}
