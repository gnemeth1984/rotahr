import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getPreset, generateOfferCode } from "@/lib/crm/offer-presets";
import { generateOfferQrDataUri, getRedeemUrl } from "@/lib/crm/qr";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const offers = await prisma.promoOffer.findMany({
    where: { customerId: id, businessId: session.user.businessId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ offers });
}

const createSchema = z.object({
  offerType: z.enum(["birthday", "winback", "vip", "welcome", "custom"]),
  title: z.string().optional(),
  description: z.string().optional(),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const customer = await prisma.customer.findFirst({
    where: { id, businessId: session.user.businessId },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const preset = getPreset(parsed.data.offerType);
  const title = parsed.data.title || preset.title;
  const description = parsed.data.description || preset.description;
  if (!title || !description) {
    return NextResponse.json({ error: "Title and description are required for a custom offer" }, { status: 400 });
  }

  let code = generateOfferCode(customer.name, preset.codePrefix);
  // Extremely unlikely collision, but guard anyway
  for (let i = 0; i < 3; i++) {
    const existing = await prisma.promoOffer.findUnique({ where: { code } });
    if (!existing) break;
    code = generateOfferCode(customer.name, preset.codePrefix);
  }

  const expiresAt = parsed.data.expiresInDays
    ? new Date(Date.now() + parsed.data.expiresInDays * 86_400_000)
    : null;

  const offer = await prisma.promoOffer.create({
    data: {
      businessId: session.user.businessId,
      customerId: id,
      code,
      offerType: parsed.data.offerType,
      title,
      description,
      expiresAt,
      createdById: session.user.id,
    },
  });

  const qrDataUri = await generateOfferQrDataUri(offer.code);
  const redeemUrl = getRedeemUrl(offer.code);

  return NextResponse.json({ offer, qrDataUri, redeemUrl }, { status: 201 });
}
