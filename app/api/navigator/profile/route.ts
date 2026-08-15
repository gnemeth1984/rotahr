import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile } from "@/lib/navigator/context";
import { z } from "zod";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^\d{2}:\d{2}$/);

const dayWindow = z
  .object({ start: time, end: time, note: z.string().max(120).optional() })
  .nullable();

const schema = z.object({
  wakeTime: time.optional(),
  sleepTime: time.optional(),
  workStart: time.optional(),
  workEnd: time.optional(),
  weekPattern: z
    .object({
      mon: dayWindow.optional(),
      tue: dayWindow.optional(),
      wed: dayWindow.optional(),
      thu: dayWindow.optional(),
      fri: dayWindow.optional(),
      sat: dayWindow.optional(),
      sun: dayWindow.optional(),
    })
    .nullish(),
  energyPattern: z.string().max(2000).nullish(),
  timezone: z.string().min(1).max(64).optional(),
  dietary: z.string().max(2000).nullish(),
  kitchen: z.string().max(2000).nullish(),
  exercise: z.string().max(2000).nullish(),
  derailers: z.string().max(2000).nullish(),
  goals: z.string().max(2000).nullish(),
  focusMins: z.number().int().min(10).max(180).optional(),
  breakMins: z.number().int().min(2).max(60).optional(),
  onboarded: z.boolean().optional(),
  notifyEnabled: z.boolean().optional(),
  notifyLeadMins: z.number().int().min(0).max(60).optional(),
  notifyBlocks: z.boolean().optional(),
  notifyDueToday: z.boolean().optional(),
  notifyOverdue: z.boolean().optional(),
  notifyErrands: z.boolean().optional(),
  notifyStuck: z.boolean().optional(),
  notifyIdle: z.boolean().optional(),
  notifyEvening: z.boolean().optional(),
  notifyDuringShift: z.boolean().optional(),
  quietStart: time.optional(),
  quietEnd: time.optional(),
});

export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  return NextResponse.json(await getOrCreateProfile(userId));
}

export async function PUT(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  await getOrCreateProfile(userId);

  // Prisma needs an explicit JsonNull sentinel for nulling a Json column;
  // a bare null would be rejected at runtime.
  const { weekPattern, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (weekPattern !== undefined) {
    data.weekPattern = weekPattern === null ? Prisma.JsonNull : weekPattern;
  }

  const profile = await prisma.navProfile.update({ where: { userId }, data: data as any });
  return NextResponse.json(profile);
}
