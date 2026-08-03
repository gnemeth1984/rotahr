/**
 * lib/seo/keywords.ts — free keyword research.
 *
 * The paid tools sell "keyword research" as if it needed a licensed database.
 * It doesn't. Two free sources cover the job:
 *
 *  1. Google Suggest (suggestqueries.google.com) — the autocomplete list. No
 *     key, no quota worth worrying about. Every suggestion is a query real
 *     people type often enough for Google to bother suggesting it, which is a
 *     better relevance signal than a scraped monthly volume number.
 *  2. Search Console (lib/seo/gsc.ts) — queries the site ALREADY shows up for.
 *     Anything sitting at position 5-20 is the cheapest traffic on earth: one
 *     properly targeted article instead of hoping to rank from nothing.
 *
 * We deliberately do NOT invent volume/difficulty numbers. A made-up "KD 34"
 * looks authoritative and means nothing. Priority is scored from things we can
 * actually observe.
 */

const SUGGEST_ENDPOINT = "https://suggestqueries.google.com/complete/search";

/**
 * Seed terms: the topical map. Each seed is a cluster — the harvester fans each
 * one out into dozens of long-tail children, which is what actually ranks.
 */
export const SEED_CLUSTERS: { cluster: string; seeds: string[]; intent: Intent }[] = [
  {
    cluster: "rota & scheduling software",
    intent: "commercial",
    seeds: [
      "staff rota software",
      "restaurant scheduling software",
      "employee scheduling app",
      "rota app for restaurants",
      "hotel staff scheduling software",
      "pub rota software",
      "shift planning software",
    ],
  },
  {
    cluster: "rota how-to",
    intent: "informational",
    seeds: [
      "how to make a staff rota",
      "how to schedule restaurant staff",
      "rota planning tips",
      "shift pattern examples",
      "how to cover a last minute shift",
    ],
  },
  {
    cluster: "labour cost & profit",
    intent: "informational",
    seeds: [
      "restaurant labour cost percentage",
      "how to reduce labour costs restaurant",
      "food cost percentage",
      "menu engineering",
      "restaurant profit margin",
      "gross profit on drinks",
    ],
  },
  {
    cluster: "food safety & HACCP",
    intent: "informational",
    seeds: [
      "haccp checklist",
      "fridge temperature record sheet",
      "food safety records restaurant",
      "haccp software",
      "cleaning schedule template restaurant",
    ],
  },
  {
    cluster: "payroll & tips",
    intent: "informational",
    seeds: [
      "restaurant payroll",
      "how does tronc work",
      "tip pooling rules",
      "hospitality payroll software",
      "overtime rules restaurant staff",
    ],
  },
  {
    cluster: "bookings & covers",
    intent: "commercial",
    seeds: [
      "restaurant booking system",
      "table management software",
      "reduce no show reservations",
      "restaurant floor plan software",
    ],
  },
  {
    cluster: "staff & HR",
    intent: "informational",
    seeds: [
      "restaurant staff turnover",
      "how to retain chefs",
      "hospitality staff training",
      "onboarding restaurant staff",
      "kitchen staff burnout",
    ],
  },
  {
    cluster: "stock & suppliers",
    intent: "informational",
    seeds: [
      "restaurant stock control",
      "how to do a stock take restaurant",
      "recipe costing",
      "reduce food waste restaurant",
    ],
  },
  {
    cluster: "competitor & alternatives",
    intent: "commercial",
    seeds: [
      "deputy alternative",
      "planday alternative",
      "7shifts alternative",
      "rotacloud alternative",
      "best restaurant management software",
    ],
  },
];

export type Intent = "informational" | "commercial" | "transactional" | "local";

/**
 * Modifiers appended to each seed before hitting autocomplete. Google returns a
 * different list per prefix, so "X for" and "X vs" surface queries that a bare
 * "X" never shows. This is the whole trick behind paid "keyword expansion".
 */
const MODIFIERS = [
  "",
  "for",
  "best",
  "cheap",
  "free",
  "how to",
  "what is",
  "vs",
  "cost",
  "template",
  "uk",
  "us",
];

export type Suggestion = { keyword: string; cluster: string; intent: Intent; source: "suggest" };

