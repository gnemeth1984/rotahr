import { NextRequest, NextResponse } from "next/server";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { motivationNudge, decideForMe, weeklyReview } from "@/lib/navigator/ai";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("motivate"), situation: z.string().max(1000).optional() }),
  z.object({ action: z.literal("decide"), question: z.string().min(1).max(500) }),
  z.object({ action: z.literal("week") }),
]);

// POST — the three one-tap coaching moves: unstick me, decide for me, review my week
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    if (parsed.data.action === "motivate") {
      const text = await motivationNudge(userId, parsed.data.situation ?? "");
      return NextResponse.json({ text });
    }
    if (parsed.data.action === "decide") {
      return NextResponse.json(await decideForMe(userId, parsed.data.question));
    }
    return NextResponse.json(await weeklyReview(userId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Coach failed" }, { status: 500 });
  }
}
