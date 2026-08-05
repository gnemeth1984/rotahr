// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  resolved: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  assignedToName: z.string().max(120).optional().nullable(),
  dueAt: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const businessId = session.user.businessId;
  if (!businessId) return NextResponse.json({ error: "No business associated" }, { status: 400 });

  const existing = await prisma.logEntry.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const entry = await prisma.logEntry.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      dueAt: parsed.data.dueAt !== undefined ? (parsed.data.dueAt ? new Date(parsed.data.dueAt) : null) : undefined,
      resolvedAt: parsed.data.resolved === true ? new Date() : parsed.data.resolved === false ? null : undefined,
    },
  });

  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
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

  await prisma.logEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
