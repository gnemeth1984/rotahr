import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ensureLoyaltyConfig, pointsForSpend } from "@/lib/crm/loyalty";
import { recomputeGuestStats } from "@/lib/crm/stats";
import { logActivity } from "@/lib/services/activity.service";

/**
 * Per-guest spend.
 *
 * PosSnapshot is day-level aggregate with no guest identity, so these rows are
 * entered by hand or imported from a CSV today. source "pos" is reserved for a
 * future per-ticket feed; nothing writes it yet.
 */

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  qty: z.number().min(0).max(999).optional(),
  price: z.number().min(0).max(100000).optional(),
});

const createSchema = z.object({
  customerId: z.string().min(1),
  date: z.string().min(1),
  totalSpend: z.number().min(0).max(1000000),
  covers: z.number().int().min(0).max(500).optional().nullable(),
  items: z.array(itemSchema).optional().nullable(),
  itemsText: z.string().max(4000).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  reservationId: z.string().optional().nullable(),
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
  const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 500);

  const where: any = { businessId };
  if (customerId) where.customerId = customerId;

  const [transactions, agg] = await Promise.all([
    prisma.guestTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      include: customerId ? undefined : { customer: { select: { id: true, name: true } } },
    }),
    prisma.guestTransaction.aggregate({
      where,
      _sum: { totalSpend: true },
      _count: { _all: true },
      _avg: { totalSpend: true },
    }),
  ]);

  return NextResponse.json({
    transactions,
    totals: {
      count: agg._count._all,
      totalSpend: Math.round((agg._sum.totalSpend ?? 0) * 100) / 100,
      averageSpend: Math.round((agg._avg.totalSpend ?? 0) * 100) / 100,
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, businessId },
    select: { id: true, isAnonymised: true },
  });
  if (!customer) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  if (customer.isAnonymised)
    return NextResponse.json({ error: "That guest has been anonymised" }, { status: 400 });

  const date = new Date(d.date);
  if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const cfg = await ensureLoyaltyConfig(businessId);
  const points = cfg.settings.enabled
    ? pointsForSpend(d.totalSpend, cfg.settings.pointsPerCurrency)
    : 0;

  const tx = await prisma.guestTransaction.create({
    data: {
      businessId,
      customerId: d.customerId,
      date,
      totalSpend: Math.round(d.totalSpend * 100) / 100,
      covers: d.covers ?? null,
      items: d.items && d.items.length ? (d.items as any) : undefined,
      itemsText: d.itemsText ?? null,
      notes: d.notes ?? null,
      reservationId: d.reservationId ?? null,
      source: "manual",
      recordedById: session!.user.id ?? null,
      recordedBy: session!.user.name ?? null,
      pointsAwarded: points,
    },
  });

  const stats = await recomputeGuestStats(businessId, d.customerId, cfg);

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_transaction_added",
    details: { amount: tx.totalSpend, points, tier: stats?.loyaltyTier ?? null },
  });

  return NextResponse.json({ transaction: tx, stats }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.guestTransaction.findFirst({
    where: { id, businessId },
    select: { id: true, customerId: true, totalSpend: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.guestTransaction.delete({ where: { id } });
  const stats = await recomputeGuestStats(businessId, existing.customerId);

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_transaction_deleted",
    details: { amount: existing.totalSpend },
  });

  return NextResponse.json({ ok: true, stats });
}
