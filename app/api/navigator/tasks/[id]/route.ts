import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { dayFromKey } from "@/lib/navigator/dates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(4000).nullish(),
  project: z.string().max(120).nullish(),
  status: z.enum(["todo", "doing", "done", "parked"]).optional(),
  priority: z.enum(["urgent", "important", "quickwin", "later"]).optional(),
  effortMins: z.number().int().min(1).max(1440).nullish(),
  startTrigger: z.string().max(500).nullish(),
  scheduledFor: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const existing = await prisma.navTask.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { scheduledFor, status, ...rest } = parsed.data;
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined)
  );
  if (status) {
    data.status = status;
    data.completedAt = status === "done" ? new Date() : null;
  }
  if (scheduledFor !== undefined) {
    data.scheduledFor = scheduledFor ? dayFromKey(scheduledFor) : null;
  }

  const task = await prisma.navTask.update({ where: { id }, data });

  // Completing a parent closes out its micro-steps too — no orphan guilt list.
  if (status === "done") {
    await prisma.navTask.updateMany({
      where: { userId, parentId: id, status: { not: "done" } },
      data: { status: "done", completedAt: new Date() },
    });
  }

  return NextResponse.json(task);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  const existing = await prisma.navTask.findFirst({ where: { id, userId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.navTask.deleteMany({ where: { userId, parentId: id } });
  await prisma.navTask.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
