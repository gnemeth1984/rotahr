// Reads a Navigator reply aloud.
//
// Takes a messageId rather than raw text: the text is looked up from the
// caller's own messages, so this can never be used to bill arbitrary
// text-to-speech, and the audio always matches what is actually on screen.
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ messageId: z.string().min(1) });

// Hard ceiling on one request. Navigator replies are told to stay under ~120
// words, so this only ever trips on something pathological.
const MAX_CHARS = 3000;

const VOICE = "alloy";

export async function POST(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Voice is not configured on the server." }, { status: 503 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const message = await prisma.navChatMessage.findFirst({
    where: { id: parsed.data.messageId, userId },
    select: { content: true, role: true },
  });

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  if (message.role !== "assistant") {
    return NextResponse.json({ error: "Only Navigator replies can be read out." }, { status: 400 });
  }

  const text = forSpeech(message.content);
  if (!text) return NextResponse.json({ error: "Nothing to read out." }, { status: 400 });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: VOICE,
      input: text,
      instructions:
        "Read this calmly and warmly, like a friend talking, not an announcer. " +
        "Steady, unhurried pace. Small pause between list items so each one lands.",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Text-to-speech failed";
    console.error("[navigator/speak]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/**
 * Navigator answers in terse markdown-ish lists. Spoken raw, that comes out as
 * "asterisk asterisk start now asterisk asterisk", so strip the notation and
 * leave punctuation the voice can actually use for pacing.
 */
function forSpeech(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    // "1. Thing" -> "Thing." so the voice doesn't read out every number.
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*[-–—]{3,}\s*$/gm, " ")
    // A bare line with no terminator runs into the next one; give it a stop.
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return "";
      return /[.!?:,;]$/.test(t) ? t : `${t}.`;
    })
    .filter(Boolean)
    .join("\n")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, MAX_CHARS);
}
