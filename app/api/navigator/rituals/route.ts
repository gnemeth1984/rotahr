import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile, DEFAULT_TZ, windowForDate } from "@/lib/navigator/context";
import { todayKey, dayFromKey, nowTime } from "@/lib/navigator/dates";
import { ritualsForDay, currentRitual, type RitualId } from "@/lib/navigator/rituals";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RITUAL_IDS = ["morning", "midday", "shutdown", "weekly", "monthly"] as const;

const schema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ritual: z.enum(RITUAL_IDS),
  /** Step id -> ticked. Partial updates merge, so one tap saves one step. */
  steps: z.record(z.string().max(40), z.boolean()),
  /** Mark the whole ritual finished (or un-finish it). */
  complete: z.boolean().optional(),
});

const toMins = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function profileFor(p: {
  wakeTime: string;
  sleepTime: string;
  workStart: string;
  workEnd: string;
  focusMins: number;
  ritualsEnabled: boolean;
}) {
  return {
    wakeTime: p.wakeTime,
    sleepTime: p.sleepTime,
    workStart: p.workStart,
    workEnd: p.workEnd,
    focusMins: p.focusMins,
    ritualsEnabled: p.ritualsEnabled,
  };
}

// GET ?date=YYYY-MM-DD — today's ritual definitions plus what's already ticked.
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const key = new URL(req.url).searchParams.get("date") ?? todayKey(tz);

  const { window: shift } = windowForDate(profile, key);
  const rituals = ritualsForDay(profileFor(profile), key, shift);
  const logs = await prisma.navRitualLog.findMany({ where: { userId, date: dayFromKey(key) } });

  return NextResponse.json({
    date: key,
    enabled: profile.ritualsEnabled,
    current: currentRitual(rituals, toMins(nowTime(tz))),
    rituals,
    logs,
  });
}

// POST — tick a step, or complete the ritual.
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const key = parsed.data.dateKey ?? todayKey(tz);
  const date = dayFromKey(key);
  const ritual = parsed.data.ritual as RitualId;

  // Only accept step ids that actually exist in today's definition — otherwise the
  // log fills with keys from an older shape of the ritual and never reads as done.
  const { window: shift } = windowForDate(profile, key);
  const def = ritualsForDay(profileFor(profile), key, shift).find((r) => r.id === ritual);
  if (!def) return NextResponse.json({ error: "Ritual not scheduled for that day" }, { status: 400 });
  const valid = new Set(def.steps.map((s) => s.id));

  const existing = await prisma.navRitualLog.findUnique({
    where: { userId_date_ritual: { userId, date, ritual } },
  });
  const prevSteps =
    existing?.steps && typeof existing.steps === "object" && !Array.isArray(existing.steps)
      ? (existing.steps as Record<string, boolean>)
      : {};

  const steps: Record<string, boolean> = { ...prevSteps };
  for (const [k, v] of Object.entries(parsed.data.steps)) {
    if (valid.has(k)) steps[k] = v;
  }

  const allTicked = def.steps.every((s) => steps[s.id] === true);
  const completedAt =
    parsed.data.complete === true
      ? new Date()
      : parsed.data.complete === false
        ? null
        : allTicked
          ? (existing?.completedAt ?? new Date())
          : null;

  const log = await prisma.navRitualLog.upsert({
    where: { userId_date_ritual: { userId, date, ritual } },
    create: { userId, date, ritual, steps, completedAt },
    update: { steps, completedAt },
  });

  return NextResponse.json(log);
}
