import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  emoji: z.string().max(8).optional(),
  targetPerWk: z.number().int().min(1).max(21).optional(),
  cue: z.string().max(300).nullish(),
  active: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.navHabit.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const habit = await prisma.navHabit.update({
    where: { id },
    data: Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)),
  });
  return NextResponse.json(habit);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  const r = await prisma.navHabit.deleteMany({ where: { id, userId } });
  if (!r.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
