// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// POST /api/venues/[id]/checklists/[clId]/items — add item
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; clId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { label, sortOrder } = await req.json();
  if (!label) return NextResponse.json({ error: "Label required" }, { status: 400 });

  // Get next sortOrder if not provided
  let itemSortOrder = sortOrder;
  if (itemSortOrder === undefined) {
    const count = await prisma.venueChecklistItem.count({ where: { checklistId: params.clId } });
    itemSortOrder = count;
  }

  const item = await prisma.venueChecklistItem.create({
    data: { checklistId: params.clId, label, sortOrder: itemSortOrder },
  });
  return NextResponse.json({ item }, { status: 201 });
}
