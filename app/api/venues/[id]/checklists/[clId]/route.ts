export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

// Tenant isolation: both handlers wrote on a raw checklist ID, so a manager
// could rename or delete another business's checklists.
async function ownedChecklist(clId: string, venueId: string, businessId: string) {
  return prisma.venueChecklist.findFirst({
    where: { id: clId, venueId, businessId },
    select: { id: true },
  });
}

// DELETE /api/venues/[id]/checklists/[clId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; clId: string } }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  if (!(await ownedChecklist(params.clId, params.id, t.businessId))) return notFound();

  await prisma.venueChecklist.delete({ where: { id: params.clId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/venues/[id]/checklists/[clId] — rename checklist
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; clId: string } }
) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  if (!(await ownedChecklist(params.clId, params.id, t.businessId))) return notFound();

  const { title, category } = await req.json();
  const checklist = await prisma.venueChecklist.update({
    where: { id: params.clId },
    data: {
      ...(title !== undefined && { title }),
      ...(category !== undefined && { category }),
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ checklist });
}
