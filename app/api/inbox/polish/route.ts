// @ts-nocheck
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Polish a reply Gabor typed himself.
 *
 * Platform-admin only, like everything else under /api/inbox: this endpoint
 * spends OpenAI credit on arbitrary text, so an open version of it is a free
 * text-rewriting API hosted at his expense.
 *
 * Returns the polished text. It never writes to the database and never sends
 * anything - the result lands in a textarea he still has to read and click
 * Send on. Saving is the existing, separate "Save draft" action.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "../_auth";
import { polishEmail } from "@/lib/inbox/polish";

export async function POST(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    text?: string;
    mode?: string;
    messageId?: string;
  };

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Nothing to polish" }, { status: 400 });

  const mode = body.mode === "fix" ? "fix" : "rewrite";

  // Context is a convenience, not a requirement. If the lookup fails the polish
  // still runs - losing the "who am I writing to" hint is much better than
  // failing the whole action over it.
  let context = null;
  if (body.messageId) {
    try {
      const msg = await prisma.inboundEmail.findUnique({
        where: { id: body.messageId },
        select: { fromEmail: true, fromName: true, subject: true, bodyText: true },
      });
      if (msg) context = msg;
    } catch {
      context = null;
    }
  }

  try {
    const result = await polishEmail({ text, mode, context });
    return NextResponse.json({
      text: result.text,
      mode: result.mode,
      refused: result.refused,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Polish failed" },
      { status: 500 },
    );
  }
}
