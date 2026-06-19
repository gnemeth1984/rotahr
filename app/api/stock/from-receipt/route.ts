// @ts-nocheck
/**
 * POST /api/stock/from-receipt
 * Given an expenseId, read the aiRawText or vendor name from the expense
 * and return suggested stock items (supplier match + line items if parseable).
 * Manager/admin can then confirm which items to add/update.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { UserRole as Role } from "@/types/roles";

async function requireManager(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role as Role;
  if (role !== Role.ADMIN && role !== Role.MANAGER) return null;
  const businessId = (session.user as any).businessId as string | undefined;
  if (!businessId) return null;
  return { session, businessId };
}

/**
 * Very lightweight rule-based line item parser.
 * Looks for patterns like:
 *   "2x Heineken 24pk  €48.00"
 *   "Chicken Breast 5kg  24.50"
 *   "Cheddar Cheese (2kg) - 12.80"
 */
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

    // Extract leading quantity (2x, 3X, etc)
    const qtyMatch = name.match(qtyRe);
    if (qtyMatch) {
      quantity = parseFloat(qtyMatch[1]);
      name = name.slice(qtyMatch[0].length);
    }

    // Extract unit from name
    const unitMatch = name.match(unitRe);
    if (unitMatch) {
      unit = unitMatch[2].toLowerCase();
    }

    // Extract price — last price-like value on the line
    const prices = [...name.matchAll(new RegExp(priceRe, "g"))];
    let unitPrice: number | null = null;
    if (prices.length > 0) {
      const last = prices[prices.length - 1];
      unitPrice = parseFloat(last[1].replace(",", "."));
      // Remove price from name
      name = name.slice(0, last.index ?? name.length).trim();
    }

    // Clean up name — remove trailing dashes, parens, colons
    name = name.replace(/[-–:,]+$/, "").trim();
    if (name.length < 2) continue;

    results.push({ name, quantity, unitPrice, unit });
  }

  return results;
}

export async function POST(req: NextRequest) {
  const auth = await requireManager(req);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { expenseId } = await req.json();
  if (!expenseId) return NextResponse.json({ error: "expenseId required" }, { status: 400 });

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, businessId: auth.businessId },
  });
  if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

  // Try to match supplier by vendor name
  let matchedSupplier = null;
  if (expense.vendor) {
    matchedSupplier = await prisma.supplier.findFirst({
      where: {
        businessId: auth.businessId,
        active: true,
        name: { contains: expense.vendor.split(" ")[0], mode: "insensitive" },
      },
    });
  }

  // Parse line items from aiRawText
  const lineItems = expense.aiRawText ? parseLineItems(expense.aiRawText) : [];

  // Find existing stock items matching parsed names (fuzzy by contains)
  const existingItems = await prisma.stockItem.findMany({
    where: { businessId: auth.businessId },
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
