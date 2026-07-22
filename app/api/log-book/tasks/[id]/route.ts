// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  completed: z.boolean().optional(),
  photoUrl: z.string().optional().nullable(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  assignedRole: z.string().optional().nullable(),
  assignedDepartmentId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

// Anyone can mark a task complete (that's the point — staff do the tasks),
// but only manager/admin can edit title/assignment (enforced below).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";

  const existing = await prisma.opsTask.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  if (!isManager) {
    const allowedKeys = new Set(["completed", "photoUrl"]);
    const hasDisallowed = Object.keys(parsed.data).some((k) => !allowedKeys.has(k));
    if (hasDisallowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const existing = await prisma.opsTask.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.opsTask.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
