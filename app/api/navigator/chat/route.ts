import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { navigatorChat } from "@/lib/navigator/ai";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ message: z.string().min(1).max(4000) });

// GET — recent conversation
export async function GET() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const messages = await prisma.navChatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return NextResponse.json(messages);
}

// POST — send a message, the assistant may act on real data via tools
export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  const history = await prisma.navChatMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 14,
  });

  await prisma.navChatMessage.create({
    data: { userId, role: "user", content: parsed.data.message },
  });

  try {
    const { reply, actions } = await navigatorChat(
      userId,
      parsed.data.message,
      history.reverse().map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    );

    const saved = await prisma.navChatMessage.create({
      data: { userId, role: "assistant", content: reply, actions: actions.length ? actions : undefined },
    });
    return NextResponse.json({ message: saved, actions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI request failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — clear the thread (fresh start, no guilt)
export async function DELETE() {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  await prisma.navChatMessage.deleteMany({ where: { userId } });
  return NextResponse.json({ ok: true });
}
