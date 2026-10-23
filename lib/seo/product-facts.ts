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
  { name: "Starter", price: 49, staff: "up to 15 staff" },
  { name: "Pro", price: 89, staff: "up to 30 staff" },
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
- First 3 months free on every plan, no card required.
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
- Recipe costing and stock, delivery note scanning, supplier price history
  recorded from stock edits, receipts, delivery notes and statement
  reconciliation
- Manager Copilot: a read-only daily brief built from the venue's own data —
  missed HACCP checks, margin hit by supplier price rises (target GP 70% by
  default, editable), waste, booking forecast vs rota staffing, no-show risk —
  plus an Ask box. Included on every plan. It never sends, publishes or changes
  anything, and names, emails, phones and IDs are stripped before anything
  reaches the AI model
- Payroll reports, tips and tronc distribution
- Customer CRM, staff training and certification expiry tracking
- Multi-venue support (POS revenue and labour % per venue), mobile app for iOS
  and Android

Honest limitations — use these when a section calls for balance, rather than
inventing weaknesses:
- Hospitality only. It is not built for retail, healthcare, warehouses or offices.
- It is a young product from a small independent company, not an enterprise
  suite with a decade of third-party integrations.
- Flat per-venue pricing is poor value for a very small team: a venue with 3 or 4
  staff may pay less on a per-employee plan elsewhere.
- No free forever tier for a normal signup, only the free first 3 months. The 20 founding members are the exception: they keep the rota, clock in/out and the staff app free forever after those months.

Founded by a former chef, self-funded, based in Ireland, selling into Ireland,
the UK, the US, Canada and Australia.`;

/** Products a sentence may legitimately quote a trial length for. */
const OTHER_PRODUCTS =
  /\b(?:Deputy|When I Work|7shifts|Homebase|Sling|Planday|RotaCloud|Rotaready|Bizimply|Ordio|Gusto|QuickBooks|Xero|Sage|BrightPay|Thesaurus|IRIS|Paychex|ADP|Toast|Square|Lightspeed|OpenTable|ResDiary|SevenRooms|Resy|Tock|Collins|Trail|Navitas|Kitchen ?Cut|Apicbase|MarketMan|Nory|Tanda|Fourth|Harri|Connecteam|Shiftbase|Humanity|Zoho|Bamboo ?HR|Breathe|Personio)\b/i;

/**
 * Anything that claims Rotahr bills per person, or attaches a price to Rotahr
 * that isn't one of the real plan prices.
 *
 * Returns a list of problems, empty when clean.
 */
export function checkRotahrFacts(markdown: string): string[] {
  const problems: string[] = [];
  // Normalise ISO currency codes to symbols so "EUR 59" is checked exactly
  // like "€59". The generator writes both; a live article said "EUR 59/month
  // (up to 15 staff)" for a plan that costs 49 and passed this guard because
  // every pattern below only knew the symbols.
  markdown = markdown.replace(/\b(?:EUR|GBP|USD|CAD|AUD)\s?(?=\d)/g, (c) =>
    c.startsWith("GBP") ? "£" : c.startsWith("EUR") ? "€" : "$",
  );
  const valid = new Set(PLANS.map((p) => String(p.price)));

  const CONTRAST = /\b(compared to|versus|vs\.?|unlike|whereas|rather than|instead of|while|but|others?|competitors?)\b/i;

  // 1. Per-head pricing attributed to Rotahr, in prose or in a table row.
  // Skipped when the per-head price belongs to a contrasted competitor:
  // "Rotahr is EUR 49 a month, while others charge EUR 3 per employee".
  const perHead =
    /Rotahr([^.\n|]{0,160}?)[€$£]\s?\d[\d.,]*\s*(?:\/|\bper\b)\s*(?:employee|user|seat|person|head|staff)/gi;
  for (const m of markdown.matchAll(perHead)) {
    if (CONTRAST.test(m[1])) continue;
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
  // Savings and differences are not prices ("Rotahr saves EUR 31 a month"),
  // and neither is a competitor's price contrasted against Rotahr.
  const NOT_A_PRICE = /\b(saves?|saving|savings|extra|difference|cheaper|more|less|translates|worth|reduc\w*|cut|recover\w*)\b/i;
  const near = /Rotahr([^.\n|]{0,120}?)([€$£])\s?(\d[\d.,]*)/gi;
  for (const m of markdown.matchAll(near)) {
    if (CONTRAST.test(m[1]) || NOT_A_PRICE.test(m[1])) continue;
    const num = m[3].replace(/[.,]$/, "");
    // Ignore large round numbers that are clearly about something else
    // (fines, revenue, savings) rather than a plan price.
    const asInt = Number(num.replace(/[,.]/g, ""));
    if (valid.has(num)) continue;
    if (asInt >= 1000) continue;
    problems.push(`price near Rotahr that is not a real plan price: "${m[0].replace(/\s+/g, " ").slice(0, 120)}"`);
  }

  // 3. Trial length. Every plan is 3 months free; "first month free",
  // "14-day free trial" and the like are invented and contradict the offer.
  // Checked per sentence, and only where the sentence is about Rotahr or names
  // no other product: "Deputy has a 30-day free trial" is a competitor fact.
  const trial =
    /\b(?:first|1|one|two|2)\s*(?:-\s*)?(?:month|week)s?\s+(?:free|trial)\b|\b\d{1,2}[- ]day (?:free )?trial\b|\bfree for (?:the first )?(?:month|30 days|14 days)\b/i;
  for (const sentence of markdown.split(/(?<=[.!?])\s+|\n+/)) {
    const m = sentence.match(trial);
    if (!m) continue;
    // Table rows are attributed by column below, not by sentence.
    if (/^\s*\|/.test(sentence) && !/rotahr/i.test(sentence)) continue;
    if (!/rotahr/i.test(sentence) && OTHER_PRODUCTS.test(sentence)) continue;
    problems.push(`trial length that is not "first 3 months free": "${m[0]}"`);
  }

  // 4. Comparison tables with Rotahr as a COLUMN ("| Feature | Rotahr | Deputy |").
  // Row-based checks above can't see these: the Rotahr cell never contains the
  // word Rotahr. Read the header, then check that column's cells.
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*\|/.test(lines[i]) || (i > 0 && /^\s*\|/.test(lines[i - 1]))) continue;
    const cells = (row: string) => row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const col = cells(lines[i]).findIndex((c) => /^\**\s*rotahr\b/i.test(c));
    if (col < 0) continue;
    for (let j = i + 1; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const cell = cells(lines[j])[col] ?? "";
      const pm = cell.match(/([€$£])\s?(\d[\d.,]*)/);
      if (pm) {
        const num = pm[2].replace(/[.,]$/, "");
        if (!valid.has(num) && Number(num.replace(/[,.]/g, "")) < 1000)
          problems.push(`price in the Rotahr column that is not a real plan price: "${cell.slice(0, 80)}"`);
      }
      if (/per\s*(?:employee|user|seat|head)/i.test(cell))
        problems.push(`per-employee pricing in the Rotahr column: "${cell.slice(0, 80)}"`);
      const tm = cell.match(trial);
      if (tm) problems.push(`trial length in the Rotahr column that is not "first 3 months free": "${tm[0]}"`);
    }
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
