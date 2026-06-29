import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = { businessId: session.user.businessId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const records = await prisma.wastageRecord.findMany({
    where,
    include: { stockItem: { select: { id: true, name: true, unit: true } } },
    orderBy: { date: "desc" },
    take: 200,
  });

  const totalCost = records.reduce((sum, r) => sum + (r.totalCost ?? 0), 0);
  return NextResponse.json({ records, totalCost });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { stockItemId, itemName, quantity, unit, unitCost, reason, notes, date } = body;

  if (!itemName || !quantity) {
    return NextResponse.json({ error: "itemName and quantity required" }, { status: 400 });
  }

  const totalCost = unitCost && quantity ? parseFloat(unitCost) * parseFloat(quantity) : null;

  const record = await prisma.wastageRecord.create({
    data: {
      businessId: session.user.businessId,
      stockItemId: stockItemId || null,
      itemName,
      quantity: parseFloat(quantity),
      unit: unit || "unit",
      unitCost: unitCost ? parseFloat(unitCost) : null,
      totalCost,
      reason: reason || "spoilage",
      notes: notes || null,
      recordedBy: session.user.id,
      date: date ? new Date(date) : new Date(),
    },
  });

  return NextResponse.json(record, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["MANAGER", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.wastageRecord.deleteMany({
    where: { id, businessId: session.user.businessId },
  });
  return NextResponse.json({ ok: true });
}
