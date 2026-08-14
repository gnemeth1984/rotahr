import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { generateWorkouts } from "@/lib/navigator/ai";
import { getOrCreateProfile, DEFAULT_TZ } from "@/lib/navigator/context";
import { dayFromKey, todayKey, addDaysKey } from "@/lib/navigator/dates";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    mode: z.enum(["single", "week"]).default("single"),
    minutes: z.number().int().min(5).max(120).default(15),
    mood: z.string().max(120).default("normal"),
    where: z.string().max(120).default("home, no equipment"),
    dateKey: dateKey.optional(),
  }),
  z.object({
    action: z.literal("add"),
    title: z.string().min(1).max(200),
    kind: z.enum(["strength", "cardio", "mobility", "walk", "movement"]).default("movement"),
    durationMins: z.number().int().min(1).max(300).default(10),
    intensity: z.enum(["easy", "moderate", "hard"]).default("easy"),
    dateKey: dateKey.optional(),
  }),
]);

export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? todayKey(profile.timezone || DEFAULT_TZ);
  const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days") ?? 7)));

  const workouts = await prisma.navWorkout.findMany({
    where: { userId, date: { gte: dayFromKey(from), lt: dayFromKey(addDaysKey(from, days)) } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(workouts);
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await getOrCreateProfile(userId);
  const d = parsed.data;
  const key = d.dateKey ?? todayKey(profile.timezone || DEFAULT_TZ);

  if (d.action === "add") {
    const w = await prisma.navWorkout.create({
      data: {
        userId,
        date: dayFromKey(key),
        title: d.title,
        kind: d.kind,
        durationMins: d.durationMins,
        intensity: d.intensity,
        steps: [],
      },
    });
    return NextResponse.json(w, { status: 201 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const out = await generateWorkouts(userId, {
      dateKey: key,
      minutes: d.minutes,
      mood: d.mood,
      where: d.where,
      mode: d.mode,
    });
    const workouts = await prisma.navWorkout.findMany({
      where: { userId, date: { gte: dayFromKey(key), lt: dayFromKey(addDaysKey(key, d.mode === "week" ? 7 : 1)) } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ ...out, workouts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Workout plan failed" }, { status: 500 });
  }
}
