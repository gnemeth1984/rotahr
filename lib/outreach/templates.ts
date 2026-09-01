import { unsubscribeUrl } from "@/lib/email/suppression";

/**
 * Cold-outreach email templates, ported from the standalone Railway sender.
 *
 * Two rules worth keeping in mind before editing:
 *  - Every email must carry a working one-click unsubscribe. It is a legal
 *    requirement for marketing mail and Gmail treats its absence as a spam
 *    signal on bulk sends.
 *  - Prices here must match the live Lemon Squeezy checkout. A wrong price in
 *    a cold email is a refund request later.
 */

export type SequenceStep =
  | "new"
  | "contacted"
  | "followup_1"
  | "followup_2"
  | "followup_3";

export type TemplateLead = {
  name: string;
  email: string;
  segment: string;
  city: string;
  country: string;
};

const FLAME = "#FF6B35";

/**
 * Per-market copy.
 *
 * `priceLine` is the only place the price is stated, and it must match what the
 * Lemon Squeezy checkout actually charges. Checkout is billed in **euro for
 * every market** — quoting "£50/month" to a UK lead who then lands on a €49
 * checkout is a false price claim and a refund request later, so non-euro
 * markets get the euro price with an approximate local figure alongside it.
 *
 * `currency` is used only for illustrative local wage maths, never for price.
 */
const MARKETS: Record<
  string,
  { currency: string; wage: string; priceLine: string; site: string }
> = {
  ie: {
    currency: "€",
    wage: "18",
    priceLine: "€49/month including 23% Irish VAT",
    site: "https://rotahr.com",
  },
  uk: {
    currency: "£",
    wage: "13",
    priceLine: "€49/month, billed in euro (roughly £42)",
    site: "https://rotahr.com",
  },
  us: {
    currency: "$",
    wage: "18",
    priceLine: "€49/month, billed in euro (roughly $54)",
    site: "https://rotahr.com",
  },
  ca: {
    currency: "C$",
    wage: "20",
    priceLine: "€49/month, billed in euro (roughly C$74)",
    site: "https://rotahr.com",
  },
  au: {
    currency: "A$",
    wage: "28",
    priceLine: "€49/month, billed in euro (roughly A$82)",
    site: "https://rotahr.com",
  },
};

function market(country: string) {
  return MARKETS[(country || "ie").toLowerCase()] ?? MARKETS.ie;
}

function ctaButton(href: string, label: string): string {
  // Outlook ignores gradients, so the solid flame colour is the background and
  // the gradient is layered on top for clients that support it.
  return `<a href="${href}" style="background:${FLAME};background-image:linear-gradient(90deg,#FF6B35,#E8365D);color:#ffffff;padding:13px 26px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;font-size:15px">${label}</a>`;
}

