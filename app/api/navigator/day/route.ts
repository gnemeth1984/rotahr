import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { generateDayPlan } from "@/lib/navigator/ai";
import { getOrCreateProfile, DEFAULT_TZ } from "@/lib/navigator/context";
import { dayFromKey, todayKey } from "@/lib/navigator/dates";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const generateSchema = z.object({
  energy: z.number().int().min(1).max(5),
  availableHours: z.number().min(0.5).max(18),
  mood: z.string().max(200).optional(),
  mustDo: z.string().max(1000).optional(),
  dateKey: dateKey.optional(),
});

const patchSchema = z.object({
  dateKey: dateKey.optional(),
  energy: z.number().int().min(1).max(5).nullish(),
  mood: z.string().max(200).nullish(),
  focusTheme: z.string().max(300).nullish(),
  anchor: z.string().max(500).nullish(),
  reflection: z.string().max(4000).nullish(),
  wins: z.string().max(2000).nullish(),
  friction: z.string().max(2000).nullish(),
  scoreOutOf5: z.number().int().min(1).max(5).nullish(),
  blocks: z
    .array(
      z.object({
        start: z.string(),
        end: z.string(),
        label: z.string(),
        kind: z.string(),
        why: z.string().optional(),
        taskId: z.string().optional(),
        done: z.boolean().optional(),
      })
    )
    .optional(),
});

// GET ?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  const key = new URL(req.url).searchParams.get("date") ?? todayKey(profile.timezone || DEFAULT_TZ);
  const plan = await prisma.navDayPlan.findUnique({
    where: { userId_date: { userId, date: dayFromKey(key) } },
  });
  return NextResponse.json(plan);
}

// POST — generate a plan with AI
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = generateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const plan = await generateDayPlan(userId, parsed.data);
    return NextResponse.json(plan);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Plan failed" }, { status: 500 });
  }
}

// PATCH — edit blocks, tick a block off, save the reflection
export async function PATCH(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const profile = await getOrCreateProfile(userId);
  const { dateKey: key, ...rest } = parsed.data;
  const date = dayFromKey(key ?? todayKey(profile.timezone || DEFAULT_TZ));

  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));

  const plan = await prisma.navDayPlan.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });
  return NextResponse.json(plan);
}
