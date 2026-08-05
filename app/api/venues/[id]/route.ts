export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

// Tenant isolation: PATCH/DELETE wrote on a raw client-supplied venue ID, so a
// manager could rename or deactivate another business's venue.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;
  const businessId = t.businessId;

  const existing = await prisma.venue.findFirst({
    where: { id: params.id, businessId },
    select: { id: true },
  });
  if (!existing) return notFound();

  const body = await req.json();
  const {
    name, address, geoLat, geoLng, geoRadius, timezone, isDefault, active,
    phone, email, website, capacity, venueType, cuisine,
    foodInfo, drinksInfo, equipment, notes,
  } = body;

  if (isDefault) {
    await prisma.venue.updateMany({ where: { businessId }, data: { isDefault: false } });
  }

  const venue = await prisma.venue.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(address !== undefined && { address }),
      ...(geoLat !== undefined && { geoLat }),
      ...(geoLng !== undefined && { geoLng }),
      ...(geoRadius !== undefined && { geoRadius }),
      ...(timezone !== undefined && { timezone }),
      ...(isDefault !== undefined && { isDefault }),
      ...(active !== undefined && { active }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(website !== undefined && { website }),
      ...(capacity !== undefined && { capacity: capacity ? Number(capacity) : null }),
      ...(venueType !== undefined && { venueType }),
      ...(cuisine !== undefined && { cuisine }),
      ...(foodInfo !== undefined && { foodInfo }),
      ...(drinksInfo !== undefined && { drinksInfo }),
      ...(equipment !== undefined && { equipment }),
      ...(notes !== undefined && { notes }),
    },
  });
  return NextResponse.json({ venue });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const existing = await prisma.venue.findFirst({
    where: { id: params.id, businessId: t.businessId },
    select: { id: true },
  });
  if (!existing) return notFound();

  // Soft delete
  await prisma.venue.update({ where: { id: params.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
