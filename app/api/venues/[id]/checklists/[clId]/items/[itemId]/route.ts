export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

// Tenant isolation: both handlers wrote on a raw item ID, so a manager could
// edit or delete items on another business's checklist. VenueChecklistItem has
// no businessId column — scope through the parent checklist.
async function ownedItem(
  itemId: string,
  clId: string,
  venueId: string,
  businessId: string
) {
  return prisma.venueChecklistItem.findFirst({
    where: {
      id: itemId,
      checklistId: clId,
      checklist: { venueId, businessId },
    },
    select: { id: true },
  });
}

// DELETE /api/venues/[id]/checklists/[clId]/items/[itemId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; clId: string; itemId: string } }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  if (!(await ownedItem(params.itemId, params.clId, params.id, t.businessId))) {
    return notFound();
  }

  await prisma.venueChecklistItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/venues/[id]/checklists/[clId]/items/[itemId] — update label/sortOrder
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; clId: string; itemId: string } }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  if (!(await ownedItem(params.itemId, params.clId, params.id, t.businessId))) {
    return notFound();
  }

  const { label, sortOrder } = await req.json();
  const item = await prisma.venueChecklistItem.update({
    where: { id: params.itemId },
    data: {
      ...(label !== undefined && { label }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });
  return NextResponse.json({ item });
}
