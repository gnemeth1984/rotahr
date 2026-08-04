/**
 * lib/seo/ai-visibility.ts — are AI assistants recommending Rotahr?
 *
 * Buyers increasingly ask ChatGPT or Perplexity "best rota app for a small
 * pub" instead of Googling it. That answer is a single shortlist of 3-8 names
 * with no page two, so being absent from it is worse than ranking #11 on
 * Google. Nobody in hospitality software is measuring this yet.
 *
 * What this does: ask a fixed set of real buying questions on a schedule,
 * record the verbatim answer, and detect whether Rotahr was named, where in
 * the list, and who was named instead.
 *
 * Two honest limits, stated because a dashboard that hides them is worse than
 * no dashboard:
 *
 *  1. These are API calls, not the consumer ChatGPT app. Answers correlate
 *     with what a user sees but are not identical.
 *  2. A plain model answers from training data, so a young brand will be
 *     absent for months. The web-search-backed model (Perplexity `sonar`) is
 *     the leading indicator — it reads live pages, so it responds to content
 *     within days, and it is what actually reflects AI search.
 *
 * Cost is a rounding error: ~20 prompts × 2 models × weekly ≈ cents.
 */

import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Competitors we want to know about when we lose. Lowercase, matched on word boundaries. */
const COMPETITOR_NAMES = [
  "bizimply",
  "rotacloud",
  "deputy",
  "planday",
  "7shifts",
  "sling",
  "rotaready",
  "when i work",
  "homebase",
  "connecteam",
  "papershift",
  "shiftbase",
  "quinyx",
  "fourth",
  "harri",
  "tanda",
  "humanity",
  "wheniwork",
  "nowsta",
  "push operations",
];

/**
 * The questions worth winning.
 *
 * All commercial intent — someone asking these is shopping, not studying. Kept
 * as a seed list in code so the set is version-controlled and comparable over
 * time; changing a prompt breaks its own history, so add rather than edit.
 */
export const SEED_PROMPTS: { prompt: string; cluster: string; region: string }[] = [
  // Core category, by venue type
  { prompt: "What's the best staff scheduling app for a small restaurant?", cluster: "rota software", region: "general" },
  { prompt: "Best rota software for a small pub or bar?", cluster: "rota software", region: "general" },
  { prompt: "What software should a small independent cafe use for staff rotas?", cluster: "rota software", region: "general" },
  { prompt: "Best employee scheduling software for hotels?", cluster: "rota software", region: "general" },
  { prompt: "What is the best rota app for a restaurant with 10 employees?", cluster: "rota software", region: "general" },

  // Region-flavoured — where Rotahr is strongest and most differentiated
  { prompt: "Best staff rota software for Irish restaurants and pubs?", cluster: "rota software", region: "ie" },
  { prompt: "What rota software do UK hospitality businesses use?", cluster: "rota software", region: "uk" },
  { prompt: "Best restaurant employee scheduling software in the US for a single location?", cluster: "rota software", region: "us" },

  // Price-led — Rotahr's flat pricing is the actual differentiator
  { prompt: "What's the cheapest staff scheduling software for a small hospitality business?", cluster: "pricing", region: "general" },
  { prompt: "Is there rota software with flat monthly pricing instead of per-employee pricing?", cluster: "pricing", region: "general" },
  { prompt: "How much should a small restaurant expect to pay for scheduling software?", cluster: "pricing", region: "general" },

  // All-in-one — the multi-module story
  { prompt: "Is there one app that handles restaurant staff scheduling, bookings and payroll together?", cluster: "all-in-one", region: "general" },
  { prompt: "What software combines rota scheduling and HACCP food safety records?", cluster: "haccp", region: "general" },
  { prompt: "Best digital HACCP and food safety compliance app for restaurants?", cluster: "haccp", region: "general" },
  { prompt: "Is there an app to replace paper food safety temperature logs in a kitchen?", cluster: "haccp", region: "general" },

  // Adjacent jobs
  { prompt: "Best app for restaurant table bookings and reservations for an independent venue?", cluster: "bookings", region: "general" },
  { prompt: "What's the best way for a restaurant to track staff clock in and clock out?", cluster: "time tracking", region: "general" },
  { prompt: "Best software for tracking food cost and recipe costing in a restaurant?", cluster: "costing", region: "general" },
  { prompt: "How can a restaurant track staff break entitlements automatically?", cluster: "compliance", region: "general" },

  // Competitor-displacement — highest intent of all
  { prompt: "What are the best alternatives to Deputy for a small restaurant?", cluster: "alternatives", region: "general" },
  { prompt: "What are good alternatives to RotaCloud?", cluster: "alternatives", region: "general" },
  { prompt: "What are the best alternatives to Bizimply for a small Irish venue?", cluster: "alternatives", region: "ie" },
  { prompt: "Alternatives to 7shifts for an independent restaurant?", cluster: "alternatives", region: "general" },
];

