/**
 * Correct Rotahr prices and trial length in live blog posts.
 *
 * Commit c7f238f cut Starter 59 -> 49 and Pro 119 -> 89 across the site, and
 * the offer is "first 3 months free", but ~35 blog posts generated before then
 * still quote 59 / 119 / "first month free" — in prose, in table rows and in
 * comparison tables where Rotahr is a column. Every 59 / 119 euro figure on
 * the blog was reviewed by hand (Oct 2026) and all of them are Rotahr prices,
 * so the replacement is applied post-wide in posts that contain them.
 *
 * Prices feed arithmetic (annual totals, savings, "11 months at..."). Global
 * x12 totals are mapped; every other derived figure is an explicit per-post
 * override below, written by hand and checked. A post is only written if the
 * result passes checkRotahrFacts and no stale figure is left in it.
 *
 * Dry run by default; prints every changed line. Pass --apply to write.
 * Leaves `published`, `createdAt` and `refreshedAt` alone.
 *
 * Run: npx tsx scripts/fix-stale-blog-prices.ts [--apply]
 */
import { prisma } from "../lib/prisma";
import { checkRotahrFacts } from "../lib/seo/product-facts";

const APPLY = process.argv.includes("--apply");

/** Exact sentence-level fixes where a price feeds arithmetic. Applied first. */
const OVERRIDES: Record<string, [string, string][]> = {
  "staff-scheduling-software-vs-spreadsheets-what-irish-restaurants-save": [
    // The original also multiplied wrongly: 20 x 5 x 52 is 5,200, not 1,040.
    [
      "5 hours per week translates to EUR 1,040 per year (EUR 20 x 5 hours x 52 weeks).",
      "5 hours per week translates to EUR 5,200 per year (EUR 20 x 5 hours x 52 weeks).",
    ],
    [
      `**Managerial Time**: EUR 1,040  
**Total**: EUR 4,640 per year.`,
      `**Managerial Time**: EUR 5,200  
**Total**: EUR 8,800 per year.`,
    ],
    [
      "- **Rotahr Monthly Fee**: EUR 119 for the Pro plan (unlimited staff up to 30, VAT included).",
      "- **Rotahr Monthly Fee**: EUR 89 for the Pro plan (up to 30 staff, VAT included).",
    ],
    [
      `### Total Costs with Rotahr:  
**Rotahr Annual Fee**: EUR 1,428 (EUR 119 x 12)  
**Managerial Time**: EUR 4,160  
**Reduced Overtime**: EUR 1,800  
**Total**: EUR 7,388 annually.

### Financial Comparison:
- **Current Costs**: EUR 4,640  
- **Costs with Rotahr**: EUR 7,388  
- **Net Savings**: While the total costs with Rotahr appear higher, the benefits of improved employee satisfaction, compliance, and fewer scheduling errors translate into long-term financial gains that are not immediately reflected in numbers alone.`,
      `### Total Costs with Rotahr:  
**Rotahr Annual Fee**: EUR 1,068 (EUR 89 x 12)  
**Managerial Time**: EUR 1,040 (1 hour x EUR 20 x 52 weeks)  
**Overtime**: EUR 1,800 (half of the current EUR 3,600)  
**Total**: EUR 3,908 annually.

### Financial Comparison:
- **Current Costs**: EUR 8,800  
- **Costs with Rotahr**: EUR 3,908  
- **Net Savings**: EUR 4,892 a year, before the first 3 months free. The inputs are assumptions; put in your own hours, manager rate and overtime to see what it looks like for your venue.`,
    ],
    ["Take advantage of the free month offered", "Take advantage of the first 3 months free offered"],
  ],
  "rota-software-with-flat-monthly-pricing-instead-of-per-employee-pricing": [
    ["saves EUR 2,400 - EUR 1,428 = EUR 972 annually", "saves EUR 2,400 - EUR 1,068 = EUR 1,332 annually"],
  ],
  "the-best-table-management-software-for-restaurants": [
    ["choosing Rotahr saves EUR 31 each month", "choosing Rotahr saves EUR 61 each month"],
  ],
  "how-much-does-it-cost-to-buy-a-small-restaurant": [
    ["Over a year, this would amount to EUR 708,", "Over a year, this would amount to EUR 588,"],
  ],
  "digital-haccp-and-food-safety-compliance-app-for-restaurants": [
    [
      "After the first month free, the total cost for the first year would be EUR 708 (11 months at EUR 59). In contrast, if the same restaurant used a competitor that charges EUR 3 per employee, the monthly cost would be EUR 30 (10 staff x EUR 3), leading to an annual cost of EUR 360. For this scenario, Rotahr's flat fee offers a significant advantage in features and compliance tools for an extra EUR 348 per year.",
      "With the first 3 months free, the total cost for the first year would be EUR 441 (9 months at EUR 49), then EUR 588 a year after that. In contrast, if the same restaurant used a competitor that charges EUR 3 per employee, the monthly cost would be EUR 30 (10 staff x EUR 3), or EUR 360 a year. At 10 staff the per-employee tool is cheaper on price alone, by EUR 228 a year from year two. What the difference buys is the HACCP records, bookings and stock tools in the same system.",
    ],
  ],
  "best-open-source-shift-planning-software-options": [
    [
      "If the restaurant had started with the first month free, the actual billing would begin in the second month, making it easier to manage cash flow.",
      "With the first 3 months free, billing would only begin in the fourth month, making it easier to manage cash flow.",
    ],
  ],
  "best-employee-shift-scheduling-software-a-practical-comparison": [
    [
      "Based on the flat monthly fee of EUR 59, your first month is free, allowing you to test its features without upfront costs.",
      "At a flat monthly fee of EUR 49, with the first 3 months free, you can test its features without upfront costs.",
    ],
  ],
  "freddy-s-bistro-limerick-a-comprehensive-guide": [
    ["The first month is free, so the initial cost is zero.", "The first 3 months are free, so the initial cost is zero."],
  ],
  "the-best-food-safety-record-keeping-systems-for-your-business": [
    ["The first month would be free, allowing", "The first 3 months would be free, allowing"],
  ],
};

