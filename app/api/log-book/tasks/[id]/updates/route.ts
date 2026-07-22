// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const task = await prisma.opsTask.findUnique({ where: { id: params.id } });
  if (!task || task.businessId !== businessId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates = await prisma.opsTaskUpdate.findMany({
    where: { opsTaskId: params.id },
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ updates });
}

const schema = z.object({ note: z.string().min(1).max(1000) });

// Anyone who can see the task can comment on it — this is the point of a
// comment thread (staff discussing progress), not manager-only editing.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const task = await prisma.opsTask.findUnique({ where: { id: params.id } });
  if (!task || task.businessId !== businessId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const update = await prisma.opsTaskUpdate.create({
    data: { opsTaskId: params.id, note: parsed.data.note, createdById: session.user.id },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ update }, { status: 201 });
}
