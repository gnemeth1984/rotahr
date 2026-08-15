import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { breakdownTask, type BreakdownMode } from "@/lib/navigator/ai";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Body is optional — an older client with no body still gets the default split.
const schema = z.object({ mode: z.enum(["steps", "low_energy", "smallest"]).optional() });

// POST — AI-split a task into micro-steps with start triggers
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const mode: BreakdownMode = parsed.success ? (parsed.data.mode ?? "steps") : "steps";

  try {
    const out = await breakdownTask(userId, id, mode);
    const steps = await prisma.navTask.findMany({
      where: { userId, parentId: id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ ...out, tasks: steps });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Breakdown failed" }, { status: 500 });
  }
}
