import { prisma } from "@/lib/db";
import { freeTemplates, getTemplate, relatedTemplates } from "@/lib/templates";
import { CONSENT_DEFAULT_CHECKED, CONSENT_TEXT, guessVenueType, VENUE_TYPES, type VenueType } from "@/lib/templates/lead-consent";
import { isSuppressed, oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/email/suppression";
import { isUnroutableAddress, sendEmail } from "@/lib/email/send";
import { PLANS } from "@/lib/seo/product-facts";

/**
 * Free-template leads and their follow-up email series.
 *
 * The visitor gives an email to download a template; the file downloads on the
 * spot. Then:
 *   step 0  copy of the file + related templates      — immediately, everyone
 *   step 1  "Still doing the rota in Excel?"          — 3 days after step 0, consented only
 *   step 2  what Rotahr does for their venue type     — 4 days after step 1
 *   step 3  3 months free, flat pricing               — 7 days after step 2
 *
 * SAFETY
 *  - Nothing is sent unless TEMPLATE_EMAILS_ENABLED=1. Leads are still collected
 *    while it's off, and the series starts for them once it's switched on.
 *  - Each send claims its step with a conditional update first, so the
 *    immediate send and the cron (or two cron runs) can't both send one step.
 *  - Unsubscribed, unroutable and existing-customer addresses never get steps 1-3.
 *  - At most one email per lead per cron run.
 */

const DAY = 24 * 60 * 60 * 1000;
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://rotahr.com";
/** Days to wait after the previous step before sending step N. */
const GAP_DAYS: Record<number, number> = { 1: 3, 2: 4, 3: 7 };
/** A step-0 email that couldn't go out within this window is skipped, not sent late. */
const STEP0_MAX_AGE_DAYS = 2;
export const FINAL_STEP = 3;
const MAX_SENDS_PER_RUN = 150;

export const STEP_LABEL: Record<number, string> = {
  0: "Day 0 — your template + related ones",
  1: "Day 3 — Still doing the rota in Excel?",
  2: "Day 7 — what Rotahr does for your venue",
  3: "Day 14 — 3 months free",
};

export function templateEmailsEnabled(): boolean {
  return process.env.TEMPLATE_EMAILS_ENABLED === "1";
}

export function normaliseLeadEmail(raw: string): string | null {
  const e = (raw || "").trim().toLowerCase();
  if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) || isUnroutableAddress(e)) return null;
  return e;
}

// ─── Capture ──────────────────────────────────────────────────────────────────

export interface CaptureInput {
  email: string;
  slug: string;
  consent: boolean;
  venueType?: string | null;
  country?: string | null;
  ipHash?: string | null;
  userAgent?: string | null;
}

