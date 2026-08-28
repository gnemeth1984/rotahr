export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import { rollNextService } from "@/lib/assets/status";

/**
 * Service notes — one row per engineer visit / thing done to an asset.
 *
 * GET    /api/assets/service?assetId=<id>  → full history for one asset
 * POST   /api/assets/service               → log a visit
 * DELETE /api/assets/service?id=<id>       → remove a logged visit
 *
 * Logging a visit is the only place `nextServiceDate` moves automatically. The
 * roll is applied here rather than in the UI so the share of truth is one
 * function (`rollNextService`) and a visit logged from any future caller —
 * mobile, a share flow, an import — lands identically.
 */

function dateOrNull(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ services: [] });

  const assetId = new URL(req.url).searchParams.get("assetId");
  if (!assetId) return NextResponse.json({ error: "Missing assetId" }, { status: 400 });

  // Scope through the asset, so an id from another business returns nothing.
  const asset = await prisma.asset.findFirst({ where: { id: assetId, businessId }, select: { id: true } });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const services = await prisma.assetService.findMany({
    where: { assetId, businessId },
    orderBy: { servicedOn: "desc" },
    include: {
      docs: { select: { id: true, kind: true, fileName: true, mimeType: true, createdAt: true } },
    },
  });

  return NextResponse.json({ services });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const assetId = typeof b.assetId === "string" ? b.assetId : "";
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });

  const asset = await prisma.asset.findFirst({
    where: { id: assetId, businessId },
    select: { id: true, name: true, serviceIntervalMonths: true, nextServiceDate: true },
  });
  if (!asset) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const servicedOn = dateOrNull(b.servicedOn) ?? new Date();
  const kind = typeof b.kind === "string" ? b.kind : "service";

  // An explicit nextDue from the form always wins — an engineer who says "see
  // you in 3 months" overrides the standing interval. Otherwise roll by the
  // interval. A repair or callout does NOT move the schedule: fixing a broken
  // fryer is not the annual service.
  const explicitNextDue = dateOrNull(b.nextDue);
  const rolls = kind === "service" || kind === "inspection";
  const nextDue =
    explicitNextDue ?? (rolls ? rollNextService(servicedOn, asset.serviceIntervalMonths) : null);

  const service = await prisma.assetService.create({
    data: {
      businessId,
      assetId,
      servicedOn,
      kind,
      engineer: b.engineer || null,
      company: b.company || null,
      cost: numOrNull(b.cost),
      underWarranty: Boolean(b.underWarranty),
      summary: b.summary || null,
      nextDue,
      createdById: session.user.id,
    },
  });

  // Only advance the asset's stored dates when this visit is actually the most
  // recent one. Back-filling last year's service must not rewind the schedule.
  const isLatest =
    !asset.nextServiceDate || servicedOn.getTime() >= new Date(asset.nextServiceDate).getTime() - 86400000 * 365;

  await prisma.asset.update({
    where: { id: assetId },
    data: {
      lastServiceDate: servicedOn,
      ...(nextDue && isLatest ? { nextServiceDate: nextDue } : {}),
    },
  });

  logActivity({
    businessId,
    userId: session.user.id,
    userName: session.user.name,
    action: "asset_serviced",
    details: { asset: asset.name, kind, underWarranty: Boolean(b.underWarranty) },
  });

  return NextResponse.json({ service }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.assetService.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.assetService.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
