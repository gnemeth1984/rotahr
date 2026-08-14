import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { getOrCreateProfile } from "@/lib/navigator/context";
import { z } from "zod";

export const dynamic = "force-dynamic";

const time = z.string().regex(/^\d{2}:\d{2}$/);

const schema = z.object({
  wakeTime: time.optional(),
  sleepTime: time.optional(),
  workStart: time.optional(),
  workEnd: time.optional(),
  timezone: z.string().min(1).max(64).optional(),
  dietary: z.string().max(2000).nullish(),
  kitchen: z.string().max(2000).nullish(),
  exercise: z.string().max(2000).nullish(),
  derailers: z.string().max(2000).nullish(),
  goals: z.string().max(2000).nullish(),
  focusMins: z.number().int().min(10).max(180).optional(),
  breakMins: z.number().int().min(2).max(60).optional(),
  onboarded: z.boolean().optional(),
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
  const profile = await prisma.navProfile.update({ where: { userId }, data: parsed.data });
  return NextResponse.json(profile);
}
