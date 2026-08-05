// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { requireTenant, isResponse, notFound } from "@/lib/auth/tenant";
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
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

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
  const t = await requireTenant({ manager: true });
  if (isResponse(t)) return t;

  const { searchParams } = new URL(req.url);
  const updateId = searchParams.get("updateId");
  if (!updateId) return NextResponse.json({ error: "Missing updateId" }, { status: 400 });

  // Tenant isolation: this deleted any update row by ID, so a manager could
  // delete another business's log-book comments. Scope through the log entry.
  const existing = await prisma.logEntryUpdate.findFirst({
    where: { id: updateId, logEntryId: params.id, logEntry: { businessId: t.businessId } },
    select: { id: true },
  });
  if (!existing) return notFound();

  await prisma.logEntryUpdate.delete({ where: { id: updateId } });
  return NextResponse.json({ success: true });
}
