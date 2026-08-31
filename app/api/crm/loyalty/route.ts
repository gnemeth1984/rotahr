import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ensureLoyaltyConfig } from "@/lib/crm/loyalty";
import { recomputeBusinessStats } from "@/lib/crm/stats";
import { logActivity } from "@/lib/services/activity.service";

const tierSchema = z.object({
  key: z.string().min(1).max(30),
  name: z.string().min(1).max(40),
  minVisits: z.number().int().min(0).max(1000),
  minSpend: z.number().min(0).max(1000000),
  perks: z.string().max(2000).optional().nullable(),
  colour: z.string().max(20).optional(),
  sortOrder: z.number().int().min(0).max(50),
});

const putSchema = z.object({
  settings: z
    .object({
      enabled: z.boolean().optional(),
      pointsPerCurrency: z.number().min(0).max(100).optional(),
      pointValue: z.number().min(0).max(100).optional(),
      vipSpendThreshold: z.number().min(0).max(1000000).optional(),
      autoUpgrade: z.boolean().optional(),
    })
    .optional(),
  tiers: z.array(tierSchema).max(10).optional(),
  recompute: z.boolean().optional(),
});

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const cfg = await ensureLoyaltyConfig(businessId);

  const counts = await prisma.customer.groupBy({
    by: ["loyaltyTier"],
    where: { businessId, isAnonymised: false },
    _count: { _all: true },
    _sum: { totalSpend: true, loyaltyPoints: true },
  });

  const redemptions = await prisma.loyaltyRedemption.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { customer: { select: { id: true, name: true } } },
  });

  // The UI shows money next to points, so it needs the venue's currency.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { currency: true },
  });

  return NextResponse.json({
    ...cfg,
    currency: business?.currency ?? "EUR",
    tierCounts: counts.map((c) => ({
      tier: c.loyaltyTier,
      guests: c._count._all,
      spend: Math.round((c._sum.totalSpend ?? 0) * 100) / 100,
      points: c._sum.loyaltyPoints ?? 0,
    })),
    redemptions,
  });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const parsed = putSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { settings, tiers, recompute } = parsed.data;

  await ensureLoyaltyConfig(businessId);

  if (settings) {
    await prisma.loyaltySettings.update({ where: { businessId }, data: settings });
  }

  if (tiers) {
    for (const t of tiers) {
      await prisma.loyaltyTier.upsert({
        where: { businessId_key: { businessId, key: t.key } },
        update: {
          name: t.name,
          minVisits: t.minVisits,
          minSpend: t.minSpend,
          perks: t.perks ?? null,
          colour: t.colour ?? "slate",
          sortOrder: t.sortOrder,
        },
        create: {
          businessId,
          key: t.key,
          name: t.name,
          minVisits: t.minVisits,
          minSpend: t.minSpend,
          perks: t.perks ?? null,
          colour: t.colour ?? "slate",
          sortOrder: t.sortOrder,
        },
      });
    }
  }

  // Moving a threshold changes who qualifies, so the tiers are re-evaluated
  // straight away rather than waiting for the nightly run.
  let recomputed: { updated: number; upgrades: unknown[] } | null = null;
  if (recompute !== false) {
    recomputed = await recomputeBusinessStats(businessId);
  }

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_loyalty_updated",
    details: {
      tiersEdited: tiers?.length ?? 0,
      settingsEdited: settings ? Object.keys(settings).length : 0,
      guestsRecomputed: recomputed?.updated ?? 0,
    },
  });

  const cfg = await ensureLoyaltyConfig(businessId);
  return NextResponse.json({ ...cfg, recomputed });
}