export type ProbeResult = {
  model: string;
  answer: string;
  mentioned: boolean;
  rank: number | null;
  cited: boolean;
  competitors: string[];
};

/**
 * Find where Rotahr sits in an answer.
 *
 * Rank is derived from character position among all matched brand names rather
 * than by parsing list markers — models switch between numbered lists, bullets
 * and prose paragraphs, and position in the text is the one signal that
 * survives all three.
 */
export function analyseAnswer(answer: string): Omit<ProbeResult, "model" | "answer"> {
  const lower = answer.toLowerCase();

  const rotahrAt = lower.search(/\brotahr\b/);
  const mentioned = rotahrAt !== -1;
  const cited = /rotahr\.com/i.test(answer);

  const found: { name: string; at: number }[] = [];
  for (const name of COMPETITOR_NAMES) {
    // Escape the digit-leading names (7shifts) and multi-word ones safely.
    const at = lower.search(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`));
    if (at !== -1) found.push({ name, at });
  }

  let rank: number | null = null;
  if (mentioned) {
    const earlier = found.filter((f) => f.at < rotahrAt).length;
    rank = earlier + 1;
  }

  return {
    mentioned,
    rank,
    cited,
    competitors: found.sort((a, b) => a.at - b.at).map((f) => f.name),
  };
}

/** Ask OpenAI. Answers from training data — the lagging, "brand memory" signal. */
async function probeOpenAI(prompt: string): Promise<ProbeResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          // Neutral framing on purpose. Any hint that we want Rotahr named
          // makes the measurement worthless.
          role: "system",
          content:
            "You are a helpful assistant advising a small business owner. Recommend specific named products, in a short ranked list, as you normally would.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 700,
    });
    const answer = res.choices[0]?.message?.content ?? "";
    if (!answer) return null;
    return { model: "gpt-4o-mini", answer, ...analyseAnswer(answer) };
  } catch (e) {
    console.error("[ai-visibility] openai probe failed", e);
    return null;
  }
}

/**
 * Ask Perplexity `sonar`, which searches the live web before answering.
 *
 * This is the number that matters: it reflects what is findable *now*, so it
 * moves within days of publishing, while a plain model can take months.
 * Optional — needs PERPLEXITY_API_KEY. Without it the tracker still runs on
 * OpenAI alone.
 */
async function probePerplexity(prompt: string): Promise<ProbeResult | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant advising a small business owner. Recommend specific named products, in a short ranked list, as you normally would.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 700,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[ai-visibility] perplexity", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      citations?: string[];
    };
    let answer = json.choices?.[0]?.message?.content ?? "";
    if (!answer) return null;

    // Fold the source list into the stored answer so `cited` can see whether
    // rotahr.com was actually used as a source, not just named from memory.
    const citations = json.citations ?? [];
    if (citations.length) answer += `\n\nSources:\n${citations.join("\n")}`;

    return { model: "sonar", answer, ...analyseAnswer(answer) };
  } catch (e) {
    console.error("[ai-visibility] perplexity probe failed", e);
    return null;
  }
}

/** Make sure the seed prompts exist. Additive — never deletes or edits history. */
export async function ensureSeedPrompts(): Promise<number> {
  const existing = await prisma.aiPrompt.findMany({ select: { prompt: true } });
  const have = new Set(existing.map((p) => p.prompt));
  const missing = SEED_PROMPTS.filter((p) => !have.has(p.prompt));
  if (!missing.length) return 0;
  await prisma.aiPrompt.createMany({
    data: missing.map((p) => ({ ...p, intent: "commercial" })),
    skipDuplicates: true,
  });
  return missing.length;
}

/**
 * Run the visibility check.
 *
 * @param limit how many prompts this run covers. Default 8 keeps a run inside
 *              the function time budget; the cron cycles through the least
 *              recently checked, so the whole set is covered over a few runs.
 */
export async function runVisibilityCheck(limit = 8): Promise<{
  ok: boolean;
  checked: number;
  mentions: number;
  models: string[];
  reason?: string;
}> {
  if (!process.env.OPENAI_API_KEY && !process.env.PERPLEXITY_API_KEY) {
    return { ok: false, checked: 0, mentions: 0, models: [], reason: "No AI provider key set." };
  }

  await ensureSeedPrompts();

  // Least-recently-checked first, so every prompt gets covered in rotation
  // rather than the same eight being re-asked forever.
  const prompts = await prisma.aiPrompt.findMany({
    where: { active: true },
    include: { checks: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });

  const ordered = prompts
    .sort((a, b) => {
      const at = a.checks[0]?.createdAt?.getTime() ?? 0;
      const bt = b.checks[0]?.createdAt?.getTime() ?? 0;
      return at - bt;
    })
    .slice(0, limit);

  let checked = 0;
  let mentions = 0;
  const models = new Set<string>();

  for (const p of ordered) {
    // Both providers in parallel per prompt, but prompts sequentially — keeps
    // us clear of rate limits without dragging the run out.
    const results = (await Promise.all([probeOpenAI(p.prompt), probePerplexity(p.prompt)])).filter(
      (r): r is ProbeResult => r !== null
    );

    for (const r of results) {
      await prisma.aiVisibility.create({
        data: {
          promptId: p.id,
          model: r.model,
          answer: r.answer.slice(0, 20000),
          mentioned: r.mentioned,
          rank: r.rank,
          cited: r.cited,
          competitors: r.competitors.join(","),
        },
      });
      checked++;
      models.add(r.model);
      if (r.mentioned) mentions++;
    }
  }

  await prisma.seoRun
    .create({
      data: {
        task: "ai-visibility",
        ok: true,
        detail: `${ordered.length} prompts, ${checked} answers, Rotahr named in ${mentions} (${[...models].join(" + ")})`,
      },
    })
    .catch(() => {});

  return { ok: true, checked, mentions, models: [...models] };
}

/** Dashboard payload: current standing, trend, and who's beating us. */
export async function visibilitySummary() {
  const [prompts, recent] = await Promise.all([
    prisma.aiPrompt.count({ where: { active: true } }),
    prisma.aiVisibility.findMany({
      orderBy: { createdAt: "desc" },
      take: 600,
      include: { prompt: { select: { prompt: true, cluster: true, region: true } } },
    }),
  ]);

  if (recent.length === 0) {
    return { configured: !!process.env.OPENAI_API_KEY, prompts, checks: 0, byModel: [], latest: [], competitors: [], trend: [] };
  }

  // Latest answer per prompt+model — the current standing.
  const latestMap = new Map<string, (typeof recent)[number]>();
  for (const r of recent) {
    const k = `${r.promptId}::${r.model}`;
    if (!latestMap.has(k)) latestMap.set(k, r);
  }
  const latest = [...latestMap.values()];

  const byModel = [...new Set(latest.map((l) => l.model))].map((model) => {
    const rows = latest.filter((l) => l.model === model);
    const named = rows.filter((r) => r.mentioned);
    return {
      model,
      total: rows.length,
      mentioned: named.length,
      sharePct: rows.length ? (named.length / rows.length) * 100 : 0,
      avgRank: named.length
        ? named.reduce((s, r) => s + (r.rank ?? 0), 0) / named.length
        : null,
      cited: rows.filter((r) => r.cited).length,
    };
  });

  // Who gets named when we don't. This is the competitive set that matters
  // now — not whoever ranks on Google.
  const counts = new Map<string, { total: number; beatUs: number }>();
  for (const r of latest) {
    for (const c of r.competitors.split(",").filter(Boolean)) {
      const e = counts.get(c) ?? { total: 0, beatUs: 0 };
      e.total++;
      if (!r.mentioned) e.beatUs++;
      counts.set(c, e);
    }
  }
  const competitors = [...counts.entries()]
    .map(([name, v]) => ({ name, ...v, sharePct: (v.total / latest.length) * 100 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  // Share-of-voice by day, so improvement is visible over time.
  const days = new Map<string, { named: number; total: number }>();
  for (const r of recent) {
    const d = r.createdAt.toISOString().slice(0, 10);
    const e = days.get(d) ?? { named: 0, total: 0 };
    e.total++;
    if (r.mentioned) e.named++;
    days.set(d, e);
  }
  const trend = [...days.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, sharePct: (v.named / v.total) * 100, total: v.total }));

  return {
    configured: !!process.env.OPENAI_API_KEY || !!process.env.PERPLEXITY_API_KEY,
    perplexity: !!process.env.PERPLEXITY_API_KEY,
    prompts,
    checks: recent.length,
    byModel,
    competitors,
    trend,
    latest: latest
      .sort((a, b) => Number(b.mentioned) - Number(a.mentioned) || (a.rank ?? 99) - (b.rank ?? 99))
      .slice(0, 40)
      .map((l) => ({
        id: l.id,
        prompt: l.prompt.prompt,
        cluster: l.prompt.cluster,
        region: l.prompt.region,
        model: l.model,
        mentioned: l.mentioned,
        rank: l.rank,
        cited: l.cited,
        competitors: l.competitors.split(",").filter(Boolean),
        answer: l.answer,
        createdAt: l.createdAt,
      })),
  };
}
