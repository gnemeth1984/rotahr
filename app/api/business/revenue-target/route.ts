// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET — return the business's weekly revenue target
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    select: { weeklyRevenueTarget: true },
  });

  return NextResponse.json({ weeklyRevenueTarget: business?.weeklyRevenueTarget ?? null });
}

// PATCH — update the revenue target
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { weeklyRevenueTarget } = body;

  await prisma.business.update({
    where: { id: session.user.businessId },
    data: { weeklyRevenueTarget: weeklyRevenueTarget !== null ? parseFloat(weeklyRevenueTarget) : null },
  });

  return NextResponse.json({ ok: true });
}