export async function captureLead(input: CaptureInput) {
  const t = getTemplate(input.slug);
  if (!t) throw new Error("unknown template");
  const venue = VENUE_TYPES.some((v) => v.id === input.venueType)
    ? (input.venueType as VenueType)
    : guessVenueType(t.category) || null;
  const now = new Date();
  const consentFields = input.consent
    ? { marketingConsent: true, consentText: `${CONSENT_TEXT} [box pre-ticked: ${CONSENT_DEFAULT_CHECKED ? "yes" : "no"}]`, consentAt: now }
    : { marketingConsent: false, consentText: null, consentAt: null };

  const existing = await prisma.templateLead.findUnique({ where: { email: input.email } });
  if (!existing) {
    return prisma.templateLead.create({
      data: {
        email: input.email,
        ...consentFields,
        firstSlug: t.slug,
        lastSlug: t.slug,
        slugs: [t.slug],
        venueType: venue,
        country: input.country ?? null,
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  }
  // Returning visitor: record the download, keep their consent choice current.
  // Consent given before keeps its original timestamp.
  const consentUpdate = input.consent
    ? existing.marketingConsent
      ? {}
      : consentFields
    : { marketingConsent: false };
  return prisma.templateLead.update({
    where: { id: existing.id },
    data: {
      ...consentUpdate,
      lastSlug: t.slug,
      slugs: existing.slugs.includes(t.slug) ? existing.slugs : [...existing.slugs, t.slug],
      downloads: { increment: 1 },
      venueType: input.venueType && venue ? venue : existing.venueType ?? venue,
    },
  });
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface LeadLike {
  email: string;
  firstSlug: string;
  lastSlug: string;
  slugs: string[];
  venueType: string | null;
  marketingConsent: boolean;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function link(path: string, step: number): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${BASE_URL}${path}${sep}utm_source=template_email&utm_medium=email&utm_campaign=template_series&utm_content=step${step}`;
}

function a(href: string, label: string) {
  return `<a href="${href}" style="color:#e8551f">${esc(label)}</a>`;
}

function layout(opts: {
  lead: LeadLike;
  step: number;
  paragraphs: string[];
  cta?: { label: string; href: string };
  ps?: string;
}): { html: string; text: string } {
  const unsub = unsubscribeUrl(opts.lead.email, BASE_URL);
  const first = getTemplate(opts.lead.firstSlug);
  const why = `You're getting this because you downloaded the ${first ? first.name.toLowerCase() : "free template"} from rotahr.com with this address.`;
  const body = opts.paragraphs.map((p) => `<p style="margin:0 0 14px">${p}</p>`).join("\n    ");
  const cta = opts.cta
    ? `<p style="margin:20px 0 22px"><a href="${opts.cta.href}" style="display:inline-block;background:#ff6b35;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;font-size:15px">${esc(opts.cta.label)}</a></p>`
    : "";
  const ps = opts.ps ? `<p style="margin:16px 0 0;color:#475569;font-size:14px">${opts.ps}</p>` : "";
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6;padding:8px">
    <p style="margin:0 0 14px">Hi,</p>
    ${body}
    ${cta}
    <p style="margin:18px 0 4px">Gabor</p>
    <p style="margin:0;color:#6b7280;font-size:13px">Founder, Rotahr &middot; former chef</p>
    ${ps}
    <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding-top:14px;color:#9ca3af;font-size:12px;line-height:1.5">
      <p style="margin:0">${esc(why)} Rotahr, Ireland.</p>
      <p style="margin:6px 0 0"><a href="${unsub}" style="color:#6b7280">Unsubscribe</a> &mdash; one click, no more emails from us.</p>
    </div>
  </div>`;
  const strip = (s: string) =>
    s
      .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g, "$2 ($1)")
      .replace(/<li[^>]*>/g, "- ")
      .replace(/<\/li>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&mdash;/g, "—")
      .replace(/&middot;/g, "·")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&euro;/g, "€")
      .trim();
  const text = [
    "Hi,",
    ...opts.paragraphs.map(strip),
    ...(opts.cta ? [`${opts.cta.label}: ${opts.cta.href}`] : []),
    "Gabor\nFounder, Rotahr · former chef",
    ...(opts.ps ? [strip(opts.ps)] : []),
    `--\n${why}\nUnsubscribe: ${unsub}`,
  ].join("\n\n");
  return { html, text };
}

const VENUE_COPY: Record<string, { noun: string; industry: string; points: string[] }> = {
  kitchen: {
    noun: "restaurant",
    industry: "/industries/restaurant",
    points: [
      "<strong>HACCP records on a phone or tablet</strong> — fridge temperatures, cleaning, opening and closing checks, delivery checks and a corrective action log, with a PDF export ready when the inspector calls.",
      "<strong>Rota with the labour cost on screen</strong> — you see what the week costs while you build it, and staff get their shifts on the app.",
      "<strong>Recipe costing and stock</strong> — scan a delivery note and see when a supplier's price goes up and what it does to your dish margins.",
      "<strong>A morning brief</strong> — missed checks, margin hit by price rises, and tonight's bookings against how many staff you've rostered.",
    ],
  },
  cafe: {
    noun: "café",
    industry: "/industries/cafe",
    points: [
      "<strong>A rota you build in minutes</strong> — staff get their shifts on the app, and swaps and time-off requests come to you to approve.",
      "<strong>Clock in and out</strong> with break entitlement tracking, so payroll comes from the hours actually worked.",
      "<strong>HACCP records on a phone</strong> — temperatures, cleaning and opening/closing checks, with a PDF export for inspections.",
      "<strong>Stock and recipe costing</strong> so you can see what a flat white or a toastie really costs you.",
    ],
  },
  bar: {
    noun: "bar",
    industry: "/industries/bar",
    points: [
      "<strong>Rota and shift swaps</strong> — staff see their shifts on the app, swaps come to you to approve instead of being sorted in a group chat.",
      "<strong>Tips and tronc</strong> split from the hours people actually worked, with a record of who got what.",
      "<strong>Clock in and out</strong> with break tracking, feeding straight into payroll reports.",
      "<strong>Stock and supplier prices</strong> — price changes are recorded as they come in, so a creeping keg price doesn't hide.",
    ],
  },
  hotel: {
    noun: "hotel",
    industry: "/industries/hotel",
    points: [
      "<strong>One rota across departments</strong> — kitchen, front of house, housekeeping — with labour cost visible as you build it.",
      "<strong>Clock in and out</strong> with break entitlement tracking.",
      "<strong>Training and certification expiry tracking</strong>, so nobody's food safety or first aid cert lapses unnoticed.",
      "<strong>Multi-venue</strong> — revenue and labour % per venue if you run more than one site.",
    ],
  },
  catering: {
    noun: "catering business",
    industry: "/industries/catering",
    points: [
      "<strong>Rota and staff availability</strong> in one place, so you know who can actually work the event before you book them.",
      "<strong>HACCP records on a phone</strong> — temperatures, delivery checks and a corrective action log, with a PDF export.",
      "<strong>Recipe costing</strong> so every menu you quote is priced on what the ingredients cost today.",
      "<strong>Clock in and out</strong> with break tracking, feeding payroll reports.",
    ],
  },
  other: {
    noun: "venue",
    industry: "/features",
    points: [
      "<strong>Rota and shift swaps</strong> — staff get their shifts on the app, and swaps and time off come to you to approve.",
      "<strong>Clock in and out</strong> with break entitlement tracking, and payroll reports from the hours actually worked.",
      "<strong>HACCP food safety records</strong> on a phone, with a PDF export for inspections.",
      "<strong>Table bookings</strong> with a visual floor plan.",
    ],
  },
};

function venueKey(v: string | null): keyof typeof VENUE_COPY {
  if (v === "restaurant") return "kitchen";
  if (v && v in VENUE_COPY) return v as keyof typeof VENUE_COPY;
  return "other";
}

export function renderStep(step: number, lead: LeadLike): RenderedEmail {
  const t = getTemplate(lead.lastSlug) ?? getTemplate(lead.firstSlug);
  const name = t?.name ?? "template";
  const lower = name.toLowerCase();

  if (step === 0) {
    const related = t ? relatedTemplates(t.slug).slice(0, 3) : [];
    const files = t
      ? `${a(`${BASE_URL}/templates/${t.slug}.pdf`, "PDF")} &middot; ${a(`${BASE_URL}/templates/${t.slug}.xlsx`, "Excel")} &middot; ${a(`${BASE_URL}/templates/${t.slug}.csv`, "CSV")}`
      : a(link("/templates", 0), "rotahr.com/templates");
    const paragraphs = [
      `Here's the ${esc(lower)} you downloaded from rotahr.com, in case you need it again: ${files}`,
    ];
    if (related.length) {
      paragraphs.push(
        `Three more that usually go with it:<ul style="margin:8px 0 0;padding-left:20px">${related
          .map((r) => `<li style="margin:0 0 4px">${a(link(`/templates/${r.slug}`, 0), r.name)}</li>`)
          .join("")}</ul>`,
      );
    }
    paragraphs.push(
      `I spent years as a chef before building Rotahr, so these are the sheets I wished someone had handed me. There are ${freeTemplates.length} in the ${a(link("/templates", 0), "free library")}, all PDF and Excel.`,
    );
    if (lead.marketingConsent) {
      paragraphs.push(
        "Over the next two weeks I'll send you three short emails with a few ideas for getting the paperwork off your plate. If that's not for you, the unsubscribe link is at the bottom.",
      );
    }
    const r = layout({ lead, step, paragraphs });
    return { subject: `Your ${lower} (PDF + Excel)`, ...r };
  }

  if (step === 1) {
    const r = layout({
      lead,
      step,
      paragraphs: [
        "Quick one. If your rota lives in a spreadsheet and goes round on WhatsApp, you know the rest: someone works off last week's screenshot, a swap gets agreed in a side chat, and you find out on the night.",
        "That's the mess Rotahr was built for. You build the week on one screen, staff see their shifts on their phone, and swaps and time-off requests come to you to approve instead of happening behind your back.",
        "You also see what the week costs in wages while you're building it, before it's published, not when payroll lands.",
        "The live demo is a real (made-up) gastropub with a full week already rostered. No sign-up, nothing to install.",
      ],
      cta: { label: "Open the live demo", href: link("/try", 1) },
      ps: `Not ready to switch? The ${a(link("/templates/weekly-staff-rota", 1), "free weekly rota template")} is still there.`,
    });
    return { subject: "Still doing the rota in Excel?", ...r };
  }

  if (step === 2) {
    const v = VENUE_COPY[venueKey(lead.venueType)];
    const r = layout({
      lead,
      step,
      paragraphs: [
        `The ${esc(lower)} is one piece of paper. Here's what the rest of running a ${v.noun} looks like when it's in Rotahr instead of a folder and a group chat:`,
        `<ul style="margin:0;padding-left:20px">${v.points.map((p) => `<li style="margin:0 0 8px">${p}</li>`).join("")}</ul>`,
        "It's built for hospitality only — not retail, not offices — so the screens are the ones a manager actually needs on a Friday night.",
      ],
      cta: { label: `See it for a ${v.noun}`, href: link(v.industry, 2) },
    });
    return { subject: `What Rotahr does for a ${v.noun} like yours`, ...r };
  }

  const [s, p, e] = PLANS;
  const r = layout({
    lead,
    step: 3,
    paragraphs: [
      "Last one in this series.",
      "Every new Rotahr account gets the <strong>first 3 months free</strong>, on any plan, no card required.",
      `After that it's a flat monthly fee per venue, never per employee: &euro;${s.price} ${s.name} (${s.staff}), &euro;${p.price} ${p.name} (${p.staff}), &euro;${e.price} ${e.name} (${e.staff}). VAT included.`,
      "Most venues are set up in an afternoon: add your staff (or import them from a spreadsheet), build your first week, and send everyone the app.",
    ],
    cta: { label: "Start your 3 free months", href: link("/auth/register", 3) },
    ps: "If you'd like a hand setting it up, just reply to this email and I'll help you get going.",
  });
  return { subject: "3 months of Rotahr free (no card)", ...r };
}

// ─── Sending ──────────────────────────────────────────────────────────────────

type LeadRow = NonNullable<Awaited<ReturnType<typeof prisma.templateLead.findUnique>>>;

export type StepOutcome =
  | { sent: true; step: number; id: string | null }
  | { sent: false; step: number | null; reason: string };

async function isCustomer(email: string): Promise<boolean> {
  const u = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  return !!u;
}

/**
 * Work out whether this lead has a step due now. Returns the step to send, a
 * terminal status to record, or null when nothing is due yet.
 */
export async function nextStepFor(
  lead: LeadRow,
  now = new Date(),
): Promise<{ step: number } | { status: string; skipTo?: number } | { skipTo: number } | null> {
  if (lead.status !== "active" || lead.step > FINAL_STEP) return null;
  if (await isSuppressed(lead.email)) return { status: "unsubscribed" };

  if (lead.step === 0) {
    if (now.getTime() - lead.createdAt.getTime() > STEP0_MAX_AGE_DAYS * DAY) {
      // Too late for "here's your file" — move on to the series without it.
      return { skipTo: 1 };
    }
    return { step: 0 };
  }
  if (!lead.marketingConsent) return { status: "done" };
  if (await isCustomer(lead.email)) return { status: "customer" };
  const gap = GAP_DAYS[lead.step] ?? 7;
  // Counted from the last email, or from the download if day 0 was skipped.
  const since = lead.lastSentAt ?? lead.createdAt;
  if (now.getTime() - since.getTime() < gap * DAY) return null;
  return { step: lead.step };
}

/**
 * Send one step to one lead, claiming it first so it can only go once.
 * Caller is responsible for checking templateEmailsEnabled().
 */
export async function sendStep(lead: LeadRow, step: number): Promise<StepOutcome> {
  const claimed = await prisma.templateLead.updateMany({
    where: { id: lead.id, step, status: "active" },
    data: { step: step + 1, lastSentAt: new Date(), ...(step >= FINAL_STEP ? { status: "done" } : {}) },
  });
  if (claimed.count !== 1) return { sent: false, step, reason: "already claimed" };

  const email = renderStep(step, lead);
  const res = await sendEmail({
    to: lead.email,
    subject: email.subject,
    html: email.html,
    text: email.text,
    context: `template-series-${step}`,
    // RFC 8058 one-click: Gmail/Outlook POST to the API route, which records
    // the opt-out without a confirmation page. The visible footer link goes to
    // the /unsubscribe page instead.
    headers: {
      "List-Unsubscribe": `<${oneClickUnsubscribeUrl(lead.email, BASE_URL)}>, <mailto:sales@rotahr.com?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
  await prisma.activityLog
    .create({
      data: {
        action: "template_email",
        details: { leadId: lead.id, email: lead.email, step, ok: res.ok, id: res.id, error: res.error },
      },
    })
    .catch(() => undefined);
  if (!res.ok) {
    // Give the step back so the next run retries it.
    await prisma.templateLead.updateMany({
      where: { id: lead.id, step: step + 1 },
      data: { step, lastSentAt: lead.lastSentAt, status: "active" },
    });
    return { sent: false, step, reason: res.error ?? "send failed" };
  }
  return { sent: true, step, id: res.id };
}

/** Step 0 straight after capture. Never throws. */
export async function sendWelcomeNow(leadId: string): Promise<boolean> {
  if (!templateEmailsEnabled()) return false;
  try {
    const lead = await prisma.templateLead.findUnique({ where: { id: leadId } });
    if (!lead || lead.step !== 0) return false;
    const next = await nextStepFor(lead);
    if (!next || !("step" in next) || next.step !== 0) return false;
    const r = await sendStep(lead, 0);
    return r.sent;
  } catch (e) {
    console.error("[template-leads] welcome send failed", e);
    return false;
  }
}

export interface SeriesRunResult {
  enabled: boolean;
  dryRun: boolean;
  checked: number;
  due: { email: string; step: number }[];
  sent: number;
  closed: Record<string, number>;
  failures: { email: string; step: number; error: string }[];
}

export async function runTemplateSeries(opts: { dryRun: boolean; now?: Date }): Promise<SeriesRunResult> {
  const enabled = templateEmailsEnabled();
  const dryRun = opts.dryRun || !enabled;
  const now = opts.now ?? new Date();
  const leads = await prisma.templateLead.findMany({
    where: { status: "active", step: { lte: FINAL_STEP } },
    orderBy: { createdAt: "asc" },
    take: 2000,
  });
  const out: SeriesRunResult = { enabled, dryRun, checked: leads.length, due: [], sent: 0, closed: {}, failures: [] };

  for (const lead of leads) {
    if (out.sent >= MAX_SENDS_PER_RUN) break;
    let row = lead;
    let next = await nextStepFor(row, now);
    if (next && "skipTo" in next && !("status" in next)) {
      if (dryRun) {
        row = { ...row, step: next.skipTo };
      } else {
        await prisma.templateLead.updateMany({ where: { id: row.id, step: 0 }, data: { step: next.skipTo } });
        row = { ...row, step: next.skipTo };
      }
      next = await nextStepFor(row, now);
    }
    if (!next) continue;
    if ("status" in next) {
      out.closed[next.status] = (out.closed[next.status] ?? 0) + 1;
      if (!dryRun) await prisma.templateLead.update({ where: { id: row.id }, data: { status: next.status } });
      continue;
    }
    if (!("step" in next)) continue;
    out.due.push({ email: row.email, step: next.step });
    if (dryRun) continue;
    const r = await sendStep(row, next.step);
    if (r.sent) {
      out.sent++;
      await new Promise((res) => setTimeout(res, 600)); // stay under Resend's rate limit
    } else if (r.reason !== "already claimed") {
      out.failures.push({ email: row.email, step: next.step, error: r.reason });
    }
  }
  return out;
}

/**
 * Retention from the privacy policy (section 4): a lead is deleted 24 months
 * after our last contact (updatedAt moves on every download and send), or 30
 * days after unsubscribing. The opt-out itself lives on in EmailSuppression.
 */
export async function purgeTemplateLeads(now = new Date()): Promise<{ unsubscribed: number; stale: number }> {
  const unsub = await prisma.templateLead.deleteMany({
    where: { status: "unsubscribed", updatedAt: { lt: new Date(now.getTime() - 30 * DAY) } },
  });
  const stale = await prisma.templateLead.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - 730 * DAY) } },
  });
  return { unsubscribed: unsub.count, stale: stale.count };
}
