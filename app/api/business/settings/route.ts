// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// GET — return business locale settings (currency, country)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) {
    return NextResponse.json({ currency: "EUR", country: "IE" });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.user.businessId },
    select: { currency: true, country: true },
  });

  return NextResponse.json({
    currency: business?.currency ?? "EUR",
    country: business?.country ?? "IE",
  });
}

// PATCH — update currency/country (admin only)
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { currency, country } = body;

  await prisma.business.update({
    where: { id: session.user.businessId },
    data: {
      ...(currency && { currency }),
      ...(country && { country }),
    },
  });

  return NextResponse.json({ ok: true });
}
