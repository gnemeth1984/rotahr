export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db";

// Tenant isolation: both handlers trusted the venue ID from the URL, so any
// signed-in user could read — and any manager could add to — another business's
// venue checklists.
async function ownedVenue(venueId: string, businessId: string) {
  return prisma.venue.findFirst({
    where: { id: venueId, businessId },
    select: { id: true, businessId: true },
  });
}

// GET /api/venues/[id]/checklists
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const t = await requireTenant();
  if (isResponse(t)) return t;

  if (!(await ownedVenue(params.id, t.businessId))) return notFound();

  const checklists = await prisma.venueChecklist.findMany({
    where: { venueId: params.id, businessId: t.businessId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ checklists });
}

// POST /api/venues/[id]/checklists — create checklist
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const venue = await ownedVenue(params.id, t.businessId);
  if (!venue) return notFound();

  const { title, category, items } = await req.json();
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });

  const itemList: string[] = Array.isArray(items)
    ? items.filter((i: string) => i && i.trim())
    : [];

  const checklist = await prisma.venueChecklist.create({
    data: {
      venueId: params.id,
      businessId: venue.businessId,
      title,
      category: category ?? "general",
      items: {
        create: itemList.map((label, i) => ({ label, sortOrder: i })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ checklist }, { status: 201 });
}
