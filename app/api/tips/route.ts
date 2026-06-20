// @ts-nocheck
// Tip / Tronc Management API
// Compliance: Payment of Wages (Amendment) (Tips and Gratuities) Act 2022
// All distribution records retained; soft-delete only for audit trail.
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";

// GET — list tip pools for the business
export async function GET(req: NextRequest) {
  const session = await requirePermission("tips");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;

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
  const session = await requirePermission("tips");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId!;

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
