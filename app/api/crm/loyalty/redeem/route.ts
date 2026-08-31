import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ensureLoyaltyConfig } from "@/lib/crm/loyalty";
import { recomputeGuestStats } from "@/lib/crm/stats";
import { logActivity } from "@/lib/services/activity.service";

/**
 * Redeem loyalty points for a reward.
 *
 * Points live on Customer.loyaltyPoints as a running balance: earned points come
 * from GuestTransaction.pointsAwarded, spent points from LoyaltyRedemption. The
 * balance is recomputed from both sides in recomputeGuestStats, so this route
 * only has to write the redemption row and trigger a recompute. Redeeming never
 * moves a guest's tier - tier is earned on visits and lifetime spend, and taking
 * a reward should not demote anyone.
 */

const postSchema = z.object({
  customerId: z.string().min(1),
  points: z.number().int().min(1).max(1000000),
  reward: z.string().min(1).max(200),
  valueAmount: z.number().min(0).max(100000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get("customerId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const redemptions = await prisma.loyaltyRedemption.findMany({
    where: { businessId, ...(customerId ? { customerId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: customerId ? undefined : { customer: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ redemptions });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const parsed = postSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, businessId },
    select: { id: true, loyaltyPoints: true, isAnonymised: true },
  });
  if (!customer) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  if (customer.isAnonymised)
    return NextResponse.json({ error: "That guest has been anonymised" }, { status: 400 });

  const cfg = await ensureLoyaltyConfig(businessId);
  if (!cfg.settings.enabled)
    return NextResponse.json({ error: "Loyalty is switched off for this venue" }, { status: 400 });

  if (d.points > customer.loyaltyPoints) {
    return NextResponse.json(
      {
        error: `Not enough points. Balance is ${customer.loyaltyPoints}, tried to redeem ${d.points}.`,
        balance: customer.loyaltyPoints,
      },
      { status: 400 }
    );
  }

  const redemption = await prisma.loyaltyRedemption.create({
    data: {
      businessId,
      customerId: d.customerId,
      points: d.points,
      reward: d.reward.trim(),
      valueAmount:
        d.valueAmount ?? Math.round(d.points * cfg.settings.pointValue * 100) / 100,
      notes: d.notes ?? null,
      recordedById: session!.user.id ?? null,
      recordedBy: session!.user.name ?? null,
    },
  });

  const stats = await recomputeGuestStats(businessId, d.customerId, cfg);

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_loyalty_redeemed",
    details: { points: d.points, value: redemption.valueAmount },
  });

  return NextResponse.json({ redemption, stats }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.loyaltyRedemption.findFirst({
    where: { id, businessId },
    select: { id: true, customerId: true, points: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.loyaltyRedemption.delete({ where: { id } });
  const stats = await recomputeGuestStats(businessId, existing.customerId);

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_loyalty_redemption_removed",
    details: { points: existing.points },
  });

  return NextResponse.json({ ok: true, stats });
}
