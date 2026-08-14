import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const startSchema = z.object({
  label: z.string().min(1).max(200),
  plannedMins: z.number().int().min(5).max(240).default(50),
  taskId: z.string().nullish(),
});

const patchSchema = z.object({
  id: z.string(),
  action: z.enum(["end", "abandon", "distraction"]),
  outcome: z.string().max(2000).nullish(),
});

// GET — the live session, if any, plus this week's totals
export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const live = await prisma.navFocusSession.findFirst({
    where: { userId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
  const recent = await prisma.navFocusSession.findMany({
    where: { userId, startedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) } },
    orderBy: { startedAt: "desc" },
    take: 30,
  });
  const minutes = recent.reduce((sum, s) => sum + (s.actualMins ?? 0), 0);
  return NextResponse.json({ live, recent, weekMinutes: minutes });
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = startSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Only ever one live session — starting a new one closes the old.
  await prisma.navFocusSession.updateMany({
    where: { userId, endedAt: null },
    data: { endedAt: new Date() },
  });

  const session = await prisma.navFocusSession.create({
    data: {
      userId,
      label: parsed.data.label,
      plannedMins: parsed.data.plannedMins,
      taskId: parsed.data.taskId ?? null,
    },
  });

  if (parsed.data.taskId) {
    await prisma.navTask.updateMany({
      where: { id: parsed.data.taskId, userId },
      data: { status: "doing" },
    });
  }

  return NextResponse.json(session, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const session = await prisma.navFocusSession.findFirst({ where: { id: parsed.data.id, userId } });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.action === "distraction") {
    const updated = await prisma.navFocusSession.update({
      where: { id: session.id },
      data: { distractions: { increment: 1 } },
    });
    return NextResponse.json(updated);
  }

  const endedAt = new Date();
  const actualMins = Math.max(1, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000));
  const updated = await prisma.navFocusSession.update({
    where: { id: session.id },
    data: {
      endedAt,
      actualMins,
      completed: parsed.data.action === "end",
      outcome: parsed.data.outcome ?? null,
    },
  });
  return NextResponse.json(updated);
}
