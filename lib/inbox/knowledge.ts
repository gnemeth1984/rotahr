/**
 * The factual ground truth the reply assistant is allowed to state.
 *
 * WHY THIS IS A FILE AND NOT A PROMPT STRING
 * An LLM asked about pricing with no source will invent a number, and an
 * invented price in a reply to a prospect is a commercial problem that lands in
 * someone's inbox with the Rotahr name on it. Everything the assistant may
 * assert lives here, is passed in as context, and the prompt forbids going
 * beyond it. When pricing or features change, this file changes and every
 * future reply changes with it.
 *
 * Prices include Irish VAT at 23% and are the same figures shown on the
 * public pricing page — if those diverge, the landing page is authoritative
 * and this file is the bug.
 */

export const PRICING = {
  starter: { price: "€59/month", staff: "up to 15 staff" },
  pro: { price: "€119/month", staff: "up to 30 staff" },
  enterprise: { price: "€215/month", staff: "unlimited staff, multi-venue" },
  trial: "First month free, no card required to start.",
  vat: "All prices include VAT.",
  currencies: "Billing is supported in EUR, USD, GBP, CAD and AUD.",
} as const;

export const KNOWLEDGE = `
ABOUT ROTAHR
Rotahr is an all-in-one operations platform for hospitality businesses —
restaurants, bars, pubs, cafés and hotels. It was built by a former chef who
had lived the problem. It is used by venues in Ireland, the UK, the US, Canada
and Australia.

Website: https://rotahr.com
Live demo (no signup needed): https://rotahr.com/try

WHAT IT DOES
- Rota / scheduling: build staff rotas, publish them, copy weeks, shift templates.
- Clock in / out: with break entitlement tracking (prompts a break when one is due).
- Time off: requests and approvals.
- Payroll prep: hours, per-employee costs, tips/tronc.
- Bookings & reservations: including a visual floor plan where tables are dragged
  into place and colour-coded by live status.
- CRM: guest profiles built automatically from reservations, visit history,
  no-show tracking, tags, notes.
- Bookkeeping: photograph a receipt and AI reads it; expense categories, P&L,
  VAT/tax reporting, CSV export.
- Stock and recipes: recipe costing that updates when delivery prices change,
  photos of finished dishes for plating reference.
- HACCP / food safety: paperless temperature checks, delivery checks, cleaning
  and opening/closing checklists, corrective action log, PDF export for
  inspections, and scheduled reminders to whoever is clocked in.
- Delivery note scanning: one photo updates bookkeeping, stock and the HACCP
  delivery check together.
- Menu specials and team announcements.
- Messaging and notifications, including push to the mobile app.
- Training and certification tracking (e.g. HACCP certs and their expiry).
- Mobile apps for iOS and Android for all roles.
- AI assistant for booking-driven staffing suggestions.

PRICING (VAT included)
- Starter — ${PRICING.starter.price}, ${PRICING.starter.staff}
- Pro — ${PRICING.pro.price}, ${PRICING.pro.staff}
- Enterprise — ${PRICING.enterprise.price}, ${PRICING.enterprise.staff}
- ${PRICING.trial}
- ${PRICING.currencies}
Pricing page: https://rotahr.com/#pricing

PICKING A PLAN FOR SOMEONE
Match on staff count, and always name the CHEAPEST plan that fits. Quoting a
dearer plan than someone needs reads as a stitch-up and loses the sale.
- 1-15 staff  → Starter €59/month
- 16-30 staff → Pro €119/month
- 31+ staff, or more than one venue → Enterprise €215/month
Count staff literally: 14 staff is Starter, not Pro. If they did not say how
many staff they have, give the range rather than guessing a plan.
Always mention the first month is free when quoting a price.

PARTNER / AFFILIATE PROGRAMME
20% recurring commission for as long as the referred customer stays subscribed.
Open to anyone, anywhere. Sign up: https://rotahr.lemonsqueezy.com/affiliates
Resources and a pitch deck: https://rotahr.com/partners/resources
Terms: https://rotahr.com/terms#affiliate

FREE VENUE LISTING
Any venue can claim a free public listing page at https://rotahr.com/list
regardless of whether they subscribe.

LIVE DEMO
https://rotahr.com/try needs no signup and no card — it opens a demo panel with
one-click logins for both owner and staff views, loaded with realistic data.
This is usually the most useful thing to offer someone who is still deciding.

WHERE TO SEND PEOPLE
sales@rotahr.com is the only contact address, and it is the address they have
already written to. Never tell a sender to "contact support", "reach out to our
support team" or email a different address — there is nowhere else to send them
and it reads as a brush-off. Say that the team will pick it up from here.

ADMIN / ACCOUNT FACTS
- Payments are handled by Lemon Squeezy. Card details never touch Rotahr.
- Data protection: https://rotahr.com/privacy — terms: https://rotahr.com/terms
- Getting started is self-service: sign up, add your venue and staff, build a rota.
`.trim();

/**
 * Topics the assistant must never resolve on its own. Each one either commits
 * Rotahr commercially, carries a legal deadline, or means the sender is already
 * unhappy — all cases where a wrong-but-confident answer costs more than a
 * short wait for a human.
 */
export const ESCALATION_RULES = `
Set needsHuman=true (but still write your best draft) when the message:
- asks for a discount, custom pricing, a bespoke plan, or enterprise negotiation
- is a legal, GDPR, data-protection, subject-access or data-deletion request
- concerns a refund, cancellation, chargeback or billing dispute
- asks to speak to a person, or asks for a call/meeting to be scheduled
- is a complaint, or the sender is clearly frustrated or angry
- would require inventing any fact not present in the knowledge above
- you are less than reasonably confident you can answer correctly
`.trim();
