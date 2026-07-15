// @ts-nocheck
export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db";
import { z } from "zod";

const patchSchema = z.object({
  resolved: z.boolean().optional(),
  title: z.string().optional(),
  description: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("logbook");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

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
      resolvedAt: parsed.data.resolved === true ? new Date() : parsed.data.resolved === false ? null : undefined,
    },
  });

  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requirePermission("logbook");
  if (isResponse(session)) return session;
  const businessId = session.user.businessId ?? "christys-bar-seed-id";

  const existing = await prisma.logEntry.findUnique({ where: { id: params.id } });
  if (!existing || existing.businessId !== businessId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.logEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
