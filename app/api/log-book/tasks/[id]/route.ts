// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  completed: z.boolean().optional(),
  photoUrl: z.string().optional().nullable(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("logbook");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const existing = await prisma.opsTask.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  if (existing.requirePhoto && parsed.data.completed === true && !parsed.data.photoUrl && !existing.photoUrl) {
    return NextResponse.json({ error: "This task requires a photo before it can be marked complete" }, { status: 400 });
  }

  const task = await prisma.opsTask.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : undefined,
      completedAt: parsed.data.completed === true ? new Date() : parsed.data.completed === false ? null : undefined,
      completedById: parsed.data.completed === true ? session.user.id : parsed.data.completed === false ? null : undefined,
    },
  });

  return NextResponse.json({ task });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("logbook");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const existing = await prisma.opsTask.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.opsTask.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