function wrap(bodyHtml: string, email: string, signoff: string): string {
  const unsub = unsubscribeUrl(email);
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2937;font-size:15px;line-height:1.6">
  ${bodyHtml}
  <p style="margin:22px 0 4px">${signoff}</p>
  <p style="margin:0;color:#6b7280;font-size:13px">Gabor Nemeth<br>Founder, Rotahr &middot; former chef</p>
  <div style="border-top:1px solid #e5e7eb;margin:24px 0 0;padding-top:14px;color:#9ca3af;font-size:12px;line-height:1.5">
    <p style="margin:0">Rotahr, Ireland. I'm emailing you at ${email} because you're listed publicly as running a hospitality business.</p>
    <p style="margin:6px 0 0"><a href="${unsub}" style="color:#6b7280">Unsubscribe</a> and you'll never hear from me again &mdash; one click, no form.</p>
  </div>
</div>`;
}

export function renderEmail(
  lead: TemplateLead,
  step: SequenceStep
): { subject: string; html: string } {
  const { name, email, segment, city, country } = lead;
  const m = market(country);
  const cityStr = city ? ` in ${city}` : "";
  const segLower = (segment || "restaurant").toLowerCase();

  const tryUrl = (campaign: string) =>
    `${m.site}/try?utm_source=email&utm_campaign=${campaign}&utm_content=${encodeURIComponent(email)}`;

  const templates: Record<SequenceStep, { subject: string; html: string }> = {
    new: {
      subject: `Rotas at ${name}`,
      html: wrap(
        `
        <p style="margin:0 0 14px">Hi,</p>
        <p style="margin:0 0 14px">I ran kitchens for years before I built software. The job I hated most was the rota &mdash; Sunday night, spreadsheet open, six texts about who can't do Thursday.</p>
        <p style="margin:0 0 14px">So I built Rotahr. It's the tool I wanted back then: build the rota in minutes, staff clock in from their phones, swaps and time off handled in the app instead of the group chat, and the wage cost updating as you drag shifts around.</p>
        <p style="margin:0 0 18px">${m.priceLine}, first month free, no card. If it's not saving you a Sunday evening by the end of it, walk away.</p>
        <p style="margin:0 0 18px">${ctaButton(tryUrl("outreach"), "Try it free for a month")}</p>
        <p style="margin:0 0 14px">Or reply to this email and ask me anything &mdash; it comes straight to me.</p>
      `,
        email,
        "Cheers,"
      ),
    },
    contacted: {
      subject: `Following up on Rotahr — ${name}`,
      html: wrap(
        `
        <p style="margin:0 0 14px">Hi,</p>
        <p style="margin:0 0 14px">I emailed last week about Rotahr and know how a week in hospitality goes, so I'll keep this short.</p>
        <p style="margin:0 0 14px">The bit most managers notice first: the rota takes about twenty minutes instead of an evening, and you can see the wage cost as you build it rather than finding out on payroll day.</p>
        <p style="margin:0 0 18px">There's a live demo you can click around without signing up for anything &mdash; real ${segLower} data, nothing to fill in.</p>
        <p style="margin:0 0 18px">${ctaButton(tryUrl("followup1"), "Have a look at the demo")}</p>
        <p style="margin:0 0 14px">Happy to walk you through it in fifteen minutes if that's easier. Just reply.</p>
      `,
        email,
        "Cheers,"
      ),
    },
    followup_1: {
      subject: `The Thursday-night shift swap problem`,
      html: wrap(
        `
        <p style="margin:0 0 14px">Hi,</p>
        <p style="margin:0 0 14px">One thing I hear constantly from ${segLower}s${cityStr}: shift swaps live in WhatsApp. Someone asks at 11pm, someone else says yes, nobody updates the rota, and Thursday turns up two people short.</p>
        <p style="margin:0 0 14px">In Rotahr the staff member requests the swap, whoever's covering accepts, a manager approves, and the rota updates itself. Everyone sees the same version. Nothing lives in a chat thread.</p>
        <p style="margin:0 0 18px">Same app does clock-ins, breaks, HACCP temperature logs and receipts, if any of that is on paper at the minute.</p>
        <p style="margin:0 0 18px">${ctaButton(tryUrl("followup2"), "See how swaps work")}</p>
      `,
        email,
        "Cheers,"
      ),
    },
    followup_2: {
      subject: `What the rota actually costs you`,
      html: wrap(
        `
        <p style="margin:0 0 14px">Hi,</p>
        <p style="margin:0 0 14px">Rough maths, and you'll know your own numbers better than I do. If a manager on ${m.currency}${m.wage}/hour spends three hours a week on the rota, that's roughly ${m.currency}${Math.round(Number(m.wage) * 3 * 4.33)} a month spent on admin nobody thanks them for.</p>
        <p style="margin:0 0 14px">Rotahr is ${m.priceLine}. Even if it only halves the time, it pays for itself &mdash; and that's before the no-shows you catch and the hours that stop getting logged wrong.</p>
        <p style="margin:0 0 18px">First month is free and there's no card involved, so the only thing you're risking is ten minutes setting it up.</p>
        <p style="margin:0 0 18px">${ctaButton(tryUrl("followup3"), "Start the free month")}</p>
      `,
        email,
        "Cheers,"
      ),
    },
    followup_3: {
      subject: `Last one from me`,
      html: wrap(
        `
        <p style="margin:0 0 14px">Hi,</p>
        <p style="margin:0 0 14px">I've emailed a few times and haven't heard back, so I'll leave it there &mdash; no hard feelings, I know what the inbox looks like when you're running a floor.</p>
        <p style="margin:0 0 14px">If the rota ever becomes the thing that's eating your week, we're at <a href="${tryUrl("followup4")}" style="color:${FLAME}">rotahr.com</a>. I'm the one who answers the emails.</p>
        <p style="margin:0 0 14px">Best of luck with the season.</p>
      `,
        email,
        "All the best,"
      ),
    },
  };

  return templates[step] ?? templates.new;
}

/** Where a lead goes after a successful send at `step`. */
export const NEXT_STATUS: Record<SequenceStep, string> = {
  new: "contacted",
  contacted: "followup_1",
  followup_1: "followup_2",
  followup_2: "followup_3",
  followup_3: "cold",
};

/** Minimum days since `lastContacted` before the next step is due. */
export const STEP_DELAY_DAYS: Record<string, number> = {
  contacted: 5,
  followup_1: 7,
  followup_2: 9,
  followup_3: 14,
};

export const SEQUENCE_STEPS: SequenceStep[] = [
  "new",
  "contacted",
  "followup_1",
  "followup_2",
  "followup_3",
];

export function isSequenceStep(v: string): v is SequenceStep {
  return (SEQUENCE_STEPS as string[]).includes(v);
}
