// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId!;

  const { items } = await req.json();

  const existingItems = await prisma.stockItem.findMany({
    where: { businessId },
    select: { id: true, name: true, unit: true, lastPrice: true },
  });

  const suggestions = (items ?? []).map((item: any) => {
    const match = existingItems.find(
      (e) =>
        e.name.toLowerCase().includes((item.name ?? "").toLowerCase().slice(0, 6)) ||
        (item.name ?? "").toLowerCase().includes(e.name.toLowerCase().slice(0, 6))
    );
    return {
      name: item.name,
      quantity: item.quantity ?? 1,
      unit: item.unit ?? "unit",
      unitPrice: item.unitPrice ?? null,
      existingItemId: match?.id ?? null,
      existingName: match?.name ?? null,
      existingPrice: match?.lastPrice ?? null,
      priceChanged: !!(match && item.unitPrice != null && match.lastPrice !== item.unitPrice),
    };
  });

  return NextResponse.json({ suggestions });
}
