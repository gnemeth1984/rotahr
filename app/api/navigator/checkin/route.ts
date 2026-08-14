import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  kind: z.enum(["energy", "hunger", "overstim", "mood", "focus"]),
  value: z.number().int().min(1).max(5),
  note: z.string().max(500).nullish(),
});

// GET ?days=14 — raw readings for the pattern strip
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const days = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 14)));
  const checkins = await prisma.navCheckin.findMany({
    where: { userId, at: { gte: new Date(Date.now() - days * 86400000) } },
    orderBy: { at: "desc" },
    take: 300,
  });
  return NextResponse.json(checkins);
}

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const checkin = await prisma.navCheckin.create({
    data: {
      userId,
      kind: parsed.data.kind,
      value: parsed.data.value,
      note: parsed.data.note ?? null,
    },
  });
  return NextResponse.json(checkin, { status: 201 });
}
