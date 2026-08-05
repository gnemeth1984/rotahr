import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/prisma";

// Tenant isolation: the statement was fetched by raw ID with no business check,
// so a manager could accept another business's supplier statement — which then
// marked their order received and rewrote their stock prices.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const { id } = await params;
  const statement = await prisma.supplierStatement.findFirst({
    where: { id, businessId: t.businessId },
  });
  if (!statement) return notFound();

  // Mark statement accepted
  await prisma.supplierStatement.update({ where: { id }, data: { status: "accepted" } });

  // Mark matched order as received
  if (statement.matchedOrderId) {
    // Scope the order too — matchedOrderId is stored data, but a mismatched
    // record must never let a write escape the tenant.
    const order = await prisma.supplierOrder.findFirst({
      where: { id: statement.matchedOrderId, businessId: t.businessId },
      select: { id: true },
    });

    if (order) {
      await prisma.supplierOrder.update({
        where: { id: order.id },
        data: { status: "received", receivedAt: new Date() },
      });

      // Update lastPrice on stock items from AI line items
      type LineItem = { description?: string; sku?: string; unitPrice?: number };
      const items = (statement.aiExtracted as LineItem[] | null) ?? [];
      for (const li of items) {
        if (li.sku && li.unitPrice) {
          await prisma.stockItem.updateMany({
            where: { businessId: t.businessId, sku: li.sku },
            data: { lastPrice: li.unitPrice, lastOrdered: new Date() },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
