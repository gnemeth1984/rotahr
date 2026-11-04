import { prisma } from "@/lib/db";
import { isSuppressed, normaliseEmail, suppress, unsubscribeUrl } from "@/lib/email/suppression";
import { isUnroutableAddress } from "@/lib/email/send";
import { checkDomain, domainOf } from "@/lib/outreach/mx-check";
import { isBrevoConfigured, outreachFromEmail, sendOutreachEmail } from "@/lib/outreach/brevo";
import { DEFAULT_DAILY_LIMIT, getSentToday, incrementSentToday } from "@/lib/outreach/sender";
import { withLinks, type LeadEmailKind } from "./outreach-links";

/**
 * One-to-one "Send now" for Lead Intelligence drafts.
 *
 * Only ever runs because a super-admin pressed Send on one lead. It goes
 * through the same Brevo sender, suppression list, unsubscribe link and shared
 * daily cap as the existing outreach, so manual sends cannot be used to get
 * round the limits that protect the domain's reputation. Leads are NOT copied
 * into OutreachLead, so the automated follow-up sequence never picks them up.
 */

const CLOSED = ["suppressed", "not_interested", "converted"];
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export class LeadSendError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(message);
  }
}

export function sendConfiguration() {
  return { configured: isBrevoConfigured(), from: outreachFromEmail(), dailyLimit: DEFAULT_DAILY_LIMIT };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Escape, then turn bare https URLs into links. Runs on already-escaped text. */
function linkify(escaped: string): string {
  return escaped.replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) => `<a href="${url}" style="color:#E8365D">${url}</a>`);
}

export function renderLeadEmail(body: string, to: string): { html: string; text: string } {
  const unsub = unsubscribeUrl(to);
  const paragraphs = body
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("\n  ");
  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6">
  ${paragraphs}
  <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding-top:14px;color:#9ca3af;font-size:12px;line-height:1.5">
    <p style="margin:0">Rotahr, Ireland. I'm emailing ${escapeHtml(to)} because it is published as a contact for your business.</p>
    <p style="margin:6px 0 0"><a href="${escapeHtml(unsub)}" style="color:#6b7280">Unsubscribe</a> and you won't hear from us again. One click, no form.</p>
  </div>
</div>`;
  const text = `${body.trim()}\n\n--\nRotahr, Ireland. I'm emailing ${to} because it is published as a contact for your business.\nUnsubscribe (one click): ${unsub}`;
  return { html, text };
}

function stamp(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

export async function sendLeadEmail(input: {
  leadId: string;
  kind: LeadEmailKind;
  to: string;
  subject: string;
  body: string;
  force?: boolean;
}) {
  if (!isBrevoConfigured()) throw new LeadSendError("not_configured", 503, "Email sending is not configured (BREVO_API_KEY is missing).");

  const lead = await prisma.leadIntelligenceLead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new LeadSendError("not_found", 404, "Lead not found.");
  if (CLOSED.includes(lead.status)) throw new LeadSendError("closed", 409, `This lead is marked ${lead.status.replace(/_/g, " ")}. Change the status first if you really want to contact them.`);

  const to = normaliseEmail(input.to);
  if (!EMAIL_RE.test(to) || isUnroutableAddress(to)) throw new LeadSendError("bad_address", 400, "That is not a valid email address.");
  if (await isSuppressed(to)) throw new LeadSendError("suppressed", 409, `${to} has unsubscribed. Rotahr will not email this address.`);

  const subject = input.subject.trim();
  if (!subject) throw new LeadSendError("bad_subject", 400, "Add a subject line.");
  const body = withLinks(input.body, input.kind);
  if (body.trim().length < 20) throw new LeadSendError("bad_body", 400, "The message is empty.");

  if (input.kind === "cold" && lead.contactedAt && !input.force) {
    throw new LeadSendError("already_contacted", 409, `This lead was already contacted on ${stamp(lead.contactedAt)}.`);
  }

  const sentToday = await getSentToday();
  if (sentToday >= DEFAULT_DAILY_LIMIT) {
    throw new LeadSendError("daily_cap", 429, `Today's outreach limit (${DEFAULT_DAILY_LIMIT} emails, shared with the automated outreach) has been reached. Try again tomorrow.`);
  }

  const mx = await checkDomain(domainOf(to));
  if (mx.verdict === "no-mx") throw new LeadSendError("no_mx", 400, `${domainOf(to)} cannot receive email (${mx.detail}).`);

  const { html, text } = renderLeadEmail(body, to);
  const result = await sendOutreachEmail({
    to,
    toName: lead.ownerName || lead.name,
    subject,
    html,
    text,
    tags: ["lead-intelligence", input.kind, lead.country],
  });

  if (!result.ok) {
    if (result.hardBounce) {
      await suppress({ email: to, source: "lead_intelligence", reason: `rejected by Brevo: ${result.error}`.slice(0, 300) });
    }
    throw new LeadSendError("send_failed", 502, `Brevo rejected the email: ${result.error}`);
  }

  await incrementSentToday();
  const now = new Date();
  const label = input.kind === "cold" ? "Cold email" : "Follow-up email";
  const line = `[${stamp(now)}] ${label} sent to ${to}: "${subject}"${result.messageId ? ` (Brevo ${result.messageId})` : ""}`;
  const updated = await prisma.leadIntelligenceLead.update({
    where: { id: lead.id },
    data: {
      status: "contacted",
      contactedAt: now,
      notes: lead.notes ? `${lead.notes.trimEnd()}\n${line}` : line,
    },
  });
  return { ok: true as const, messageId: result.messageId, sentAt: now.toISOString(), to, lead: updated, sentToday: sentToday + 1, dailyLimit: DEFAULT_DAILY_LIMIT };
}

/** Log a phone call the admin placed themselves. */
export async function logLeadCall(leadId: string, outcome: string) {
  const lead = await prisma.leadIntelligenceLead.findUnique({ where: { id: leadId } });
  if (!lead) throw new LeadSendError("not_found", 404, "Lead not found.");
  const now = new Date();
  const line = `[${stamp(now)}] Phone call to ${lead.phone ?? "venue"}${outcome.trim() ? `: ${outcome.trim()}` : ""}`;
  return prisma.leadIntelligenceLead.update({
    where: { id: lead.id },
    data: {
      status: CLOSED.includes(lead.status) ? lead.status : "contacted",
      contactedAt: now,
      notes: lead.notes ? `${lead.notes.trimEnd()}\n${line}` : line,
    },
  });
}
