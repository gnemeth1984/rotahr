// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  note: z.string().min(1).max(2000),
});

// POST /api/log-book/entries/[id]/updates — add a status update note
// (manager/admin only — e.g. "Called Ben, due Tuesday 2pm")
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const existing = await prisma.logEntry.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const update = await prisma.logEntryUpdate.create({
    data: {
      logEntryId: params.id,
      note: parsed.data.note,
      createdById: session.user.id,
    },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ update }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const updateId = searchParams.get("updateId");
  if (!updateId) return NextResponse.json({ error: "Missing updateId" }, { status: 400 });

  await prisma.logEntryUpdate.delete({ where: { id: updateId } });
  return NextResponse.json({ success: true });
}
