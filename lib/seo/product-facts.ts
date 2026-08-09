/**
 * lib/seo/product-facts.ts — the single source of truth about Rotahr for every
 * AI writing prompt.
 *
 * This file exists because of a real incident: an article generated for the
 * query "rota software with flat monthly pricing instead of per employee
 * pricing" published a comparison table stating "Rotahr | $30 | N/A", and two
 * earlier live articles told readers Rotahr costs "$2 per employee per month"
 * and "$5 to $15 per user". All invented, and the per-employee ones contradict
 * the single clearest thing about how Rotahr is sold.
 *
 * A model asked to compare pricing will always produce a number. If we don't
 * supply the real one it produces a plausible one, and that number then gets
 * indexed, quoted by AI assistants, and read by people deciding whether to buy.
 * So: facts injected into the prompt, and a hard check on the way out.
 */

/** Live plan pricing, VAT inclusive. Update here and every prompt follows. */
export const PLANS = [
  { name: "Starter", price: 59, staff: "up to 15 staff" },
  { name: "Pro", price: 119, staff: "up to 30 staff" },
  { name: "Enterprise", price: 215, staff: "unlimited staff, multi-venue" },
] as const;

/**
 * The facts block. Deliberately includes what Rotahr is NOT, because the honest
 * "when not to pick us" sections are what make a comparison page trustworthy —
 * and left unguided the model invents those weaknesses too.
 */
export const PRODUCT_FACTS = `FACTS ABOUT ROTAHR — these are authoritative. Never state a price, plan or limit that contradicts them, and never invent one that isn't here.

Pricing (flat monthly fee per venue, VAT included, NOT per employee):
${PLANS.map((p) => `- ${p.name}: EUR ${p.price}/month, ${p.staff}`).join("\n")}
- Billing currencies supported: EUR, GBP, USD, CAD, AUD.
- First month free.
- CRITICAL: Rotahr NEVER charges per employee, per user or per seat. That flat
  pricing is its main commercial difference from Deputy, When I Work, 7shifts
  and Homebase, which all bill per head. If you write that Rotahr costs "X per
  employee" or "X per user" you have made a factual error and reversed its
  entire market position.
- If a comparison needs a per-employee figure for Rotahr, the correct answer is
  that it has none: give the flat monthly fee instead.

What Rotahr actually includes (do not credit it with anything else):
- Staff scheduling / rota building, shift swaps, availability, time off
- Clock in/out with break entitlement tracking
- Table bookings and reservations, visual floor plan
- Digital HACCP food safety records: temperature checks, cleaning, opening and
  closing checks, delivery checks, corrective action log, PDF export for
  inspections
- Recipe costing and stock, delivery note scanning
- Payroll reports, tips and tronc distribution
- Customer CRM, staff training and certification expiry tracking
- Multi-venue support, mobile app for iOS and Android

Honest limitations — use these when a section calls for balance, rather than
inventing weaknesses:
- Hospitality only. It is not built for retail, healthcare, warehouses or offices.
- It is a young product from a small independent company, not an enterprise
  suite with a decade of third-party integrations.
- Flat per-venue pricing is poor value for a very small team: a venue with 3 or 4
  staff may pay less on a per-employee plan elsewhere.
- No free forever tier, only a free first month.

Founded by a former chef, self-funded, based in Ireland, selling into Ireland,
the UK, the US, Canada and Australia.`;

/**
 * Anything that claims Rotahr bills per person, or attaches a price to Rotahr
 * that isn't one of the real plan prices.
 *
 * Returns a list of problems, empty when clean.
 */
export function checkRotahrFacts(markdown: string): string[] {
  const problems: string[] = [];
  const valid = new Set(PLANS.map((p) => String(p.price)));

  // 1. Per-head pricing attributed to Rotahr, in prose or in a table row.
  const perHead =
    /Rotahr[^.\n|]{0,160}?[€$£]\s?\d[\d.,]*\s*(?:\/|\bper\b)\s*(?:employee|user|seat|person|head|staff)/gi;
  for (const m of markdown.matchAll(perHead)) {
    problems.push(`per-employee pricing attributed to Rotahr: "${m[0].replace(/\s+/g, " ").slice(0, 120)}"`);
  }

  // The same claim with the price FIRST — "about $2 per user per month for tools
  // like Rotahr". This phrasing survived the original guard and stayed live.
  //
  // The window is short and contrast-aware on purpose. A legitimate sentence
  // often prices a COMPETITOR per head and then names Rotahr as the contrast
  // ("at $3 per employee that's $30 a month, compared to Rotahr's flat fee"),
  // which is exactly the argument we want made. Flagging that would make the
  // guard cry wolf on the best sentences on the page.
  const CONTRAST = /\b(compared to|versus|vs\.?|unlike|whereas|rather than|instead of|while|but)\b/i;
  const perHeadReversed =
    /[€$£]\s?\d[\d.,]*\s*(?:\/|\bper\b)\s*(?:employee|user|seat|person|head|staff)([^.\n|]{0,90}?)Rotahr/gi;
  for (const m of markdown.matchAll(perHeadReversed)) {
    if (CONTRAST.test(m[1])) continue; // competitor priced, Rotahr contrasted — fine
    problems.push(`per-employee pricing attributed to Rotahr: "${m[0].replace(/\s+/g, " ").slice(0, 120)}"`);
  }
  // Table rows are checked separately: the prose regex cannot cross a "|", so
  // "| Rotahr | $30 | N/A |" slips past it entirely.
  for (const row of markdown.split("\n")) {
    if (!/^\s*\|/.test(row) || !/rotahr/i.test(row)) continue;
    if (/[€$£]\s?\d[\d.,]*\s*(?:\/|\bper\b)\s*(?:employee|user|seat|person|head|staff)/i.test(row)) {
      problems.push(`per-employee pricing in a Rotahr table row: "${row.trim().slice(0, 120)}"`);
      continue;
    }
    for (const m of row.matchAll(/([€$£])\s?(\d[\d.,]*)/g)) {
      const num = m[2].replace(/[.,]$/, "");
      if (valid.has(num)) continue;
      if (Number(num.replace(/[,.]/g, "")) >= 1000) continue;
      problems.push(`price in a Rotahr table row that is not a real plan price: "${row.trim().slice(0, 120)}"`);
      break;
    }
  }

  // 2. A price sitting next to Rotahr that is not a real plan price.
  const near = /Rotahr[^.\n|]{0,120}?([€$£])\s?(\d[\d.,]*)/gi;
  for (const m of markdown.matchAll(near)) {
    const num = m[2].replace(/[.,]$/, "");
    // Ignore large round numbers that are clearly about something else
    // (fines, revenue, savings) rather than a plan price.
    const asInt = Number(num.replace(/[,.]/g, ""));
    if (valid.has(num)) continue;
    if (asInt >= 1000) continue;
    problems.push(`price near Rotahr that is not a real plan price: "${m[0].replace(/\s+/g, " ").slice(0, 120)}"`);
  }

  return problems;
}

/** Strip placeholder links the model leaves behind, e.g. [Read more](#). */
export function stripPlaceholderLinks(markdown: string): string {
  return markdown
    // *Related: [Foo](#), [Bar](#)* — a whole fabricated related line.
    .replace(/^\s*\*Related:[^\n]*\]\(#\)[^\n]*\*\s*$/gm, "")
    // Any remaining [text](#) becomes plain text.
    .replace(/\[([^\]]+)\]\(#\)/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}
