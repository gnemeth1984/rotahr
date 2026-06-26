import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const isManager = user?.role === "MANAGER" || user?.role === "ADMIN";
  if (!isManager) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const statement = await prisma.supplierStatement.findUnique({ where: { id } });
  if (!statement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Mark statement accepted
  await prisma.supplierStatement.update({ where: { id }, data: { status: "accepted" } });

  // Mark matched order as received
  if (statement.matchedOrderId) {
    await prisma.supplierOrder.update({
      where: { id: statement.matchedOrderId },
      data: { status: "received", receivedAt: new Date() },
    });

    // Update lastPrice on stock items from AI line items
    type LineItem = { description?: string; sku?: string; unitPrice?: number };
    const items = (statement.aiExtracted as LineItem[] | null) ?? [];
    for (const li of items) {
      if (li.sku && li.unitPrice) {
        await prisma.stockItem.updateMany({
          where: { businessId: statement.businessId, sku: li.sku },
          data: { lastPrice: li.unitPrice, lastOrdered: new Date() },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
