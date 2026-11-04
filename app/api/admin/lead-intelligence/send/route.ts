import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, apiError, mutationGuard } from "@/lib/lead-intelligence/auth";
import { LeadSendError, logLeadCall, sendConfiguration, sendLeadEmail } from "@/lib/lead-intelligence/send";
import { getSentToday } from "@/lib/outreach/sender";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const emailSchema = z.object({
  action: z.literal("email").optional(),
  leadId: z.string().min(1).max(100),
  kind: z.enum(["cold", "followup"]),
  to: z.string().min(3).max(254),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  force: z.boolean().optional(),
});
const callSchema = z.object({
  action: z.literal("call"),
  leadId: z.string().min(1).max(100),
  outcome: z.string().max(500).default(""),
});

function sendError(e: unknown) {
  if (e instanceof LeadSendError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  return apiError(e);
}

/** Sending status for the composer: configured, From address, today's shared count. Sends nothing. */
export async function GET() {
  const denied = await adminGuard(); if (denied) return denied;
  try {
    return NextResponse.json({ ...sendConfiguration(), sentToday: await getSentToday() });
  } catch (e) { return apiError(e); }
}

/** One email to one lead, or a call log. Only ever runs because an admin pressed the button. */
export async function POST(req: NextRequest) {
  const denied = await adminGuard() || mutationGuard(req); if (denied) return denied;
  const raw = await req.json().catch(() => null);
  if (raw && typeof raw === "object" && (raw as { action?: unknown }).action === "call") {
    const call = callSchema.safeParse(raw);
    if (!call.success) return NextResponse.json({ error: "Invalid call log." }, { status: 400 });
    try { return NextResponse.json({ ok: true, lead: await logLeadCall(call.data.leadId, call.data.outcome) }); }
    catch (e) { return sendError(e); }
  }
  const email = emailSchema.safeParse(raw);
  if (!email.success) return NextResponse.json({ error: "Recipient, subject (max 200 characters) and message (max 5000) are required." }, { status: 400 });
  try { return NextResponse.json(await sendLeadEmail(email.data)); }
  catch (e) { return sendError(e); }
}
