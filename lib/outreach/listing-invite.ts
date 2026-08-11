import { unsubscribeUrl } from "@/lib/email/suppression";

/**
 * The "we already built you a page" invitation.
 *
 * WHY THIS BEATS ASKING THEM TO FILL IN A FORM
 * The earlier version of this email asked the venue to go and create a listing.
 * That is work, done by a busy person, for a benefit they have to imagine. This
 * version shows them the finished page and offers three one-click outcomes:
 * keep it, claim it, or delete it. Nothing is asked of them except a decision.
 *
 * WHY THE DELETE LINK IS AS PROMINENT AS THE CLAIM LINK
 * We publish these pages without being asked, on a legitimate-interest basis.
 * That basis holds only while objecting is genuinely easy. Burying "remove this"
 * under a mailto, or below the fold, is what turns a defensible practice into a
 * complaint — and one spam complaint costs more deliverability than one listing
 * is worth. So removal is a plain link in the body, not a footnote.
 *
 * WHY THIS EMAIL DOES NOT MENTION THE NEWSLETTER
 * Consent for marketing is collected on the claim form, where it can be logged
 * with its wording, an IP and a timestamp. Implying here that claiming signs
 * them up would make that consent neither specific nor freely given.
 *
 * WHY THIS IS NOT A SEQUENCE STEP
 * `templates.ts` keys every email off `SequenceStep`, and a lead's `status`
 * doubles as its position in that sequence. A listing email living there would
 * be picked up by `findEligibleLeads` and followed by the five-step product
 * pitch. These leads are parked on `listing_invited`, which matches none of the
 * eligibility branches, so the weekday cron cannot touch them.
 */

const FLAME = "#FF6B35";

export type ListingInviteLead = {
  /** Venue name, as it appears on the page. */
  name: string;
  email: string;
  /** Public page slug — the page must already exist before this email is sent. */
  slug: string;
  /** Single-use token from `issueTakedownToken()`. */
  takedownToken: string;
  city?: string;
  /** One personal line proving a human looked at their venue. */
  hook?: string;
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://rotahr.com";

function ctaButton(href: string, label: string): string {
  // Outlook ignores gradients, so the solid flame colour is the background and
  // the gradient layers on top for clients that support it.
  return `<a href="${href}" style="background:${FLAME};background-image:linear-gradient(90deg,#FF6B35,#E8365D);color:#ffffff;padding:13px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px">${label}</a>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export function renderListingInvite(lead: ListingInviteLead): {
  subject: string;
  html: string;
  text: string;
} {
  const { email, slug, takedownToken, city, hook } = lead;
  const name = escapeHtml(lead.name);

  const params = new URLSearchParams({
    utm_source: "email",
    utm_campaign: "prospect_listing",
    utm_content: email,
  });
  const pageUrl = `${SITE}/v/${slug}?${params}`;
  const removeUrl = `${SITE}/listing/remove/${takedownToken}`;
  const unsub = unsubscribeUrl(email);

  const subject = city
    ? `I made a page for ${lead.name} (${city}) — yours if you want it`
    : `I made a page for ${lead.name} — yours if you want it`;

  const hookHtml = hook ? `<p style="margin:0 0 14px">${escapeHtml(hook)}</p>` : "";

  const html = `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6">
  <p style="margin:0 0 14px">Hi,</p>
  ${hookHtml}
  <p style="margin:0 0 14px">I built a page for ${name} on Rotahr. It's live now, it cost you nothing, and I didn't ask first &mdash; so have a look and tell me to bin it if you'd rather:</p>
  <p style="margin:0 0 18px">${ctaButton(pageUrl, "See the page")}</p>
  <p style="margin:0 0 14px">These pages do get found. One of them &mdash; a bar in Listowel &mdash; is already on the first page of Google for the venue's own name, ahead of most of the directory listings. So this is another door into your place, and it's worth it being right.</p>
  <p style="margin:0 0 14px">It's put together from what's publicly listed about you, so there'll be things I got wrong or left out. Three options, all one click:</p>
  <ul style="margin:0 0 18px;padding-left:20px">
    <li style="margin:0 0 8px"><strong>Leave it.</strong> Do nothing. It stays up, free, and I won't chase you.</li>
    <li style="margin:0 0 8px"><strong>Claim it</strong> and fix it &mdash; your photos, your menu, your hours, and a booking button that emails you directly. No commission and no per-cover fee. There's a "Is this your venue?" button at the bottom of the page.</li>
    <li style="margin:0 0 8px"><strong><a href="${removeUrl}" style="color:#b91c1c">Delete it</a>.</strong> One click, no questions, no reply needed. It won't come back.</li>
  </ul>
  <p style="margin:0 0 14px">Rotahr is scheduling and food-safety software for hospitality &mdash; I'm an ex-chef, I built it because I hated doing rotas on a Sunday night. The pages are the free part, and they stay free whether you ever look at the rest or not.</p>
  <p style="margin:0 0 14px">Reply to this and it comes straight to me.</p>
  <p style="margin:22px 0 4px">Cheers,</p>
  <p style="margin:0;color:#6b7280;font-size:13px">Gabor Nemeth<br>Founder, Rotahr &middot; former chef</p>
  <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding-top:14px;color:#9ca3af;font-size:12px;line-height:1.5">
    <p style="margin:0">Rotahr, Ireland. I'm emailing you at ${escapeHtml(email)} because ${name} is listed publicly as a hospitality business.</p>
    <p style="margin:6px 0 0"><a href="${removeUrl}" style="color:#6b7280">Delete the page</a> &middot; <a href="${unsub}" style="color:#6b7280">Unsubscribe</a> &mdash; one click each, no form.</p>
  </div>
</div>`;

  // Same content in text/plain: the parts disagreeing is itself a spam signal.
  const text = [
    "Hi,",
    hook || null,
    `I built a page for ${lead.name} on Rotahr. It's live now, it cost you nothing, and I didn't ask first - so have a look and tell me to bin it if you'd rather:`,
    pageUrl,
    "These pages do get found. One of them - a bar in Listowel - is already on the first page of Google for the venue's own name, ahead of most of the directory listings. So this is another door into your place, and it's worth it being right.",
    "It's put together from what's publicly listed about you, so there'll be things I got wrong or left out. Three options, all one click:",
    "- Leave it. Do nothing. It stays up, free, and I won't chase you.",
    '- Claim it and fix it - your photos, your menu, your hours, and a booking button that emails you directly. No commission and no per-cover fee. There\'s an "Is this your venue?" button at the bottom of the page.',
    `- Delete it, one click, no questions, no reply needed: ${removeUrl}`,
    "Rotahr is scheduling and food-safety software for hospitality - I'm an ex-chef, I built it because I hated doing rotas on a Sunday night. The pages are the free part, and they stay free whether you ever look at the rest or not.",
    "Reply to this and it comes straight to me.",
    "Cheers,",
    "Gabor Nemeth",
    "Founder, Rotahr - former chef",
    "",
    `Rotahr, Ireland. I'm emailing you at ${email} because ${lead.name} is listed publicly as a hospitality business.`,
    `Delete the page: ${removeUrl}`,
    `Unsubscribe: ${unsub}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject, html, text };
}

/** Status parked on a lead that has had the listing invite and nothing else. */
export const LISTING_INVITED_STATUS = "listing_invited";
