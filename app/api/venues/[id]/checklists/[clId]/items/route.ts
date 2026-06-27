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

  const { text, order } = await req.json();
  if (!text) return NextResponse.json({ error: "Text required" }, { status: 400 });

  // Get next order if not provided
  let itemOrder = order;
  if (itemOrder === undefined) {
    const count = await prisma.venueChecklistItem.count({ where: { checklistId: params.clId } });
    itemOrder = count;
  }

  const item = await prisma.venueChecklistItem.create({
    data: { checklistId: params.clId, text, order: itemOrder },
  });
  return NextResponse.json({ item }, { status: 201 });
}
