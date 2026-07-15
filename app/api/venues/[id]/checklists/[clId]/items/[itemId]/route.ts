// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// DELETE /api/venues/[id]/checklists/[clId]/items/[itemId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; clId: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.venueChecklistItem.delete({ where: { id: params.itemId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/venues/[id]/checklists/[clId]/items/[itemId] — update label/sortOrder
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; clId: string; itemId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
