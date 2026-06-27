// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

// DELETE /api/venues/[id]/checklists/[clId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; clId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.venueChecklist.delete({ where: { id: params.clId } });
  return NextResponse.json({ ok: true });
}

// PATCH /api/venues/[id]/checklists/[clId] — rename checklist
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; clId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { title, type } = await req.json();
  const checklist = await prisma.venueChecklist.update({
    where: { id: params.clId },
    data: {
      ...(title !== undefined && { title }),
      ...(type !== undefined && { type }),
    },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({ checklist });
}
