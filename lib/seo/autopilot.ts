/**
 * lib/seo/autopilot.ts — the three loops a paid SEO autopilot actually runs.
 *
 *   1. harvestKeywords()  — refill the keyword pipeline (free: Google Suggest +
 *                           Search Console), score it, keep it deduped
 *   2. publishNextArticle() — take the highest-scoring keyword and ship one
 *                           article written specifically for that query
 *   3. refreshDecaying()  — go back over articles that rank 4-20 or have lost
 *                           clicks, and improve them
 *
 * Loop 3 is the one people skip and it's usually worth more than loop 2.
 */

import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { generateCoverImage, slugify } from "@/lib/blog/cover-image";
import { submitToIndexNow } from "@/lib/seo/indexnow";
import {
  gscConfigured,
  queryPerformance,
  pagePerformance,
  strikingDistance,
  dailyPerformance,
} from "@/lib/seo/gsc";
import {
  harvestSuggestions,
  questionsFor,
  scoreKeyword,
  classifyIntent,
  isUsable,
  similarity,
  type Intent,
} from "@/lib/seo/keywords";
import {
  PRODUCT_FACTS,
  checkRotahrFacts,
  stripPlaceholderLinks,
} from "@/lib/seo/product-facts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const SITE = "https://rotahr.com";

async function log(task: string, ok: boolean, detail: string) {
  await prisma.seoRun
    .create({ data: { task, ok, detail: detail.slice(0, 4000) } })
    .catch((e: unknown) => console.error("[seo] run log failed", e));
}

// ---------------------------------------------------------------------------
// 1. Keyword pipeline
// ---------------------------------------------------------------------------

export async function harvestKeywords(): Promise<{
  suggested: number;
  fromGsc: number;
  created: number;
  rescored: number;
}> {
  const suggestions = await harvestSuggestions();

  // One read + one write instead of a round trip per keyword. A harvest finds
  // ~1,000 suggestions and Neon is not local, so this is the difference between
  // seconds and timing out.
  const existingRows = await prisma.seoKeyword.findMany({
    select: { keyword: true },
  });
  const known = new Set(
    existingRows.map((r: { keyword: string }) => r.keyword),
  );

  const fresh = suggestions
    .filter((s) => !known.has(s.keyword))
    .map((s) => ({
      keyword: s.keyword,
      cluster: s.cluster,
      intent: s.intent,
      source: "suggest",
      priority: scoreKeyword({ keyword: s.keyword, intent: s.intent }),
    }));

  const { count: created } = await prisma.seoKeyword.createMany({
    data: fresh,
    skipDuplicates: true,
  });

  // Layer real performance data on top wherever we have it.
  let fromGsc = 0;
  let rescored = 0;
  if (gscConfigured()) {
    const rows = await queryPerformance(28);
    for (const row of rows) {
      if (!isUsable(row.keyword)) continue;
      const intent: Intent = classifyIntent(row.keyword, "informational");
      const priority = scoreKeyword({
        keyword: row.keyword,
        intent,
        impressions: row.impressions,
        clicks: row.clicks,
        position: row.position,
      });

      const existing = await prisma.seoKeyword.findUnique({
        where: { keyword: row.keyword },
      });
      if (existing) {
        await prisma.seoKeyword.update({
          where: { keyword: row.keyword },
          data: {
            impressions: row.impressions,
            clicks: row.clicks,
            position: row.position,
            // A written article can come back into the queue if it's stuck at
            // 4-20 — that's what refreshDecaying picks up.
            priority,
          },
        });
        rescored++;
      } else {
        await prisma.seoKeyword.create({
          data: {
            keyword: row.keyword,
            cluster: "search console",
            intent,
            source: "gsc",
            impressions: row.impressions,
            clicks: row.clicks,
            position: row.position,
            priority,
          },
        });
        fromGsc++;
      }
    }

    // Store a page-level snapshot so the dashboard can show trend without
    // hitting the API on every page view.
    const pages = await pagePerformance(28);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    for (const p of pages) {
      await prisma.seoMetric
        .upsert({
          where: { date_page_query: { date: today, page: p.page, query: "" } },
          create: {
            date: today,
            page: p.page,
            query: "",
            clicks: p.clicks,
            impressions: p.impressions,
            ctr: p.ctr,
            position: p.position,
          },
          update: {
            clicks: p.clicks,
            impressions: p.impressions,
            ctr: p.ctr,
            position: p.position,
          },
        })
        .catch(() => {});
    }
  }

  await log(
    "keywords",
    true,
    `suggest=${suggestions.length} created=${created} gscNew=${fromGsc} rescored=${rescored} gsc=${gscConfigured()}`,
  );

  return { suggested: suggestions.length, fromGsc, created, rescored };
}

