import { prisma } from "@/lib/prisma";
import { sendEmail, isUnroutableAddress } from "@/lib/email/send";
import { sendSms } from "@/lib/messaging/twilio";
import { getMessagingStatus } from "@/lib/messaging/config";
import { isDemoBusinessId } from "@/lib/demo/reset";
import { resolveSegment, contactability, type SegmentCustomer } from "@/lib/crm/segments";
import { readLoyaltyConfig, tierName } from "@/lib/crm/loyalty";
import { getCurrencySymbol } from "@/lib/currency";

/**
 * Campaign build and send.
 *
 * Deliberate design: running a campaign NEVER sends anything. It writes one
 * CampaignSend per matched guest in status "draft" (or "skipped" with a
 * reason), a manager approves the ones they want, and only an explicit send
 * call delivers approved rows. Automations run the same build step from cron,
 * so a rule can never fire a message at a guest without a human seeing it.
 */

export const MERGE_FIELDS: { token: string; label: string }[] = [
  { token: "{{name}}", label: "Guest's full name" },
  { token: "{{first_name}}", label: "First name only" },
  { token: "{{venue}}", label: "Your business name" },
  { token: "{{tier}}", label: "Loyalty tier name" },
  { token: "{{points}}", label: "Points balance" },
  { token: "{{visits}}", label: "Recorded visits" },
  { token: "{{total_spend}}", label: "Lifetime spend" },
  { token: "{{last_visit}}", label: "Date of last visit" },
  { token: "{{favourite}}", label: "Most ordered dish" },
];

function fmtDate(d: Date | null, locale = "en-IE"): string {
  if (!d) return "";
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

export function renderMessage(
  template: string,
  guest: SegmentCustomer,
  ctx: { venueName: string; tierLabel: string; currencySymbol: string; locale?: string }
): string {
  const first = (guest.name || "").trim().split(/\s+/)[0] || guest.name || "there";
  const map: Record<string, string> = {
    "{{name}}": guest.name || "there",
    "{{first_name}}": first,
    "{{venue}}": ctx.venueName,
    "{{tier}}": ctx.tierLabel,
    "{{points}}": String(guest.loyaltyPoints ?? 0),
    "{{visits}}": String(guest.visitCount ?? 0),
    "{{total_spend}}": `${ctx.currencySymbol}${(guest.totalSpend ?? 0).toFixed(2)}`,
    "{{last_visit}}": fmtDate(guest.lastVisitAt, ctx.locale),
    "{{favourite}}": guest.favouriteDishes?.[0] ?? "",
  };

  let out = template;
  for (const [token, value] of Object.entries(map)) {
    out = out.split(token).join(value);
  }
  return out;
}

export interface BuildResult {
  matched: number;
  drafted: number;
  skipped: number;
  duplicates: number;
  bySkipReason: Record<string, number>;
}

/**
 * Build (or refresh) the draft sends for a campaign.
 *
 * dedupeKey stops an automation queueing the same guest twice inside the same
 * period: rule + customer + period stamp. A manual campaign uses the campaign
 * id itself as the period, so re-running it tops up new joiners without
 * duplicating anyone already queued.
 */
export async function buildCampaignDrafts(
  businessId: string,
  campaignId: string,
  opts: { period?: string; tag?: string | null } = {}
): Promise<BuildResult> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, businessId } });
  if (!campaign) throw new Error("Campaign not found");

  const [business, cfg] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, currency: true },
    }),
    readLoyaltyConfig(businessId),
  ]);

  const venueName = business?.name ?? "us";
  const currencySymbol = getCurrencySymbol((business?.currency as any) ?? "EUR");

  const guests = await resolveSegment(businessId, campaign.segment, {
    tag: opts.tag ?? null,
    vipSpendThreshold: cfg.settings.vipSpendThreshold,
  });

  const period = opts.period ?? campaign.id;
  const bySkipReason: Record<string, number> = {};
  let drafted = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const g of guests) {
    const dedupeKey = `${campaign.automationRule ?? "manual"}:${g.id}:${period}`;
    const existing = await prisma.campaignSend.findUnique({
      where: { campaignId_dedupeKey: { campaignId: campaign.id, dedupeKey } },
      select: { id: true },
    });
    if (existing) {
      duplicates++;
      continue;
    }

    const reach = contactability(g, campaign.channel);
    let skipReason = reach.reason;

    // A .demo or otherwise unroutable address would hard-bounce and the bounce
    // is charged to the sending domain, so it is filtered at build time.
    if (!skipReason && campaign.channel === "email" && reach.to && isUnroutableAddress(reach.to)) {
      skipReason = "no_address";
    }

    const body = renderMessage(campaign.message, g, {
      venueName,
      tierLabel: tierName(g.loyaltyTier, cfg.tiers),
      currencySymbol,
    });
    const subject = campaign.subject
      ? renderMessage(campaign.subject, g, {
          venueName,
          tierLabel: tierName(g.loyaltyTier, cfg.tiers),
          currencySymbol,
        })
      : null;

    await prisma.campaignSend.create({
      data: {
        campaignId: campaign.id,
        businessId,
        customerId: g.id,
        channel: campaign.channel,
        toAddress: reach.to,
        subject,
        body,
        status: skipReason ? "skipped" : "draft",
        skipReason,
        dedupeKey,
      },
    });

    if (skipReason) {
      skipped++;
      bySkipReason[skipReason] = (bySkipReason[skipReason] ?? 0) + 1;
    } else {
      drafted++;
    }
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      lastRunAt: new Date(),
      status: campaign.status === "draft" ? "review" : campaign.status,
    },
  });

  return { matched: guests.length, drafted, skipped, duplicates, bySkipReason };
}

