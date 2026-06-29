import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

// Returns price variance: compares StockItem.lastPrice vs latest SupplierStatement line items
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const biz = session.user.businessId;

  // Get all stock items with a lastPrice
  const stockItems = await prisma.stockItem.findMany({
    where: { businessId: biz },
    include: { supplier: { select: { id: true, name: true } } },
  });

  // Get all supplier statement line items for this business, ordered by date desc
  const statements = await prisma.supplierStatement.findMany({
    where: { businessId: biz },
    include: { supplier: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Build a map: itemName (normalised) → latest unit price from statement
  const latestStatementPrices: Record<string, { price: number; statementId: string; date: Date; supplier?: string }> = {};

  for (const stmt of statements) {
    const lines = (stmt.aiExtracted as any)?.lineItems ?? [];
    for (const line of lines) {
      const name = (line.description || line.name || "").toLowerCase().trim();
      if (!name) continue;
      const price = parseFloat(line.unitPrice ?? line.unit_price ?? 0);
      if (!price) continue;
      if (!latestStatementPrices[name]) {
        latestStatementPrices[name] = {
          price,
          statementId: stmt.id,
          date: stmt.createdAt,
          supplier: stmt.supplier?.name ?? undefined,
        };
      }
    }
  }

  // Compare
  const results = stockItems.map((item) => {
    const key = item.name.toLowerCase().trim();
    const latest = latestStatementPrices[key];
    const prevPrice = item.lastPrice;
    const newPrice = latest?.price ?? null;

    let change: number | null = null;
    let pct: number | null = null;
    if (prevPrice && newPrice) {
      change = newPrice - prevPrice;
      pct = ((newPrice - prevPrice) / prevPrice) * 100;
    }

    return {
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      supplier: item.supplier?.name ?? latest?.supplier ?? null,
      prevPrice,
      newPrice,
      change,
      pct,
      flagged: pct !== null && pct > 5,
      dropped: pct !== null && pct < -5,
      statementDate: latest?.date ?? null,
    };
  });

  // Sort: flagged first, then dropped, then unchanged
  results.sort((a, b) => {
    if (a.flagged && !b.flagged) return -1;
    if (!a.flagged && b.flagged) return 1;
    if (a.dropped && !b.dropped) return -1;
    if (!a.dropped && b.dropped) return 1;
    return (a.name ?? "").localeCompare(b.name ?? "");
  });

  return NextResponse.json({ items: results });
}
