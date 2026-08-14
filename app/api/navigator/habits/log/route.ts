import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile, DEFAULT_TZ } from "@/lib/navigator/context";
import { dayFromKey, todayKey } from "@/lib/navigator/dates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  habitId: z.string(),
  dateKey: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  done: z.boolean().default(true),
});

// POST — tick / untick a habit for a day
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const habit = await prisma.navHabit.findFirst({ where: { id: parsed.data.habitId, userId } });
  if (!habit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const profile = await getOrCreateProfile(userId);
  const date = dayFromKey(parsed.data.dateKey ?? todayKey(profile.timezone || DEFAULT_TZ));

  const log = await prisma.navHabitLog.upsert({
    where: { habitId_date: { habitId: habit.id, date } },
    create: { userId, habitId: habit.id, date, done: parsed.data.done },
    update: { done: parsed.data.done },
  });
  return NextResponse.json(log);
}
