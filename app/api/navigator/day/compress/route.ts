import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile, DEFAULT_TZ, windowForDate } from "@/lib/navigator/context";
import { todayKey, dayFromKey, nowTime } from "@/lib/navigator/dates";
import { compressDay, planIsStale } from "@/lib/navigator/compress";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Override "now" — only used by tests and by a manual replan of a past day. */
  atTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  /** Preview without saving, so the user can see the damage before agreeing to it. */
  dryRun: z.boolean().optional(),
});

const toMins = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * 4.2 Day Compression — "I'm 4 hours behind, rescue the day".
 *
 * Deliberately NOT an AI call. Re-planning with the model would take 20 seconds,
 * cost a token spend, and could return something different every time. The
 * squeeze is arithmetic, so it's done in arithmetic: instant, deterministic, and
 * it keeps the order the user already agreed to.
 */
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const key = parsed.data.dateKey ?? todayKey(tz);
  const date = dayFromKey(key);

  const plan = await prisma.navDayPlan.findUnique({ where: { userId_date: { userId, date } } });
  if (!plan || !Array.isArray(plan.blocks) || !plan.blocks.length) {
    return NextResponse.json({ error: "No plan with blocks to compress" }, { status: 400 });
  }

  const nowMins = toMins(parsed.data.atTime ?? nowTime(tz));

  // The day ends at bedtime. If bedtime is past midnight (e.g. 01:00 after a late
  // shift) treat it as end-of-day rather than a negative window.
  const sleepMins = toMins(profile.sleepTime || "23:00");
  const dayEndMins = sleepMins <= nowMins ? 1439 : sleepMins;

  const { window: shift } = windowForDate(profile, key);

  const result = compressDay(plan.blocks, nowMins, dayEndMins, shift);

  if (parsed.data.dryRun) {
    return NextResponse.json({ ...result, saved: false, wasStale: planIsStale(plan.blocks, nowMins) });
  }

  const saved = await prisma.navDayPlan.update({
    where: { userId_date: { userId, date } },
    data: { blocks: result.blocks as any },
  });

  // Dropped work is not silently deleted. Anything that had a task behind it goes
  // back to the task list untouched, so tomorrow can pick it up.
  const droppedTaskIds = result.dropped.map((b) => b.taskId).filter((id): id is string => !!id);
  if (droppedTaskIds.length) {
    await prisma.navTask.updateMany({
      where: { userId, id: { in: droppedTaskIds }, status: "doing" },
      data: { status: "todo" },
    });
  }

  return NextResponse.json({
    ...result,
    saved: true,
    plan: saved,
    releasedTasks: droppedTaskIds.length,
  });
}
