// @ts-nocheck
/**
 * POST /api/stock/from-receipt
 * Given an expenseId, read the aiRawText or vendor name from the expense
 * and return suggested stock items (supplier match + line items if parseable).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

function parseLineItems(text: string): Array<{ name: string; quantity: number; unitPrice: number | null; unit: string }> {
  const lines = text.split(/\n/);
  const results: Array<{ name: string; quantity: number; unitPrice: number | null; unit: string }> = [];

  const priceRe = /[€$£]?\s*(\d+(?:[.,]\d{1,2})?)/;
  const qtyRe = /^(\d+(?:\.\d+)?)\s*[xX×]\s*/;
  const unitRe = /(\d+(?:\.\d+)?)\s*(kg|g|litre|ltr|l|ml|unit|pcs?|case|box|bottle|btl|pack|pk)\b/i;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length < 4) continue;

    let name = line;
    let quantity = 1;
    let unit = "unit";

    const qtyMatch = name.match(qtyRe);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1]);
      name = name.slice(qtyMatch[0].length);
    }

    const unitMatch = name.match(unitRe);
    if (unitMatch) {
      unit = unitMatch[2].toLowerCase();
    }

    const prices = [...name.matchAll(new RegExp(priceRe, "g"))];
    let unitPrice: number | null = null;
    if (prices.length > 0) {
      const last = prices[prices.length - 1];
      unitPrice = parseFloat(last[1].replace(",", "."));
      name = name.slice(0, last.index ?? name.length).trim();
    }

    name = name.replace(/[-–:,]+$/, "").trim();
    if (name.length < 2) continue;

    results.push({ name, quantity, unitPrice, unit });
  }

  return results;
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;
  const { expenseId } = await req.json();
  if (!expenseId) return NextResponse.json({ error: "expenseId required" }, { status: 400 });

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, businessId },
  });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  let matchedSupplier = null;
  if (expense.vendor) {
    matchedSupplier = await prisma.supplier.findFirst({
      where: {
        businessId,
        active: true,
        name: { contains: expense.vendor.split(" ")[0], mode: "insensitive" },
      },
    });
  }

  // Prefer structured AI line items stored on the expense; fall back to regex parsing rawText
  const aiStoredItems = expense.aiLineItems as Array<{ name: string; quantity: number; unit: string; unitPrice: number | null }> | null;
  const lineItems = aiStoredItems?.length
    ? aiStoredItems
    : expense.aiRawText
    ? parseLineItems(expense.aiRawText)
    : [];

  const existingItems = await prisma.stockItem.findMany({
    where: { businessId },
    select: { id: true, name: true, supplierId: true, lastPrice: true, unit: true },
  });

  const suggestions = lineItems.map((li) => {
    const match = existingItems.find((e) =>
      e.name.toLowerCase().includes(li.name.toLowerCase().slice(0, 6)) ||
      li.name.toLowerCase().includes(e.name.toLowerCase().slice(0, 6))
    );
    return {
      ...li,
      existingItemId: match?.id ?? null,
      existingName: match?.name ?? null,
      existingPrice: match?.lastPrice ?? null,
      priceChanged: match && li.unitPrice !== null && match.lastPrice !== li.unitPrice,
    };
  });

  return NextResponse.json({
    expense: { id: expense.id, vendor: expense.vendor, date: expense.date, amount: expense.amount },
    matchedSupplier,
    suggestions,
  });
}
