// @ts-nocheck
/**
 * POST /api/stock/apply-receipt
 * Takes confirmed line items from a receipt/invoice and:
 * 1. Creates/updates stock items
 * 2. Increments currentStock by the received quantity
 * 3. Updates lastPrice if price changed
 * 4. Creates a SupplierOrder (status: received) as a paper trail
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId!;

  const { expenseId, supplierId, items } = await req.json();

  if (!items || items.length === 0)
    return NextResponse.json({ error: "No items provided" }, { status: 400 });

  const expense = expenseId
    ? await prisma.expense.findFirst({ where: { id: expenseId, businessId } })
    : null;

  const resolvedItems: { stockItemId: string; quantity: number; unitPrice: number | null }[] = [];

  for (const item of items) {
    let stockItemId: string;

    if (item.existingItemId) {
      await prisma.stockItem.update({
        where: { id: item.existingItemId },
        data: {
          currentStock: { increment: item.quantity },
          ...(item.unitPrice != null ? { lastPrice: item.unitPrice } : {}),
          lastOrdered: expense?.date ?? new Date(),
          lastExpenseId: expenseId ?? undefined,
        },
      });
      stockItemId = item.existingItemId;
    } else {
      const existing = await prisma.stockItem.findFirst({
        where: { businessId, name: { equals: item.name, mode: "insensitive" } },
      });
      if (existing) {
        await prisma.stockItem.update({
          where: { id: existing.id },
          data: {
            currentStock: { increment: item.quantity },
            ...(item.unitPrice != null ? { lastPrice: item.unitPrice } : {}),
            lastOrdered: expense?.date ?? new Date(),
            lastExpenseId: expenseId ?? undefined,
            ...(supplierId ? { supplierId } : {}),
          },
        });
        stockItemId = existing.id;
      } else {
        const created = await prisma.stockItem.create({
          data: {
            businessId,
            name: item.name,
            unit: item.unit ?? "unit",
            category: "general",
            currentStock: item.quantity,
            ...(item.unitPrice != null ? { lastPrice: item.unitPrice } : {}),
            lastOrdered: expense?.date ?? new Date(),
            lastExpenseId: expenseId ?? undefined,
            ...(supplierId ? { supplierId } : {}),
          },
        });
        stockItemId = created.id;
      }
    }

    resolvedItems.push({ stockItemId, quantity: item.quantity, unitPrice: item.unitPrice ?? null });
  }

  // Create SupplierOrder as paper trail
  let order = null;
  if (supplierId && resolvedItems.length > 0) {
    const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
    if (supplier) {
      order = await prisma.supplierOrder.create({
        data: {
          businessId,
          supplierId,
          status: "received",
          receivedAt: expense?.date ?? new Date(),
          notes: expense
            ? `Auto-created from invoice: ${expense.vendor ?? "Unknown vendor"} — ${new Date(expense.date).toLocaleDateString("en-IE")}`
            : "Auto-created from receipt scan",
          items: { create: resolvedItems },
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: { include: { stockItem: { select: { id: true, name: true, unit: true } } } },
        },
      });
    }
  }

  return NextResponse.json({ applied: resolvedItems.length, order });
}
