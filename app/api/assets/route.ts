export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/services/activity.service";
import {
  warrantyStatus,
  serviceStatus,
  urgencyRank,
  categoryForEquipType,
  daysUntil,
} from "@/lib/assets/status";

/**
 * Asset register.
 *
 * GET    /api/assets                → list (auto-imports HACCP units first)
 * POST   /api/assets                → create
 * PATCH  /api/assets?id=<assetId>   → update
 * DELETE /api/assets?id=<assetId>   → delete (cascades services + docs)
 *
 * Query params rather than an [id] segment, matching /api/haccp/equipment.
 *
 * Every write is scoped by businessId. `ownedAsset` exists because the cert
 * module shipped a PATCH that trusted a client-supplied id and let any signed-in
 * manager edit another business's rows — that bug is not being repeated here.
 */

async function ownedAsset(id: string, businessId: string) {
  return prisma.asset.findFirst({ where: { id, businessId }, select: { id: true } });
}

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

/**
 * Mirrors any HACCPEquipment rows that have no asset yet.
 *
 * Gabor asked for HACCP units to be "pulled in automatically", so this runs on
 * read rather than behind a button — the register is never empty for a venue
 * that already logs temperatures. Safe to run on every GET: `haccpEquipmentId`
 * is unique, and only unmirrored ids are inserted.
 */
async function importHaccpUnits(businessId: string): Promise<number> {
  const units = await prisma.hACCPEquipment.findMany({
    where: { businessId, asset: { is: null } },
    select: { id: true, name: true, equipType: true },
  });
  if (units.length === 0) return 0;

  const res = await prisma.asset.createMany({
    data: units.map((u) => ({
      businessId,
      name: u.name,
      category: categoryForEquipType(u.equipType),
      haccpEquipmentId: u.id,
      notes: "Imported from the HACCP equipment list.",
    })),
    skipDuplicates: true,
  });
  return res.count;
}

export async function GET(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ assets: [], imported: 0 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const attention = searchParams.get("attention") === "1";

  let imported = 0;
  try {
    imported = await importHaccpUnits(businessId);
  } catch (e) {
    // An import failure must not blank the page the manager came to read.
    console.error("[assets] HACCP import failed", e);
  }

  const assets = await prisma.asset.findMany({
    where: {
      businessId,
      ...(category && category !== "all" ? { category } : {}),
      ...(status && status !== "all" ? { status } : {}),
    },
    include: {
      services: {
        orderBy: { servicedOn: "desc" },
        take: 5,
        select: {
          id: true,
          servicedOn: true,
          kind: true,
          engineer: true,
          company: true,
          cost: true,
          underWarranty: true,
          summary: true,
          nextDue: true,
        },
      },
      docs: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, fileName: true, mimeType: true, serviceId: true, createdAt: true },
      },
      _count: { select: { services: true } },
    },
  });

  const now = new Date();
  const enriched = assets
    .map((a) => ({
      ...a,
      warranty: warrantyStatus(a.warrantyExpiry, now),
      service: serviceStatus(a.nextServiceDate, now),
      warrantyDays: daysUntil(a.warrantyExpiry, now),
      serviceDays: daysUntil(a.nextServiceDate, now),
      rank: urgencyRank(a, now),
    }))
    .filter((a) => (attention ? a.rank <= 5 : true))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.name.localeCompare(b.name);
    });

  return NextResponse.json({ assets: enriched, imported });
}

export async function POST(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const asset = await prisma.asset.create({
    data: {
      businessId,
      name,
      category: body.category ?? "other",
      location: body.location ?? null,
      make: body.make ?? null,
      model: body.model ?? null,
      serialNumber: body.serialNumber ?? null,
      purchaseDate: dateOrNull(body.purchaseDate),
      purchasePrice: numOrNull(body.purchasePrice),
      warrantyExpiry: dateOrNull(body.warrantyExpiry),
      warrantyProvider: body.warrantyProvider ?? null,
      warrantyNotes: body.warrantyNotes ?? null,
      contactCompany: body.contactCompany ?? null,
      contactName: body.contactName ?? null,
      contactPhone: body.contactPhone ?? null,
      contactEmail: body.contactEmail ?? null,
      serviceIntervalMonths: numOrNull(body.serviceIntervalMonths),
      lastServiceDate: dateOrNull(body.lastServiceDate),
      nextServiceDate: dateOrNull(body.nextServiceDate),
      status: body.status ?? "active",
      notes: body.notes ?? null,
    },
  });

  logActivity({
    businessId,
    userId: session.user.id,
    userName: session.user.name,
    action: "asset_added",
    details: { category: asset.category, hasWarranty: Boolean(asset.warrantyExpiry) },
  });

  return NextResponse.json({ asset }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!(await ownedAsset(id, businessId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      ...(b.name !== undefined && { name: String(b.name).trim() }),
      ...(b.category !== undefined && { category: b.category }),
      ...(b.location !== undefined && { location: b.location || null }),
      ...(b.make !== undefined && { make: b.make || null }),
      ...(b.model !== undefined && { model: b.model || null }),
      ...(b.serialNumber !== undefined && { serialNumber: b.serialNumber || null }),
      ...(b.purchaseDate !== undefined && { purchaseDate: dateOrNull(b.purchaseDate) }),
      ...(b.purchasePrice !== undefined && { purchasePrice: numOrNull(b.purchasePrice) }),
      ...(b.warrantyExpiry !== undefined && { warrantyExpiry: dateOrNull(b.warrantyExpiry) }),
      ...(b.warrantyProvider !== undefined && { warrantyProvider: b.warrantyProvider || null }),
      ...(b.warrantyNotes !== undefined && { warrantyNotes: b.warrantyNotes || null }),
      ...(b.contactCompany !== undefined && { contactCompany: b.contactCompany || null }),
      ...(b.contactName !== undefined && { contactName: b.contactName || null }),
      ...(b.contactPhone !== undefined && { contactPhone: b.contactPhone || null }),
      ...(b.contactEmail !== undefined && { contactEmail: b.contactEmail || null }),
      ...(b.serviceIntervalMonths !== undefined && {
        serviceIntervalMonths: numOrNull(b.serviceIntervalMonths),
      }),
      ...(b.lastServiceDate !== undefined && { lastServiceDate: dateOrNull(b.lastServiceDate) }),
      ...(b.nextServiceDate !== undefined && { nextServiceDate: dateOrNull(b.nextServiceDate) }),
      ...(b.status !== undefined && { status: b.status }),
      ...(b.notes !== undefined && { notes: b.notes || null }),
    },
  });

  return NextResponse.json({ asset });
}

export async function DELETE(req: NextRequest) {
  const session = await requirePermission("assets");
  if (isResponse(session)) return session;

  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  if (!(await ownedAsset(id, businessId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Services and docs cascade at the DB level. The blob objects are left in
  // place deliberately: purge-receipt-images already owns orphan cleanup, and
  // deleting a warranty scan inline would make an accidental row delete
  // unrecoverable.
  await prisma.asset.delete({ where: { id } });

  logActivity({
    businessId,
    userId: session.user.id,
    userName: session.user.name,
    action: "asset_deleted",
    details: { assetId: id },
  });

  return NextResponse.json({ ok: true });
}