/** One autocomplete call. Returns [] on any failure — never throw a harvest. */
export async function googleSuggest(query: string, region = "ie"): Promise<string[]> {
  const url = `${SUGGEST_ENDPOINT}?client=firefox&hl=en&gl=${region}&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RotahrSEO/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    // client=firefox returns ["query", ["suggestion", ...]]
    const json = (await res.json()) as [string, string[]];
    return Array.isArray(json?.[1]) ? json[1] : [];
  } catch {
    return [];
  }
}

/** Guess intent from the wording. Crude, but it only steers priority. */
export function classifyIntent(keyword: string, fallback: Intent): Intent {
  const k = keyword.toLowerCase();
  if (/\bnear me\b|\bin (london|dublin|manchester|new york)\b/.test(k)) return "local";
  if (/\b(pricing|price|buy|demo|free trial|sign up)\b/.test(k)) return "transactional";
  if (/\b(best|top|software|app|system|alternative|vs|compare|cheapest|review)\b/.test(k))
    return "commercial";
  if (/\b(how|what|why|when|guide|template|example|checklist)\b/.test(k)) return "informational";
  return fallback;
}

/**
 * Score a keyword. Higher = write it sooner.
 *
 * Weighting reflects where the cheap wins are, in order:
 *  - striking distance in Search Console (already ranking 5-20) beats everything
 *  - real impressions with no clicks = demand we're already visible for
 *  - commercial/transactional intent converts, so it outranks pure curiosity
 *  - long-tail (4+ words) is winnable; two-word head terms are not, yet
 */
export function scoreKeyword(k: {
  keyword: string;
  intent: string;
  impressions?: number;
  clicks?: number;
  position?: number | null;
}): number {
  let score = 0;

  const words = k.keyword.trim().split(/\s+/).length;
  if (words >= 5) score += 25;
  else if (words === 4) score += 20;
  else if (words === 3) score += 12;
  else score += 2; // head term — keep it in the map, don't lead with it

  score += { transactional: 30, commercial: 24, local: 18, informational: 10 }[k.intent] ?? 10;

  const pos = k.position ?? null;
  if (pos !== null && pos > 0) {
    // Striking distance: page 1 bottom / page 2. A rewrite here moves money.
    if (pos >= 4 && pos <= 20) score += 45;
    else if (pos > 20 && pos <= 50) score += 20;
    else if (pos < 4) score -= 20; // already winning, leave it alone
  }

  const imp = k.impressions ?? 0;
  if (imp > 0) score += Math.min(40, Math.round(Math.log2(imp + 1) * 6));
  if (imp > 50 && (k.clicks ?? 0) === 0) score += 15; // seen, never clicked

  return score;
}

const STOP_PATTERNS = [
  /\bjob(s)?\b/i, // job seekers, not buyers
  /\bsalary\b/i,
  /\bcv\b/i,
  /\bcourse(s)?\b/i,
  /\bpdf\b/i,
  /\breddit\b/i,
  /\bcrack|torrent|nulled\b/i,
];

/**
 * Autocomplete happily hands back "restaurant management software in nepal".
 * Those queries are real, but Rotahr bills in EUR/GBP/USD/CAD/AUD and supports
 * those markets — an article chasing Kolkata traffic costs money to write and
 * can never convert. Anything naming a market we don't serve gets dropped.
 */
const OFF_MARKET = new RegExp(
  "\\b(" +
    [
      "india", "indian", "nepal", "bangladesh", "pakistan", "sri lanka", "philippines",
      "indonesia", "malaysia", "singapore", "vietnam", "thailand", "china", "japan",
      "nigeria", "kenya", "ghana", "zambia", "zimbabwe", "south africa", "egypt",
      "dubai", "uae", "saudi", "qatar", "kuwait", "oman", "bahrain",
      "brazil", "mexico", "argentina", "chile", "colombia", "peru",
      "kolkata", "mumbai", "delhi", "bangalore", "bengaluru", "chennai", "hyderabad",
      "pune", "ahmedabad", "karachi", "lahore", "dhaka", "kathmandu", "manila",
      "jakarta", "bangkok", "lagos", "nairobi", "cairo", "istanbul", "turkey",
      "russia", "ukraine", "poland", "romania",
    ].join("|") +
    ")\\b",
  "i"
);

/** Drop queries that can never convert for a scheduling SaaS. */
export function isUsable(keyword: string): boolean {
  const k = keyword.trim();
  if (k.length < 8 || k.length > 90) return false;
  if (!/^[a-z0-9 '&/.+-]+$/i.test(k)) return false;
  if (OFF_MARKET.test(k)) return false;
  return !STOP_PATTERNS.some((re) => re.test(k));
}

/**
 * Fan every seed out through the modifier list and collect unique suggestions.
 *
 * Seeds × modifiers × regions is ~1,600 autocomplete calls, which is far too
 * many to do one at a time inside a serverless function. So: a small worker
 * pool, and a hard time budget that returns whatever was found so far rather
 * than letting the function get killed mid-write.
 */
export async function harvestSuggestions(
  clusters = SEED_CLUSTERS,
  regions: string[] = ["ie", "gb", "us"],
  opts: { concurrency?: number; budgetMs?: number } = {}
): Promise<Suggestion[]> {
  const concurrency = opts.concurrency ?? 6;
  const budgetMs = opts.budgetMs ?? 180_000;
  const startedAt = Date.now();

  // Build the full job list up front so the pool is trivial.
  const jobs: { query: string; region: string; cluster: string; intent: Intent }[] = [];
  for (const { cluster, seeds, intent } of clusters) {
    for (const seed of seeds) {
      for (const mod of MODIFIERS) {
        const query = !mod
          ? seed
          : ["for", "vs", "cost", "template", "uk", "us"].includes(mod)
          ? `${seed} ${mod}`
          : `${mod} ${seed}`;
        for (const region of regions) jobs.push({ query, region, cluster, intent });
      }
    }
  }

  const found = new Map<string, Suggestion>();
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length && Date.now() - startedAt < budgetMs) {
      const job = jobs[cursor++];
      const suggestions = await googleSuggest(job.query, job.region);
      for (const raw of suggestions) {
        const keyword = raw.trim().toLowerCase();
        if (!isUsable(keyword) || found.has(keyword)) continue;
        found.set(keyword, {
          keyword,
          cluster: job.cluster,
          intent: classifyIntent(keyword, job.intent),
          source: "suggest",
        });
      }
      // Be a good citizen — this endpoint is free and undocumented.
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return [...found.values()];
}

/**
 * "People also ask"-style question expansion for one keyword, used to build the
 * FAQ block on an article. Autocomplete with question prefixes gets us there
 * without scraping a SERP.
 */
export async function questionsFor(keyword: string, max = 6): Promise<string[]> {
  const prefixes = ["how", "what", "why", "when", "do", "is"];
  const out = new Set<string>();

  // A question is only useful if it's still about the same thing — autocomplete
  // drifts ("how does the company do its costing"), and an FAQ full of drift is
  // worse than no FAQ.
  const topic = new Set(
    keyword
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["what", "does", "with", "your", "best", "cost"].includes(w))
  );
  const onTopic = (q: string) => {
    const words = q.toLowerCase().split(/\s+/);
    return topic.size === 0 || words.some((w) => topic.has(w.replace(/[^a-z]/g, "")));
  };

  for (const p of prefixes) {
    const suggestions = await googleSuggest(`${p} ${keyword}`);
    for (const s of suggestions) {
      const q = s.trim();
      if (
        q.split(/\s+/).length >= 4 &&
        /^(how|what|why|when|do|does|is|are|can)\b/i.test(q) &&
        onTopic(q)
      ) {
        out.add(q.charAt(0).toUpperCase() + q.slice(1) + "?");
      }
      if (out.size >= max) break;
    }
    if (out.size >= max) break;
    await new Promise((r) => setTimeout(r, 120));
  }

  return [...out].slice(0, max);
}

/**
 * Token overlap between two queries, 0-1. Used to refuse writing a second
 * article for a query we've effectively already covered — five near-identical
 * posts split their own ranking signals and read as thin content.
 */
export function similarity(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !["for", "the", "and", "with", "your", "how", "what"].includes(w))
    );
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  A.forEach((w) => {
    if (B.has(w)) shared++;
  });
  return shared / Math.min(A.size, B.size);
}
