export const dynamic = "force-dynamic";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "../../_auth";
import { sendEmail } from "@/lib/email/send";
import { analyseEmail, replySubject } from "@/lib/inbox/assistant";

/** Edit the draft, change status, or regenerate the draft. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    draftBody?: string;
    draftSubject?: string;
    status?: string;
    regenerate?: boolean;
  };

  const msg = await prisma.inboundEmail.findUnique({ where: { id } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (body.regenerate) {
    if (msg.status === "sent") {
      return NextResponse.json({ error: "Already replied to" }, { status: 400 });
    }
    try {
      const lead = await prisma.outreachLead.findUnique({
        where: { email: msg.fromEmail },
        select: { id: true },
      });
      const analysis = await analyseEmail({
        fromEmail: msg.fromEmail,
        fromName: msg.fromName,
        subject: msg.subject,
        bodyText: msg.bodyText,
        isOutreachLead: Boolean(lead),
      });
      const updated = await prisma.inboundEmail.update({
        where: { id },
        data: {
          category: analysis.category,
          intent: analysis.intent,
          sentiment: analysis.sentiment,
          confidence: analysis.confidence,
          language: analysis.language,
          needsHuman: analysis.needsHuman,
          escalationReason: analysis.escalationReason,
          draftSubject: analysis.draftSubject,
          draftBody: analysis.draftBody,
          draftModel: analysis.model,
          draftedAt: new Date(),
          status: "drafted",
          error: null,
        },
      });
      return NextResponse.json({ ok: true, message: updated });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Regeneration failed" },
        { status: 502 }
      );
    }
  }

  const data: Record<string, unknown> = {};
  if (typeof body.draftBody === "string") {
    data.draftBody = body.draftBody;
    // Track that a person changed the wording, so "how good are the drafts?"
    // stays an answerable question later.
    if (body.draftBody !== msg.draftBody) data.editedByHuman = true;
  }
  if (typeof body.draftSubject === "string") data.draftSubject = body.draftSubject;
  if (body.status && ["new", "drafted", "archived", "ignored"].includes(body.status)) {
    data.status = body.status;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.inboundEmail.update({ where: { id }, data });
  return NextResponse.json({ ok: true, message: updated });
}

/** Send the reply. This is the only path in the feature that emails a human. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error, session } = await requirePlatformAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { body?: string; subject?: string };

  const msg = await prisma.inboundEmail.findUnique({ where: { id } });
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Guard against a double-click or a retry sending the same reply twice. The
  // recipient is a real person and a duplicate reply looks careless.
  if (msg.status === "sent") {
    return NextResponse.json({ error: "A reply has already been sent to this message" }, { status: 409 });
  }
  if (msg.isAutomated) {
    return NextResponse.json(
      { error: "This is automated mail (a bounce or auto-reply). Replying would create a loop." },
      { status: 400 }
    );
  }

  const text = (body.body ?? msg.draftBody ?? "").trim();
  if (!text) return NextResponse.json({ error: "Nothing to send — the draft is empty" }, { status: 400 });

  // The UI blocks this too, but the UI is not the security boundary. A
  // [NEEDS GABOR: ...] marker is the AI flagging a fact it had to leave blank;
  // shipping that placeholder to a prospect is a commercial own-goal.
  if (/\[NEEDS GABOR/i.test(text)) {
    return NextResponse.json(
      { error: "Draft still contains a [NEEDS GABOR: …] placeholder — replace it before sending" },
      { status: 400 }
    );
  }

  const subject = replySubject(msg.subject, body.subject ?? msg.draftSubject);

  const result = await sendEmail({
    context: "inbox-reply",
    to: msg.fromEmail,
    subject,
    text,
    html: textToHtml(text),
    // Threading headers so the reply lands in the sender's existing conversation
    // rather than opening a second, disconnected thread.
    headers: msg.messageId
      ? { "In-Reply-To": msg.messageId, References: msg.references ? `${msg.references} ${msg.messageId}` : msg.messageId }
      : undefined,
  });

  if (!result.ok) {
    await prisma.inboundEmail.update({
      where: { id },
      data: { error: result.error ?? "Send failed" },
    });
    return NextResponse.json({ error: result.error ?? "Send failed" }, { status: 502 });
  }

  const updated = await prisma.inboundEmail.update({
    where: { id },
    data: {
      status: "sent",
      sentAt: new Date(),
      sentBody: text,
      sentById: session?.user?.id ?? null,
      editedByHuman: text !== msg.draftBody ? true : msg.editedByHuman,
      error: null,
    },
  });

  return NextResponse.json({ ok: true, id: result.id, message: updated });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain text to simple HTML. The reply is prose, so paragraphs are enough. */
function textToHtml(text: string): string {
  const paras = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1e293b">${paras}</div>`;
}
