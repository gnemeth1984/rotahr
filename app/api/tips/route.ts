// @ts-nocheck
// Tip / Tronc Management API
// Compliance: Payment of Wages (Amendment) (Tips and Gratuities) Act 2022
// All distribution records retained; soft-delete only for audit trail.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET — list tip pools for the business
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const pools = await prisma.tipPool.findMany({
    where: { businessId },
    include: {
      distributions: {
        include: {
          employee: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { periodStart: "desc" },
  });

  return NextResponse.json({ pools });
}

// POST — create a new tip pool period
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business" }, { status: 400 });

  const body = await req.json();
  const { periodStart, periodEnd, totalAmount, method, notes } = body;

  if (!periodStart || !periodEnd || !totalAmount) {
    return NextResponse.json({ error: "periodStart, periodEnd, totalAmount required" }, { status: 400 });
  }

  const pool = await prisma.tipPool.create({
    data: {
      businessId,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      totalAmount: parseFloat(totalAmount),
      method: method ?? "hours",
      notes: notes ?? null,
      status: "draft",
    },
  });

  return NextResponse.json({ pool }, { status: 201 });
}
