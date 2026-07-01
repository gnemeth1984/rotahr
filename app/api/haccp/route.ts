import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checkType = searchParams.get("checkType");
    const date = searchParams.get("date"); // YYYY-MM-DD
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: Record<string, unknown> = { businessId: session.user.businessId };
    if (checkType) where.checkType = checkType;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.checkedAt = { gte: start, lte: end };
    }

    const records = await prisma.hACCPRecord.findMany({
      where,
      include: { checkedBy: { select: { name: true, email: true } } },
      orderBy: { checkedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error("HACCP GET error:", error);
    return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId || !session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { checkType, data, status, notes } = body;

    if (!checkType || !data) {
      return NextResponse.json({ error: "checkType and data are required" }, { status: 400 });
    }

    const record = await prisma.hACCPRecord.create({
      data: {
        businessId: session.user.businessId,
        checkType,
        checkedById: session.user.id,
        data,
        status: status || "pass",
        notes: notes || null,
      },
      include: { checkedBy: { select: { name: true, email: true } } },
    });

    return NextResponse.json({ record });
  } catch (error) {
    console.error("HACCP POST error:", error);
    return NextResponse.json({ error: "Failed to save record" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const record = await prisma.hACCPRecord.findFirst({
      where: { id, businessId: session.user.businessId },
    });
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.hACCPRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("HACCP DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