// ---------------------------------------------------------------------------
// 2. Publish
// ---------------------------------------------------------------------------

type Article = {
  title: string;
  metaTitle: string;
  metaDesc: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  faq: { q: string; a: string }[];
};

const CATEGORIES = [
  "scheduling",
  "compliance",
  "hr",
  "finance",
  "costs",
  "payroll",
  "management",
  "technology",
  "product",
];

/** Weave 2-3 contextual internal links plus one product link into the markdown. */
function insertInternalLinks(
  content: string,
  related: { slug: string; title: string }[],
): string {
  if (related.length === 0) return content;

  const paragraphs = content.split("\n\n");
  const bodyIdxs = paragraphs
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.trim() && !p.trim().startsWith("#"))
    .map(({ i }) => i);

  const links = related.slice(0, 3);
  links.forEach((link, i) => {
    const idx =
      bodyIdxs[Math.floor(((i + 1) / (links.length + 1)) * bodyIdxs.length)];
    if (idx === undefined) return;
    paragraphs[idx] =
      `${paragraphs[idx]}\n\n*Related: [${link.title}](/blog/${link.slug})*`;
  });

  paragraphs.push(
    `Want to see how this works in practice? [Explore Rotahr](/landing) — scheduling, bookings, food safety and payroll for restaurants, bars and hotels.`,
  );

  return paragraphs.join("\n\n");
}

/** Second, cheap call: FAQ only. Used when the article call omits it. */
async function faqFor(
  keyword: string,
  content: string,
  questions: string[],
): Promise<{ q: string; a: string }[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: `Write an FAQ for an article targeting the Google query "${keyword}".
${questions.length ? `Use these real related searches as the questions where they fit:\n${questions.map((q) => `- ${q}`).join("\n")}` : ""}
Answers must be consistent with the article below, 2-4 sentences, specific, no fluff.

Article:
${content.slice(0, 6000)}

Return ONLY JSON: {"faq":[{"q":"...","a":"..."}]} with 3-6 entries.`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.5,
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0].message.content || "{}");
    return Array.isArray(parsed.faq)
      ? parsed.faq
          .filter((f: { q?: string; a?: string }) => f?.q && f?.a)
          .slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

/**
 * Write one article for one query.
 *
 * The structure here is aimed at two readers at once: a person, and the answer
 * engines (ChatGPT, Perplexity, Google AI Overviews) that increasingly stand
 * between us and that person. Those engines lift self-contained blocks — a bold
 * direct answer, a question-shaped heading answered in its first sentence, a
 * table, a figure with its qualifier attached. Flowing prose that builds to a
 * conclusion reads well and gets quoted by nobody.
 */
/** Words in a markdown body, ignoring link syntax and table pipes. */
/**
 * Everything a reader (or Google's rich result) will actually see, as one blob
 * for the fact guard. The FAQ ships on the page and inside FAQPage schema, so
 * it has to be held to the same standard as the body.
 */
function factsSurface(
  content: string,
  faq?: { q: string; a: string }[] | null,
): string {
  const faqText = (faq || []).map((f) => `${f.q}\n${f.a}`).join("\n\n");
  return faqText ? `${content}\n\n${faqText}` : content;
}

