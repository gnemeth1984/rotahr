import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  redeemed: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.promoOffer.findUnique({ where: { id: offerId } });
  if (!existing || existing.businessId !== session.user.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const offer = await prisma.promoOffer.update({
    where: { id: offerId },
    data: {
      redeemed: parsed.data.redeemed,
      redeemedAt: parsed.data.redeemed === true ? new Date() : parsed.data.redeemed === false ? null : undefined,
    },
  });

  return NextResponse.json({ offer });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.promoOffer.findUnique({ where: { id: offerId } });
  if (!existing || existing.businessId !== session.user.businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.promoOffer.delete({ where: { id: offerId } });
  return NextResponse.json({ success: true });
}
