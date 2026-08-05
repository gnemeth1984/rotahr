export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

// Tenant isolation: the checklist ID came straight from the URL, so a manager
// could append items to another business's checklist.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; clId: string } }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const checklist = await prisma.venueChecklist.findFirst({
    where: { id: params.clId, venueId: params.id, businessId: t.businessId },
    select: { id: true },
  });
  if (!checklist) return notFound();

  const { label, sortOrder } = await req.json();
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  // Get next sortOrder if not provided
  let itemSortOrder = sortOrder;
  if (itemSortOrder === undefined) {
    const count = await prisma.venueChecklistItem.count({
      where: { checklistId: params.clId },
    });
    itemSortOrder = count;
  }

  const item = await prisma.venueChecklistItem.create({
    data: { checklistId: params.clId, label, sortOrder: itemSortOrder },
  });
  return NextResponse.json({ item }, { status: 201 });
}