function countWords(md: string): number {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[|>#*_`[\]()-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * True when the body opens with a bold answer paragraph before the first H2.
 * That block is what Google's AI Overviews and ChatGPT lift verbatim, so it
 * must survive every edit pass.
 */
function hasLeadAnswer(md: string): boolean {
  const beforeFirstH2 = md.split(/^## /m)[0];
  return /\*\*[^*]{40,}\*\*/.test(beforeFirstH2);
}

/**
 * The brief asks for 1100-1600 words. gpt-4o-mini reliably delivers 620-860 and
 * stops — the first 61 articles averaged well under half the target, which is a
 * large part of why none of them rank. The pages holding position 1 for a
 * commercial comparison query run 2,000+ words with tables and worked figures.
 *
 * So we measure, and if it came back thin we send it back once with the actual
 * count quoted at it. Asking for "more detail" produces padding; asking for
 * named specific additions produces substance.
 */
const MIN_WORDS = 1000;

async function ensureDepth(
  keyword: string,
  content: string,
  intent: string,
): Promise<string> {
  const words = countWords(content);
  if (words >= MIN_WORDS) return content;

  const commercial = intent === "commercial" || intent === "transactional";
  const asks = commercial
    ? `- A comparison table of at least 4 real named tools and who each suits. For pricing, give the SHAPE of each competitor's pricing (per employee, per venue, free tier) rather than an invented current figure. Rotahr's row must use its real flat prices from the facts above.
- A "what this costs in practice" section with worked figures for a named venue size, using Rotahr's real plan prices.
- An honest "when NOT to pick Rotahr" paragraph, drawn from the stated limitations above. Buyers trust a page that rules itself out.`
    : `- A worked example with real figures, start to finish.
- A copyable checklist, template or step sequence the reader can lift straight out.
- A "common mistakes" section naming what goes wrong and the consequence of each.`;

  // Two attempts, not one. The depth pass fails silently often enough to
  // matter: the bookings gap article came back under the +15% bar three runs in
  // a row and shipped at 727 words with nothing in the log to say why. A second
  // try at a higher temperature clears it most of the time, and the reason is
  // now always logged.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `${PRODUCT_FACTS}

This article targets the Google query "${keyword}". It is ${words} words. Competing pages that rank on page one for this query run 1,500-2,500 words, so as it stands it cannot compete.

Expand it to at least 1,400 words by ADDING substance. Rules:
- Keep every existing heading and sentence. This is additive only — do not rewrite or summarise what is there.
- CRITICAL: the article opens with a short bold paragraph answering the query, BEFORE the first "## " heading. Reproduce it first, word for word, still bold. Never drop it and never move it under a heading — it is the block search engines and AI assistants quote.
- Keep any *Related: [...]* lines and the closing Rotahr link exactly where they are.
- Add these:
${asks}
- Every number you add must name what it applies to (venue size, country, year) in the same sentence.
- No padding. No "in today's fast-paced world". If you have nothing substantive to add to a section, leave it alone.
- Never state or imply that Rotahr charges per employee, per user or per seat, and never attach a price to Rotahr other than its real flat plan prices above.
- Every link must be a real URL or /blog/... path. No [text](#) placeholders.
- Clean Markdown, no H1, no code fences.

Article:
${content}

Return ONLY JSON: {"content":"the full expanded markdown"}`,
          },
        ],
        max_tokens: 8000,
        temperature: attempt === 1 ? 0.6 : 0.85,
        response_format: { type: "json_object" },
      });
      const parsed = JSON.parse(
        completion.choices[0].message.content || "{}",
      ) as { content?: string };
      // Only accept a genuine expansion — a shorter or barely-changed result is a
      // regression, and we'd rather ship the honest short version.
      // The bar relaxes on the last attempt. A +12% expansion is still 100 real
    // words of substance, and rejecting it leaves the page thinner than
    // accepting it — the strict bar exists to reject regressions, not gains.
    const bar = attempt === 1 ? 1.15 : 1.05;
    if (!parsed.content || countWords(parsed.content) <= words * bar) {
        console.error(
          `[seo] depth pass attempt ${attempt} came back thin on "${keyword}": ${words} -> ${
            parsed.content ? countWords(parsed.content) : 0
          } words`,
        );
      } else {
        // The lead paragraph is the whole AI-visibility play, and the model does
        // drop it: the first live run turned a bold opening answer into a plain
        // "## Understanding..." heading. Length is not worth losing it.
        if (hasLeadAnswer(content) && !hasLeadAnswer(parsed.content)) {
          console.error(
            `[seo] depth pass dropped the lead answer on "${keyword}" — keeping original`,
          );
          return content;
        }
        const expanded = stripPlaceholderLinks(parsed.content);
        // The expansion pass is where invented pricing tables appear, because
        // "add a comparison table" is exactly the instruction that makes a model
        // reach for numbers it doesn't have.
        const problems = checkRotahrFacts(expanded);
        if (problems.length) {
          console.error(
            `[seo] depth pass invented facts about Rotahr on "${keyword}" — keeping original:\n  ${problems.join("\n  ")}`,
          );
          return content;
        }
        console.log(
          `[seo] expanded "${keyword}" ${words} -> ${countWords(expanded)} words`,
        );
        return expanded;
      }
    } catch (err) {
      console.error("[seo] depth pass failed", err);
    }
  }
  return content;
}

async function writeArticle(
  keyword: string,
  cluster: string,
  intent: string,
  questions: string[],
): Promise<Article | null> {
  const year = new Date().getFullYear();

  const intentBrief =
    intent === "commercial" || intent === "transactional"
      ? `This is a buying-intent query. Compare real options honestly, including where alternatives are genuinely better than Rotahr. Give concrete price ranges and a clear "pick X if..." recommendation. A reader must be able to make a decision from this page.`
      : `This is a research query. Answer the question completely in the first 60 words, then go deeper. Include at least one concrete number, worked example, or template the reader can copy.`;

  const prompt = `You are writing for Rotahr — staff scheduling, bookings, food-safety (HACCP) and payroll software for restaurants, bars and hotels. It was founded by a former chef, so the voice is practical and unimpressed by fluff.

${PRODUCT_FACTS}

Competitor pricing changes constantly and you cannot look it up, so do not state a specific figure for a competitor as if it were current. Describe the shape of their pricing instead ("bills per employee per month, which scales with headcount") and tell the reader to check the vendor's page for today's number. Never put an invented figure in a table.

Write ONE article that ranks for this exact Google query: "${keyword}"
Topic cluster: ${cluster}
${intentBrief}

Hard rules:
- The H1/title must read naturally but contain the query or a very close variant.
- 1400-1900 words, and treat that as a floor rather than a target. Pages that rank on page one for a query like this run 1,500-2,500 words. No padding, no "in today's fast-paced world" — length must come from specifics.
- Open with a 2-3 sentence direct answer to the query, in bold, before any heading.
  Write it so it stands alone if someone quotes only that paragraph.
- 4-6 "## " H2 sections. Include at least one markdown table.
- Each H2 must be a question or a specific claim a person would search, and the
  first sentence under it must answer that heading outright. Do not build up to
  the answer; lead with it, then justify it.
- Include at least two concrete, self-contained facts — a number, a threshold, a
  worked example with real figures, or a named legal requirement. Facts that
  survive being lifted out of context are what get quoted; vague advice is not.
- Where you state a figure, name what it applies to (venue size, country, year)
  in the same sentence, so the sentence cannot be misread on its own.
- Write for an international audience (US, UK, Ireland and beyond). Where something is legally region-specific, say that rules vary and to check local requirements rather than stating a figure that may be stale. It is currently ${year}.
- Mention Rotahr once or twice, as a tool, in passing. Never a sales pitch.
- Clean Markdown only, no HTML, no H1 inside the body (the title is the H1).
- Every markdown link must point at a real absolute URL or a real /blog/... path. NEVER write a placeholder link like [Read more](#) — if you have no URL, use plain text.
- "faq" is required and must contain 3-6 real questions with 2-4 sentence answers. Never return it empty.
${questions.length ? `- Answer these real related searches in the FAQ:\n${questions.map((q) => `  - ${q}`).join("\n")}` : ""}

Return ONLY JSON, no code fences:
{
 "title": "...",
 "metaTitle": "under 60 chars, ends with | Rotahr",
 "metaDesc": "under 155 chars, includes the query, gives a reason to click",
 "excerpt": "one or two sentences, under 200 chars",
 "category": "one of: ${CATEGORIES.join("|")}",
 "tags": "comma,separated,5,max",
 "content": "the full markdown article",
 "faq": [{"q":"question","a":"2-4 sentence answer"}]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8000,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content || "";
  try {
    const a = JSON.parse(raw) as Article;
    if (!a.title || !a.content) return null;
    if (!CATEGORIES.includes(a.category)) a.category = "management";
    a.faq = Array.isArray(a.faq)
      ? a.faq.filter((f) => f?.q && f?.a).slice(0, 6)
      : [];

    // The model drops the FAQ field often enough to matter, and the FAQ is what
    // earns the FAQPage schema. Ask once more, for just that piece.
    if (a.faq.length === 0) {
      a.faq = await faqFor(keyword, a.content, questions);
    }

    a.content = stripPlaceholderLinks(a.content);

    // A factual error about our own pricing is not a style problem. Left in, it
    // gets indexed, quoted by AI assistants as fact, and read by someone
    // deciding whether to buy — so it blocks publication rather than being
    // logged and shipped. The keyword goes back in the queue for another run.
    // The FAQ is checked with the body, not after it. The first live version of
    // this guard only read a.content, and an invented "$2 per user per month for
    // tools like Rotahr" shipped inside the FAQ block — which is the part
    // Google lifts into a rich result, so it was the worst possible place to
    // miss it.
    const problems = checkRotahrFacts(factsSurface(a.content, a.faq));
    if (problems.length) {
      console.error(
        `[seo] REFUSING "${keyword}" — invented facts about Rotahr:\n  ${problems.join("\n  ")}`,
      );
      return null;
    }

    a.content = await ensureDepth(keyword, a.content, intent);
    return a;
  } catch (err) {
    console.error("[seo] article JSON parse failed", err, raw.slice(0, 300));
    return null;
  }
}

export async function publishNextArticle(): Promise<
  | { published: false; reason: string }
  | { published: true; slug: string; keyword: string; title: string }
> {
  // Highest-scoring keyword we haven't written yet — skipping anything we've
  // effectively already covered. Autocomplete throws up whole families of
  // near-identical queries ("food cost percentage pricing" /
  // "...pricing method" / "...method for menu pricing"); writing all three
  // splits their own ranking signals and reads as thin content, so the first
  // one wins the article and the rest get marked as covered by it.
  const covered = await prisma.blogPost.findMany({
    where: { published: true, keyword: { not: null } },
    select: { keyword: true, slug: true },
  });

  const shortlist = await prisma.seoKeyword.findMany({
    where: { status: { in: ["new", "queued"] } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    take: 60,
  });

  let candidate: (typeof shortlist)[number] | null = null;
  for (const row of shortlist) {
    const dupe = covered.find(
      (c: { keyword: string | null; slug: string }) =>
        c.keyword && similarity(c.keyword, row.keyword) >= 0.7,
    );
    if (dupe) {
      await prisma.seoKeyword.update({
        where: { id: row.id },
        data: { status: "skipped", note: `covered by /blog/${dupe.slug}` },
      });
      continue;
    }
    candidate = row;
    break;
  }

  if (!candidate) {
    await log("publish", false, "keyword queue empty");
    return {
      published: false,
      reason: "Keyword queue is empty — run the keyword harvest.",
    };
  }

  const questions = await questionsFor(candidate.keyword).catch(() => []);
  const article = await writeArticle(
    candidate.keyword,
    candidate.cluster,
    candidate.intent,
    questions,
  );

  if (!article) {
    await prisma.seoKeyword.update({
      where: { id: candidate.id },
      data: { status: "skipped", note: "generation failed" },
    });
    await log("publish", false, `generation failed for "${candidate.keyword}"`);
    return {
      published: false,
      reason: "Article generation failed — keyword skipped.",
    };
  }

  // Slug collisions happen when two queries produce the same title.
  let slug = slugify(article.title);
  if (await prisma.blogPost.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const sameCategory = await prisma.blogPost.findMany({
    where: { published: true, category: article.category },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { slug: true, title: true },
  });
  const fallback =
    sameCategory.length >= 2
      ? []
      : await prisma.blogPost.findMany({
          where: { published: true },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { slug: true, title: true },
        });

  const content = insertInternalLinks(
    article.content,
    [...sameCategory, ...fallback].slice(0, 3),
  );
  const coverImage = await generateCoverImage(
    article.title,
    article.category,
  ).catch(() => null);

  const post = await prisma.blogPost.create({
    data: {
      slug,
      title: article.title,
      excerpt: article.excerpt.slice(0, 300),
      content,
      category: article.category,
      tags: article.tags,
      metaTitle: article.metaTitle.slice(0, 70),
      metaDesc: article.metaDesc.slice(0, 165),
      coverImage: coverImage ?? undefined,
      published: true,
      keyword: candidate.keyword,
      faq: article.faq.length ? JSON.stringify(article.faq) : undefined,
      wordCount: content.split(/\s+/).length,
    },
  });

  await prisma.seoKeyword.update({
    where: { id: candidate.id },
    data: { status: "written", postId: post.id, writtenAt: new Date() },
  });

  const ping = await submitToIndexNow([`${SITE}/blog/${slug}`, `${SITE}/blog`]);
  await log(
    "publish",
    true,
    `"${candidate.keyword}" -> /blog/${slug} (${ping})`,
  );

  return {
    published: true,
    slug,
    keyword: candidate.keyword,
    title: post.title,
  };
}

// ---------------------------------------------------------------------------
// 3. Refresh what nearly ranks
// ---------------------------------------------------------------------------

/**
 * Take the thinnest published article and bring it up to a competitive length.
 *
 * This is the fallback when Search Console has no striking-distance data to act
 * on. There are 61 published articles averaging around 700 words; every one of
 * them is too short to compete for the query it targets. Fixing an existing URL
 * that Google has already crawled is strictly better than adding a 62nd thin
 * page, because the page already has indexing history to build on.
 */
async function thickenThinnestPost(): Promise<{
  refreshed: true;
  slug: string;
  addedFor: string[];
} | null> {
  const threeWeeksAgo = new Date(Date.now() - 21 * 24 * 3600 * 1000);

  const thin = await prisma.blogPost.findFirst({
    where: {
      published: true,
      // Thinnest first, but never the same page twice in three weeks.
      AND: [
        { OR: [{ wordCount: { lt: MIN_WORDS } }, { wordCount: null }] },
        { OR: [{ refreshedAt: null }, { refreshedAt: { lt: threeWeeksAgo } }] },
      ],
    },
    orderBy: [{ wordCount: "asc" }, { createdAt: "asc" }],
  });
  if (!thin) return null;

  return thickenPost(thin);
}

export async function thickenPost(post: {
  id: string;
  slug: string;
  title: string;
  content: string;
  keyword: string | null;
  category: string;
}): Promise<{ refreshed: true; slug: string; addedFor: string[] } | null> {
  const before = countWords(post.content);
  const expanded = await ensureDepth(
    post.keyword || post.title,
    post.content,
    post.category === "management" ? "commercial" : "informational",
  );
  const after = countWords(expanded);
  if (after <= before * 1.15) return null;

  await prisma.blogPost.update({
    where: { id: post.id },
    data: {
      content: expanded,
      wordCount: after,
      refreshedAt: new Date(),
      refreshCount: { increment: 1 },
    },
  });

  const ping = await submitToIndexNow([`${SITE}/blog/${post.slug}`]);
  await log(
    "refresh",
    true,
    `/blog/${post.slug} thickened ${before} -> ${after} words (${ping})`,
  );
  return {
    refreshed: true,
    slug: post.slug,
    addedFor: [`length ${before} -> ${after}`],
  };
}

export async function refreshDecaying(): Promise<
  | { refreshed: false; reason: string }
  | { refreshed: true; slug: string; addedFor: string[] }
> {
  // Thickening a thin page needs no ranking data at all, so a missing Search
  // Console connection must not gate it — that gate is why this job returned
  // nothing five weeks running.
  if (!gscConfigured()) {
    const thickened = await thickenThinnestPost();
    if (thickened) return thickened;
    await log("refresh", false, "GSC not configured, no thin posts left");
    return {
      refreshed: false,
      reason:
        "Search Console isn't connected and every article is above the length floor.",
    };
  }

  const striking = await strikingDistance(28, 20);
  if (striking.length === 0) {
    // "Nothing in striking distance" has been the answer five weeks running,
    // and the job just burned its slot each time. Nothing ranks 4-20 because
    // the back catalogue is too thin to rank at all, so when there's no ranking
    // signal to act on, go fix the thinnest page instead of returning nothing.
    const thickened = await thickenThinnestPost();
    if (thickened) return thickened;
    await log(
      "refresh",
      false,
      "nothing in striking distance, no thin posts left",
    );
    return {
      refreshed: false,
      reason:
        "Nothing ranks 4-20 yet and every article is above the length floor.",
    };
  }

  // Group the opportunities by the page that owns them, biggest first.
  const byPage = new Map<string, typeof striking>();
  for (const row of striking) {
    const list = byPage.get(row.page) ?? [];
    list.push(row);
    byPage.set(row.page, list);
  }

  const ranked = [...byPage.entries()]
    .map(([page, rows]) => ({
      page,
      rows,
      impressions: rows.reduce((n, r) => n + r.impressions, 0),
    }))
    .sort((a, b) => b.impressions - a.impressions);

  for (const target of ranked) {
    const slug = target.page
      .replace(/^https?:\/\/[^/]+/, "")
      .replace(/^\/blog\//, "")
      .replace(/\/$/, "");
    const post = await prisma.blogPost.findUnique({ where: { slug } });
    if (!post) continue;

    // Don't churn the same page every week.
    if (
      post.refreshedAt &&
      Date.now() - post.refreshedAt.getTime() < 21 * 24 * 3600 * 1000
    )
      continue;

    const queries = target.rows.slice(0, 6);
    const prompt = `Below is a published article from Rotahr's blog. Search Console shows it already ranks at position 4-20 for these queries, meaning Google thinks it is nearly the right answer:

${queries.map((q) => `- "${q.keyword}" — position ${q.position.toFixed(1)}, ${q.impressions} impressions, ${q.clicks} clicks`).join("\n")}

Improve the article so it fully and obviously answers those queries. Rules:
- Keep everything that already works. This is an expansion and sharpening pass, not a rewrite.
- Add a dedicated "## " section for each query above that isn't properly covered, using the searcher's own wording in the heading.
- Keep the existing internal links (*Related: [...]* lines) and the closing Rotahr link exactly as they are.
- Add concrete specifics: numbers, worked examples, steps, a table. Vague text is why it isn't ranking first.
- Clean Markdown only, no H1.

Current title: ${post.title}

Current article:
${post.content}

Return ONLY JSON, no fences:
{"title":"keep or sharpen","metaDesc":"under 155 chars","content":"the full improved markdown","faq":[{"q":"...","a":"..."}]}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5000,
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    let parsed: {
      title?: string;
      metaDesc?: string;
      content?: string;
      faq?: { q: string; a: string }[];
    };
    try {
      parsed = JSON.parse(completion.choices[0].message.content || "");
    } catch {
      continue;
    }
    if (!parsed.content || parsed.content.length < post.content.length * 0.8) {
      // Refusing a shorter "improvement" — that's a regression, not a refresh.
      continue;
    }

    // The refresh pass rewrites a live page, so it can introduce invented
    // pricing into an article that was previously clean. Skip the page rather
    // than overwrite good text with bad.
    const refreshProblems = checkRotahrFacts(
      factsSurface(parsed.content, parsed.faq),
    );
    if (refreshProblems.length) {
      console.error(
        `[seo] refresh invented facts about Rotahr on /blog/${post.slug} — skipping:\n  ${refreshProblems.join("\n  ")}`,
      );
      continue;
    }

    await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        title: parsed.title?.trim() || post.title,
        content: parsed.content,
        metaDesc: (parsed.metaDesc || post.metaDesc).slice(0, 165),
        faq: parsed.faq?.length
          ? JSON.stringify(parsed.faq.slice(0, 6))
          : post.faq,
        wordCount: parsed.content.split(/\s+/).length,
        refreshedAt: new Date(),
        refreshCount: { increment: 1 },
      },
    });

    const ping = await submitToIndexNow([`${SITE}/blog/${post.slug}`]);
    const addedFor = queries.map((q) => q.keyword);
    await log(
      "refresh",
      true,
      `/blog/${post.slug} for [${addedFor.join(", ")}] (${ping})`,
    );

    return { refreshed: true, slug: post.slug, addedFor };
  }

  await log("refresh", false, "all striking-distance pages refreshed recently");
  return {
    refreshed: false,
    reason: "Every striking-distance page was refreshed in the last 3 weeks.",
  };
}

// ---------------------------------------------------------------------------
// 4. Daily metrics snapshot — the history behind the trend chart
// ---------------------------------------------------------------------------

/**
 * Pull day-by-day site totals from Search Console into SeoMetric.
 *
 * Why store a copy of data Google already has: Search Console's UI can't show
 * "how did we do since the autopilot started", it rolls off after 16 months,
 * and hitting the API on every dashboard load would be slow and rate-limited.
 * A local copy makes the trend instant and permanent.
 *
 * Rows are keyed [date, page, query] and written with page="" / query="" to
 * mean "whole site". Re-running is safe — it upserts, so a backfill and the
 * daily top-up use exactly the same path.
 *
 * @param days lookback. Defaults to 90 so the very first run has real history
 *             instead of a chart with one dot on it.
 */
export async function snapshotMetrics(days = 90): Promise<{
  ok: boolean;
  days?: number;
  clicks?: number;
  impressions?: number;
  reason?: string;
}> {
  if (!gscConfigured()) {
    await log("metrics", false, "Search Console not configured");
    return {
      ok: false,
      reason: "Search Console isn't connected, so there's nothing to snapshot.",
    };
  }

  let rows;
  try {
    rows = await dailyPerformance(days);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await log("metrics", false, msg);
    return { ok: false, reason: msg };
  }

  if (!rows.length) {
    await log(
      "metrics",
      true,
      "no rows returned (site may have no impressions yet)",
    );
    return { ok: true, days: 0, clicks: 0, impressions: 0 };
  }

  // Sequential on purpose: ~90 upserts is fine, and firing them all at once
  // exhausts the Neon connection pool on a serverless function.
  for (const r of rows) {
    const date = new Date(`${r.date}T00:00:00.000Z`);
    const data = {
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    };
    await prisma.seoMetric.upsert({
      where: { date_page_query: { date, page: "", query: "" } },
      create: { date, page: "", query: "", ...data },
      update: data,
    });
  }

  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  await log(
    "metrics",
    true,
    `${rows.length} days snapshotted — ${clicks} clicks, ${impressions} impressions`,
  );

  return { ok: true, days: rows.length, clicks, impressions };
}
