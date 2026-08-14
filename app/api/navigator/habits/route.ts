import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  emoji: z.string().max(8).optional(),
  targetPerWk: z.number().int().min(1).max(21).default(7),
  cue: z.string().max(300).nullish(),
});

export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const habits = await prisma.navHabit.findMany({
    where: { userId },
    orderBy: [{ active: "desc" }, { order: "asc" }],
    include: { logs: { where: { done: true }, orderBy: { date: "desc" }, take: 60 } },
  });
  return NextResponse.json(habits);
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const count = await prisma.navHabit.count({ where: { userId } });
  const habit = await prisma.navHabit.create({
    data: {
      userId,
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? "*",
      targetPerWk: parsed.data.targetPerWk,
      cue: parsed.data.cue ?? null,
      order: count,
    },
  });
  return NextResponse.json(habit, { status: 201 });
}