/** Preview a segment without writing anything. */
export async function previewSegment(
  businessId: string,
  segment: string,
  channel: string,
  tag?: string | null
): Promise<{
  matched: number;
  contactable: number;
  bySkipReason: Record<string, number>;
  sample: { id: string; name: string; to: string | null; reason: string | null }[];
}> {
  const cfg = await readLoyaltyConfig(businessId);
  const guests = await resolveSegment(businessId, segment, {
    tag: tag ?? null,
    vipSpendThreshold: cfg.settings.vipSpendThreshold,
  });

  const bySkipReason: Record<string, number> = {};
  let contactable = 0;
  const sample: { id: string; name: string; to: string | null; reason: string | null }[] = [];

  for (const g of guests) {
    const reach = contactability(g, channel);
    if (reach.ok) contactable++;
    else bySkipReason[reach.reason!] = (bySkipReason[reach.reason!] ?? 0) + 1;
    if (sample.length < 10) {
      sample.push({ id: g.id, name: g.name, to: reach.to, reason: reach.reason });
    }
  }

  return { matched: guests.length, contactable, bySkipReason, sample };
}

export interface SendResult {
  sent: number;
  failed: number;
  blocked: string | null;
  errors: string[];
}

/**
 * Deliver every approved send on a campaign. Approval is a separate, explicit
 * step, so this is only ever reached after a manager has ticked the rows.
 *
 * Email goes out through Resend with the venue as Reply-To. SMS only sends when
 * that business has verified Twilio credentials of its own — Rotahr never pays
 * for a venue's messages.
 */
