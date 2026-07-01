// @ts-nocheck
/**
 * POST /api/delivery-note/apply
 *
 * One call that applies a scanned delivery note / invoice to:
 *  1. Bookkeeping  → creates an Expense record
 *  2. Stock        → creates/updates stock items + SupplierOrder
 *  3. HACCP        → creates a delivery check record
 *
 * Recipes auto-update because they read stockItem.lastPrice live.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId!;
  const userId = session.user.id;

  const body = await req.json();
  const {
    // shared
    vendor,
    invoiceDate,
    invoiceTotal,
    supplierId,
    receiptUrl,
    notes,
    // line items
    items,          // [{name, quantity, unit, unitPrice, existingItemId}]
    // flags
    applyBookkeeping,
    applyStock,
    applyHaccp,
    // haccp extras
    deliveryTemp,   // number | null
    haccpStatus,    // "pass" | "fail"
    haccpNotes,
  } = body;

  const dateObj = invoiceDate ? new Date(invoiceDate) : new Date();
  const results: Record<string, any> = {};

  // ── 1. Bookkeeping ─────────────────────────────────────────────────────────
  let expenseId: string | null = null;
  if (applyBookkeeping && invoiceTotal != null) {
    const expense = await prisma.expense.create({
      data: {
        businessId,
        vendor: vendor ?? "Unknown Supplier",
        amount: invoiceTotal,
        vatAmount: 0,
        category: "stock",
        date: dateObj,
        description: `Delivery note — ${vendor ?? "supplier"} — ${dateObj.toLocaleDateString("en-IE")}`,
        receiptUrl: receiptUrl ?? null,
        aiLineItems: items ?? [],
        status: "confirmed",
        createdById: userId,
      },
    });
    expenseId = expense.id;
    results.expense = { id: expense.id };
  }

  // ── 2. Stock ───────────────────────────────────────────────────────────────
  if (applyStock && items?.length) {
    const resolvedItems: { stockItemId: string; quantity: number; unitPrice: number | null }[] = [];

    for (const item of items) {
      let stockItemId: string;

      if (item.existingItemId) {
        await prisma.stockItem.update({
          where: { id: item.existingItemId },
          data: {
            currentStock: { increment: item.quantity },
            ...(item.unitPrice != null ? { lastPrice: item.unitPrice } : {}),
            lastOrdered: dateObj,
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
              lastOrdered: dateObj,
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
              lastOrdered: dateObj,
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
    if (supplierId && resolvedItems.length > 0) {
      const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, businessId } });
      if (supplier) {
        const order = await prisma.supplierOrder.create({
          data: {
            businessId,
            supplierId,
            status: "received",
            receivedAt: dateObj,
            notes: `Delivery note: ${vendor ?? supplier.name} — ${dateObj.toLocaleDateString("en-IE")}`,
            items: { create: resolvedItems },
          },
        });
        results.order = { id: order.id };
      }
    }

    results.stock = { itemsUpdated: resolvedItems.length };
  }

  // ── 3. HACCP delivery record ───────────────────────────────────────────────
  if (applyHaccp) {
    const haccpData: Record<string, any> = {
      supplier: vendor ?? "Unknown",
      invoiceDate: dateObj.toISOString().slice(0, 10),
      itemCount: items?.length ?? 0,
      items: (items ?? []).map((i: any) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
      })),
    };
    if (deliveryTemp != null) haccpData.deliveryTemp = deliveryTemp;
    if (receiptUrl) haccpData.invoiceUrl = receiptUrl;

    const haccp = await prisma.hACCPRecord.create({
      data: {
        businessId,
        checkType: "delivery",
        checkedById: userId,
        checkedAt: dateObj,
        data: haccpData,
        status: haccpStatus ?? "pass",
        notes: haccpNotes ?? notes ?? null,
      },
    });
    results.haccp = { id: haccp.id };
  }

  return NextResponse.json({ success: true, results });
}
