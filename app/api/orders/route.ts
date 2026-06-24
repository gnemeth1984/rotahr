// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";
import { z } from "zod";

const orderItemSchema = z.union([
  // Existing stock item
  z.object({
    stockItemId: z.string().min(1),
    customName: z.undefined().optional(),
    quantity: z.number().positive(),
    unitPrice: z.number().optional().nullable(),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
  // Free-text custom item — will auto-create a stock item
  z.object({
    stockItemId: z.undefined().optional(),
    customName: z.string().min(1),
    quantity: z.number().positive(),
    unitPrice: z.number().optional().nullable(),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }),
]);

const createOrderSchema = z.object({
  supplierId: z.string().min(1),
  notes: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1),
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

  // Resolve stockItemIds — auto-create stock items for custom names
  const resolvedItems: { stockItemId: string; quantity: number; unitPrice: number | null; notes: string | null }[] = [];

  for (const item of result.data.items) {
    let stockItemId: string;

    if (item.stockItemId) {
      stockItemId = item.stockItemId;
    } else if (item.customName) {
      // Check if a stock item with this name already exists for the business
      const existing = await prisma.stockItem.findFirst({
        where: {
          businessId: auth.businessId,
          name: { equals: item.customName, mode: "insensitive" },
        },
      });

      if (existing) {
        stockItemId = existing.id;
      } else {
        // Auto-create a new stock item
        const created = await prisma.stockItem.create({
          data: {
            businessId: auth.businessId,
            supplierId: result.data.supplierId,
            name: item.customName,
            unit: item.unit || "unit",
            category: "general",
            ...(item.unitPrice != null ? { lastPrice: item.unitPrice } : {}),
          },
        });
        stockItemId = created.id;
      }
    } else {
      continue; // skip invalid items
    }

    resolvedItems.push({
      stockItemId,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? null,
      notes: item.notes ?? null,
    });
  }

  if (resolvedItems.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const order = await prisma.supplierOrder.create({
    data: {
      businessId: auth.businessId,
      supplierId: result.data.supplierId,
      notes: result.data.notes,
      items: {
        create: resolvedItems,
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
