import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offer = await prisma.promoOffer.findUnique({
    where: { code: decodeURIComponent(code) },
    include: { customer: { select: { name: true } } },
  });

  if (!offer || offer.businessId !== session.user.businessId) {
    return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  }

  return NextResponse.json({ offer });
}
