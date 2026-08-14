import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { generateMeals } from "@/lib/navigator/ai";
import { getOrCreateProfile, DEFAULT_TZ } from "@/lib/navigator/context";
import { dayFromKey, todayKey, addDaysKey } from "@/lib/navigator/dates";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    mode: z.enum(["day", "week"]).default("day"),
    maxPrepMins: z.number().int().min(2).max(120).default(20),
    dateKey: dateKey.optional(),
  }),
  z.object({
    action: z.literal("add"),
    slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    title: z.string().min(1).max(200),
    prepMins: z.number().int().min(0).max(600).default(10),
    ingredients: z.array(z.string().max(120)).max(30).optional(),
    dateKey: dateKey.optional(),
  }),
]);

// GET ?date= or ?from=&days=
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? url.searchParams.get("date") ?? todayKey(tz);
  const days = Math.min(14, Math.max(1, Number(url.searchParams.get("days") ?? 1)));

  const meals = await prisma.navMeal.findMany({
    where: { userId, date: { gte: dayFromKey(from), lt: dayFromKey(addDaysKey(from, days)) } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(meals);
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await getOrCreateProfile(userId);
  const tz = profile.timezone || DEFAULT_TZ;
  const d = parsed.data;
  const key = d.dateKey ?? todayKey(tz);

  if (d.action === "add") {
    const meal = await prisma.navMeal.create({
      data: {
        userId,
        date: dayFromKey(key),
        slot: d.slot,
        title: d.title,
        prepMins: d.prepMins,
        ingredients: d.ingredients ?? [],
      },
    });
    return NextResponse.json(meal, { status: 201 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const out = await generateMeals(userId, { dateKey: key, mode: d.mode, maxPrepMins: d.maxPrepMins });
    const meals = await prisma.navMeal.findMany({
      where: {
        userId,
        date: { gte: dayFromKey(key), lt: dayFromKey(addDaysKey(key, d.mode === "week" ? 7 : 1)) },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ ...out, meals });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Meal plan failed" }, { status: 500 });
  }
}