const OLD_PRICE = /(€\s?|EUR\s?)(59|119)(?!\d|[,.]\d)/g;
const OLD_ANNUAL = /(€\s?|EUR\s?)(1,428|1428)(?!\d)/g;
const MONTH_FREE = /\b(first|1|one)\s+month\s+free\b/gi;
/** Anything left in a post after fixing means a case the rules didn't cover. */
const STALE = /(?:€\s?|EUR\s?)(?:59|119|1,428)(?!\d|[,.]\d)|\b(?:first|1|one) month (?:is |would be )?free\b|\bfree month\b/i;

function fixText(s: string): string {
  return s
    .replace(OLD_PRICE, (_m, c, n) => c + (n === "59" ? "49" : "89"))
    .replace(OLD_ANNUAL, (_m, c) => c + "1,068")
    .replace(MONTH_FREE, (m) =>
      /Month Free/.test(m) ? "First 3 Months Free" : /^F/.test(m) ? "First 3 months free" : "first 3 months free",
    );
}

function fixFaq(faq: string | null): string | null {
  if (!faq) return faq;
  let arr: { q: string; a: string }[];
  try {
    arr = JSON.parse(faq);
  } catch {
    return faq;
  }
  const next = JSON.stringify(arr.map((f) => ({ q: fixText(f.q), a: fixText(f.a) })));
  return next === JSON.stringify(arr) ? faq : next;
}

async function main() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { id: true, slug: true, content: true, faq: true, excerpt: true, metaDesc: true },
  });

  let changed = 0;
  const blocked: string[] = [];
  for (const p of posts) {
    const all = [p.content, p.faq ?? "", p.excerpt, p.metaDesc].join("\n\n");
    const overrides = OVERRIDES[p.slug] ?? [];
    if (!STALE.test(all) && !checkRotahrFacts(all).length && !overrides.length) continue;

    let content = p.content;
    for (const [from, to] of overrides) {
      if (!content.includes(from)) {
        blocked.push(`## ${p.slug}\n   ! override not found: "${from.slice(0, 80)}"`);
        continue;
      }
      content = content.replace(from, to);
    }
    content = fixText(content);
    const faq = fixFaq(p.faq);
    const excerpt = fixText(p.excerpt);
    const metaDesc = fixText(p.metaDesc);

    const after = [content, faq ?? "", excerpt, metaDesc].join("\n\n");
    const problems = checkRotahrFacts(after);
    const stale = after.split("\n").filter((l) => STALE.test(l));
    if (problems.length || stale.length) {
      blocked.push(
        `## ${p.slug}\n` +
          problems.map((x) => "   ! " + x.slice(0, 200)).join("\n") +
          stale.map((l) => "\n   ! stale: " + l.trim().slice(0, 200)).join(""),
      );
      continue;
    }

    const diffs: string[] = [];
    const a = p.content.split("\n"), b = content.split("\n");
    if (a.length === b.length) {
      a.forEach((l, i) => { if (l !== b[i]) diffs.push(`  - ${l.trim()}\n  + ${b[i].trim()}`); });
    } else {
      diffs.push(`  (block rewrite)\n${b.filter((l) => !a.includes(l)).map((l) => "  + " + l).join("\n")}`);
    }
    if (faq !== p.faq) diffs.push(`  (faq) - ${p.faq}\n  (faq) + ${faq}`);
    if (excerpt !== p.excerpt) diffs.push(`  - ${p.excerpt}\n  + ${excerpt}`);
    if (metaDesc !== p.metaDesc) diffs.push(`  - ${p.metaDesc}\n  + ${metaDesc}`);
    if (!diffs.length) continue;

    changed++;
    console.log(`## ${p.slug}\n${diffs.join("\n")}\n`);
    if (APPLY) await prisma.blogPost.update({ where: { id: p.id }, data: { content, faq, excerpt, metaDesc } });
  }

  console.log(`${changed} posts ${APPLY ? "updated" : "would change"}.`);
  if (blocked.length) console.log(`\nNOT written — needs a hand fix:\n${blocked.join("\n")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
