import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { breakdownTask } from "@/lib/navigator/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST — AI-split a task into micro-steps with start triggers
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const out = await breakdownTask(userId, id);
    const steps = await prisma.navTask.findMany({
      where: { userId, parentId: id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ ...out, tasks: steps });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Breakdown failed" }, { status: 500 });
  }
}
