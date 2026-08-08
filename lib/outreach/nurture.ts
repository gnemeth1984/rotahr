import { prisma } from "@/lib/prisma";
import { isSuppressed, unsubscribeUrl } from "@/lib/email/suppression";
import { nurtureAudience } from "@/lib/public-page/consent";
import { sendEmail } from "@/lib/email/send";

/**
 * The consented list: venues that claimed a page AND ticked the box.
 *
 * WHY THIS USES RESEND AND NOT BREVO
 * Brevo carries cold outreach, and cold outreach earns spam complaints. This
 * list is people who explicitly asked to hear from us — the most engaged
 * audience we have. Sending it down the cold pipe would let a stranger's
 * complaint about an unsolicited pitch degrade delivery to someone who opted in.
 * Different consent, different reputation, different sender.
 *
 * WHY SUPPRESSION IS CHECKED PER RECIPIENT
 * `nurtureAudience()` filters on the consent flag, which is updated when someone
 * withdraws. But a withdrawal can land while a batch is in flight, and the
 * suppression list is the authority on "do not email this address". So it is
 * checked immediately before each send, not once for the batch.
 */

export interface NurtureContent {
  subject: string;
  /** Body HTML, without wrapper or footer. */
  bodyHtml: string;
  /** Plain-text body, without footer. */
  bodyText: string;
}

function wrap(bodyHtml: string, email: string, venueName: string): string {
  const unsub = unsubscribeUrl(email);
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6">
  ${bodyHtml}
  <p style="margin:22px 0 4px">Cheers,</p>
  <p style="margin:0;color:#6b7280;font-size:13px">Gabor Nemeth<br>Founder, Rotahr &middot; former chef</p>
  <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding-top:14px;color:#9ca3af;font-size:12px;line-height:1.5">
    <p style="margin:0">Rotahr, Ireland. You're getting this because you ticked the box when you claimed the Rotahr page for ${venueName}.</p>
    <p style="margin:6px 0 0"><a href="${unsub}" style="color:#6b7280">Unsubscribe</a> &mdash; one click, no form, takes effect immediately.</p>
  </div>
</div>`;
}

export interface NurtureResult {
  attempted: number;
  sent: number;
  skipped: { email: string; reason: string }[];
  failures: { email: string; error: string }[];
}

/**
 * Send one nurture email to the whole consented list.
 *
 * `dryRun` renders and resolves recipients without sending, so a campaign can
 * be inspected before it goes anywhere.
 */
export async function sendNurture(
  content: NurtureContent,
  opts: { dryRun?: boolean; limit?: number } = {}
): Promise<NurtureResult> {
  const audience = await nurtureAudience(opts.limit ?? 500);
  const result: NurtureResult = { attempted: 0, sent: 0, skipped: [], failures: [] };

  for (const biz of audience) {
    const email = biz.marketingEmail;
    if (!email) continue;
    result.attempted++;

    if (await isSuppressed(email)) {
      result.skipped.push({ email, reason: "suppressed" });
      continue;
    }

    if (opts.dryRun) {
      result.skipped.push({ email, reason: "dry run" });
      continue;
    }

    const res = await sendEmail({
      to: email,
      subject: content.subject,
      html: wrap(content.bodyHtml, email, biz.name),
      text: `${content.bodyText}\n\n—\nUnsubscribe: ${unsubscribeUrl(email)}`,
      context: "nurture",
    });

    if (res.ok) result.sent++;
    else result.failures.push({ email, error: res.error ?? "unknown" });
  }

  return result;
}

/**
 * Audience size, for deciding whether a campaign is worth writing.
 * Counts the flag rather than joining suppression — an estimate, not a promise.
 */
export async function nurtureAudienceSize(): Promise<number> {
  return prisma.business.count({
    where: { marketingOptIn: true, marketingOptOutAt: null, marketingEmail: { not: null } },
  });
}