export async function sendApprovedSends(
  businessId: string,
  campaignId: string,
  actor: { userId?: string | null; userName?: string | null } = {}
): Promise<SendResult> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, businessId } });
  if (!campaign) throw new Error("Campaign not found");

  const sends = await prisma.campaignSend.findMany({
    where: { campaignId, businessId, status: "approved" },
    include: { customer: { select: { name: true, gdprConsent: true, smsWhatsappConsent: true, isAnonymised: true } } },
    take: 500,
  });

  if (sends.length === 0) return { sent: 0, failed: 0, blocked: null, errors: [] };

  if (campaign.channel === "sms") {
    const status = await getMessagingStatus(businessId);
    if (!status.configured || !status.hasSms) {
      return {
        sent: 0,
        failed: 0,
        blocked:
          "SMS is not connected for this business. Add and verify Twilio credentials in Settings before sending an SMS campaign.",
        errors: [],
      };
    }
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      venues: { where: { isDefault: true }, select: { phone: true, email: true, address: true }, take: 1 },
    },
  });
  const venue = business?.venues?.[0];
  const demo = isDemoBusinessId(businessId);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const s of sends) {
    // Consent is re-checked at the moment of sending: a guest may have withdrawn
    // it between the draft being built and a manager approving it.
    if (s.customer.isAnonymised) {
      await prisma.campaignSend.update({
        where: { id: s.id },
        data: { status: "skipped", skipReason: "anonymised" },
      });
      continue;
    }
    const stillConsented = s.channel === "sms" ? s.customer.smsWhatsappConsent : s.customer.gdprConsent;
    if (!stillConsented || !s.toAddress) {
      await prisma.campaignSend.update({
        where: { id: s.id },
        data: { status: "skipped", skipReason: stillConsented ? "no_address" : "no_consent" },
      });
      continue;
    }

    // Demo businesses never deliver a real message.
    if (demo) {
      await prisma.campaignSend.update({
        where: { id: s.id },
        data: { status: "sent", sentAt: new Date(), providerId: "demo-simulated" },
      });
      sent++;
      continue;
    }

    try {
      if (s.channel === "sms") {
        const res: any = await sendSms(businessId, s.toAddress, s.body);
        await prisma.campaignSend.update({
          where: { id: s.id },
          data: { status: "sent", sentAt: new Date(), providerId: res?.sid ?? null },
        });
        sent++;
      } else {
        const html = campaignEmailHtml({
          body: s.body,
          venueName: business?.name ?? "",
          contactLines: [venue?.phone, venue?.email, venue?.address].filter(Boolean) as string[],
        });
        const result = await sendEmail({
          to: s.toAddress,
          subject: s.subject || `A note from ${business?.name ?? "us"}`,
          html,
          from: business?.name ? `${business.name} <sales@rotahr.com>` : undefined,
          replyTo: venue?.email || undefined,
          context: "crm-campaign",
        });
        if (result.ok) {
          await prisma.campaignSend.update({
            where: { id: s.id },
            data: { status: "sent", sentAt: new Date(), providerId: result.id },
          });
          sent++;
        } else {
          await prisma.campaignSend.update({
            where: { id: s.id },
            data: { status: "failed", errorMessage: result.error ?? "Unknown error" },
          });
          failed++;
          if (result.error) errors.push(result.error);
        }
      }
    } catch (err: any) {
      await prisma.campaignSend.update({
        where: { id: s.id },
        data: { status: "failed", errorMessage: String(err?.message ?? err).slice(0, 300) },
      });
      failed++;
      errors.push(String(err?.message ?? err).slice(0, 200));
    }
  }

  const remaining = await prisma.campaignSend.count({
    where: { campaignId, status: { in: ["draft", "approved"] } },
  });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: remaining === 0 ? "sent" : "review" },
  });

  void actor;
  return { sent, failed, blocked: null, errors: errors.slice(0, 5) };
}

/** Plain, deliverable HTML. Guest marketing mail carries the venue's own
 *  contact details so a recipient can always reach a human to opt out. */
export function campaignEmailHtml(d: {
  body: string;
  venueName: string;
  contactLines: string[];
}): string {
  const paragraphs = d.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;color:#0f172a;max-width:560px;">
${paragraphs}
<p style="margin:24px 0 0;color:#64748b;font-size:13px;border-top:1px solid #e2e8f0;padding-top:12px;">
${escapeHtml(d.venueName)}${d.contactLines.length ? `<br>${escapeHtml(d.contactLines.join(" · "))}` : ""}
<br><span style="color:#94a3b8;">You are receiving this because you gave us permission to contact you. Reply to this email and we will take you off the list.</span>
</p>
</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
