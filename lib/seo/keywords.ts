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
      // The AI-visibility tracker shows no competitor named at all for these —
      // not us, not Deputy, not 7shifts. Unowned ground with a shipped feature
      // behind it is the cheapest ranking available to us.
      "paperless haccp",
      "digital food safety app",
      "temperature log app kitchen",
      "replace paper temperature logs",
      "food safety management system restaurant",
      "haccp records for inspection",
      "allergen record keeping restaurant",
      "cooling and reheating records",
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
      "tips distribution app",
      "tronc scheme setup",
      "staff break entitlement rules",
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
      "table booking app for restaurants",
      "reservation software for small restaurant",
      "restaurant table plan software",
    ],
  },
  {
    // Rotahr's actual differentiator: one system instead of four. The models
    // named nobody for "what software combines rota and HACCP" — that is a
    // question only we can answer honestly.
    cluster: "all-in-one hospitality",
    intent: "commercial",
    seeds: [
      "all in one restaurant software",
      "software that combines rota and haccp",
      "restaurant scheduling and bookings in one app",
      "one app for rota payroll and bookings",
      "replace multiple restaurant apps",
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
      "recipe costing software",
      "food cost calculator restaurant",
      "kitchen inventory app",
      "dish cost per portion",
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
  "how to",
  "what is",
  "vs",
  "cost",
  "template",
  "uk",
  "us",
  // "free" is deliberately absent. It harvested a whole family of
  // "best free ... software" / "... free download" queries that isUsable() now
  // rejects anyway, because somebody searching for free software will not pay
  // €59/month. Every one of those was ~130 wasted autocomplete calls.
  "for restaurants",
  "for small",
  "app",
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
 * Territory where two things are true at once: Rotahr ships the feature, and
 * the AI-visibility tracker shows NO competitor is named in the answer — not
 * Deputy, not 7shifts, not When I Work. Nobody owns these questions, so a new
 * domain can take them. This is the opposite of "best scheduling software",
 * where the answer has been settled for a decade.
 */
const FEATURE_GAP: RegExp[] = [
  /\bhaccp\b/,
  /\bfood safety\b/,
  /\btemperature (log|record|check|sheet|monitoring)/,
  /\bpaper(less)?\b[^.]{0,30}\b(log|record|checklist)/,
  /\brecipe cost/,
  /\bfood cost/,
  /\bmenu engineering\b/,
  /\bgross profit\b/,
  /\bportion (cost|control)/,
  /\btronc\b/,
  /\btip (pool|out|distribution|split|share)/,
  /\bstock ?take\b/,
  /\bno[- ]show/,
  // "cap table management software" is startup equity, not restaurant tables —
  // it matched a bare /table (management)/ and scored 84.
  /(?<!\bcap )\btable (management|plan|booking)/,
  // NOT a bare /\bfloor plan\b/ — that matched a whole family of diagram-tool
  // queries ("restaurant floor plan maker ai", "smartdraw...") and pushed them
  // to the top of the queue. People searching those want drawing software.
  /\b(break entitlement|rest break)/,
  /\bclock (in|out)\b/,
  /\bcleaning schedule\b/,
  /\bdelivery (check|note)\b/,
  /\bcert(ification)?s? (expiry|tracker|tracking)/,
  /\ballergen\b/,
];

/** The market Rotahr actually sells to. */
const OUR_VERTICAL =
  /\b(restaurant|pub|bar|cafe|café|coffee shop|hotel|hospitality|kitchen|bistro|brasserie|takeaway|catering|caterer|chef|barista|waiter|waitress|food truck|gastropub|nightclub|diner|deli|bakery|brewery|venue)s?\b/;

/**
 * Venue types narrow enough that naming one is already a long-tail query.
 * "restaurant" and "hotel" are deliberately excluded — they are big contested
 * categories in their own right, so they belong in OUR_VERTICAL but not here.
 */
const NARROW_VENUE =
  /\b(pub|bar|cafe|café|coffee shop|bistro|brasserie|gastropub|food truck|takeaway|deli|bakery|brewery|nightclub|diner|caterer|catering)s?\b/;

/** Qualifiers that mean "a venue like mine", not "the market leader". */
const SMALLNESS =
  /\b(small|independent|single (location|site|venue)|one location|family[- ]run|family owned|boutique|micro|tiny|local)\b/;

/** A market we actually bill in — EUR, GBP, USD, CAD, AUD. */
const OUR_MARKET =
  /\b(ireland|irish|uk|united kingdom|england|scotland|wales|britain|british|us|usa|united states|america|american|canada|canadian|australia|australian|dublin|cork|galway|london|manchester|birmingham|glasgow|leeds|new york|chicago|texas|california|toronto|vancouver|sydney|melbourne)\b/;

/**
 * A generic category term: "<something> scheduling software", "rota app",
 * "management system". On its own, with no narrowing angle, every one of these
 * is defended by When I Work, Deputy, Homebase and 7shifts — companies with a
 * decade of domain authority and thousands of backlinks.
 */
const CATEGORY_TERM =
  /\b(scheduling|schedule|rota|roster|rostering|shift planning|workforce|management|payroll|time and attendance|hr)\b[^.]{0,24}\b(software|app|system|tool|platform|solution|program|programme)s?\b/;

/**
 * True when a query is a bare category head term with nothing to narrow it.
 *
 * This is the lesson of the first 61 articles: they targeted exactly these, and
 * returned 5 clicks in 28 days with nothing in striking distance. A 650-word
 * page from a six-month-old domain cannot outrank a decade of authority, no
 * matter how well written. Any narrowing angle — our vertical, a market we
 * bill in, a staff count, an unowned feature — makes the same query winnable,
 * so only the completely unqualified ones get buried.
 */
export function isDefendedHeadTerm(keyword: string): boolean {
  const k = keyword.toLowerCase();
  if (!CATEGORY_TERM.test(k)) return false;

  // A real narrowing angle makes the same category term winnable.
  if (FEATURE_GAP.some((re) => re.test(k))) return false;
  if (OUR_MARKET.test(k)) return false;
  if (/\b\d+\b/.test(k)) return false; // "rota software for 12 staff" — a real operator
  if (NARROW_VENUE.test(k)) return false; // a pub or food truck is long-tail by nature
  if (OUR_VERTICAL.test(k) && SMALLNESS.test(k)) return false;

  // Naming the vertical alone is NOT enough: "restaurant management software"
  // is every bit as defended as "employee scheduling software", and it scored
  // 84 here until this rule existed.
  return true;
}

/**
 * Score a keyword. Higher = write it sooner.
 *
 * The previous version returned 49 for virtually every candidate: the
 * word-count bucket saturated at 5 words (+25) and intent was almost always
 * commercial (+24), so 800 keywords tied and the queue published whatever
 * happened to be next in insertion order. Scoring now stays continuous and
 * leans on signals that actually differ between two long commercial queries:
 *
 *  - striking distance in Search Console (already ranking 4-20) beats everything
 *  - real impressions with no clicks = demand we're already visible for
 *  - unowned feature ground (HACCP, recipe costing, tips) over defended ground
 *  - our own vertical over generic business software
 *  - specificity of any kind, because each qualifier is one more competitor who
 *    never bothered writing the page
 */
export function scoreKeyword(k: {
  keyword: string;
  intent: string;
  impressions?: number;
  clicks?: number;
  position?: number | null;
}): number {
  let score = 0;
  const key = k.keyword.trim().toLowerCase();
  const words = key.split(/\s+/).length;

  // Long tail, continuous — no ceiling at five words.
  score += Math.min(30, Math.max(0, (words - 2) * 6));

  score += { transactional: 30, commercial: 24, local: 18, informational: 10 }[k.intent] ?? 10;

  // Hospitality context. "rota software for pubs" is worth ten of "rota software".
  if (OUR_VERTICAL.test(key)) score += 22;

  // Ground no competitor holds in AI answers, where we ship the feature.
  if (FEATURE_GAP.some((re) => re.test(key))) score += 28;

  if (OUR_MARKET.test(key)) score += 10;

  // A number is nearly always a real operator describing their own venue.
  if (/\b\d+\s*(staff|employees|people|seats|covers|locations|sites|venues|tables)\b/.test(key))
    score += 14;

  // Question-shaped queries are cheap to answer outright, and a self-contained
  // answer is exactly what an assistant lifts.
  if (/^(how|what|why|when|do|does|is|are|can|should)\b/.test(key)) score += 8;

  // Unwinnable at our authority. Kept in the map, buried in the queue.
  if (isDefendedHeadTerm(key)) score -= 45;

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
  // "in <language>" — we publish in English only, and "food cost formula in
  // restaurant in hindi" was sitting at 90 in the queue.
  /\bin (hindi|urdu|tamil|telugu|bengali|marathi|gujarati|punjabi|malayalam|kannada|arabic|indonesian|tagalog|filipino|vietnamese|thai|swahili|amharic|nepali)\b/i,
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

/**
 * Industries Rotahr does not serve. Autocomplete offers these constantly
 * because scheduling software is a generic category — "employee scheduling
 * software for healthcare" was sitting in the queue scoring the same 49 as
 * everything else. Ranking for them would bring clicks that can never convert
 * and dilute the topical authority we're trying to build in hospitality.
 */
const OFF_VERTICAL = new RegExp(
  "\\b(" +
    [
      "healthcare", "health care", "hospital", "nursing", "nurse", "care home", "clinic",
      "dental", "dentist", "pharmacy", "medical", "veterinary",
      "construction", "warehouse", "manufacturing", "factory", "logistics", "trucking",
      "security guard", "call cent(er|re)", "bpo",
      "retail store", "supermarket", "grocery store", "petrol station",
      "gym", "fitness", "salon", "spa", "barbershop", "tattoo",
      "school", "teacher", "university", "college", "church", "nonprofit", "non-profit",
      "police", "fire department", "airline", "airport",
      "cleaning company", "janitorial", "landscaping", "daycare", "childcare", "nanny",
      // Startup finance, not hospitality — "cap table management software".
      "cap table", "captable", "equity management", "shareholder",
    ].join("|") +
    ")\\b",
  "i"
);

/**
 * Queries from people who will never buy. Rotahr starts at €59/month; somebody
 * searching "free download" or "open source" is not a customer at any point in
 * the funnel. We published "best open source shift planning software" on 5
 * August — a real article, real cost, zero possible conversion.
 */
const NEVER_CONVERTS = new RegExp(
  "(" +
    [
      "\\bfree download\\b", "\\bdownload free\\b", "\\bfreeware\\b", "\\bopen source\\b",
      "\\bfor sale\\b", "\\bfree trial download\\b", "\\bfull version\\b",
      // "best free X software" — the whole intent is not paying for it.
      "\\bfree\\b[^.]{0,40}\\b(software|app|system|tool|platform|program|programme|maker|creator|generator|builder|designer)s?\\b",
      "\\b(software|app|system|tool|platform|maker|creator|generator|builder|designer)s?\\b[^.]{0,24}\\bfree\\b",
    ].join("|") +
    ")",
  "i"
);

/**
 * Developers building their own thing, and people looking for a diagramming
 * tool. "restaurant table booking system using php and mysql" scored 104 and
 * sat at the very top of the queue — a student writing a college project, who
 * will never buy scheduling software. Note "how to make a staff rota" is
 * deliberately NOT caught here: that's an operator we can help and sell to.
 */
const DIY_OR_DEV = new RegExp(
  "(" +
    [
      "\\b(php|mysql|sql server|python|javascript|java|c#|\\.net|laravel|django|react|node ?js)\\b",
      "\\bsource code\\b", "\\bgithub\\b", "\\bapi (tutorial|documentation)\\b",
      "\\bhow to (build|code|program|develop)\\b", "\\bdatabase (design|schema)\\b",
      "\\ber diagram\\b", "\\buml\\b", "\\bproject report\\b", "\\bfinal year project\\b",
      // Diagram tools, not hospitality software.
      "\\b(smartdraw|visio|lucidchart|autocad|sketchup|canva|figma)\\b",
    ].join("|") +
    ")",
  "i"
);

/** Drop queries that can never convert for a hospitality SaaS. */
export function isUsable(keyword: string): boolean {
  const k = keyword.trim();
  if (k.length < 8 || k.length > 90) return false;
  if (!/^[a-z0-9 '&/.+-]+$/i.test(k)) return false;
  if (OFF_MARKET.test(k)) return false;
  if (OFF_VERTICAL.test(k)) return false;
  if (NEVER_CONVERTS.test(k)) return false;
  if (DIY_OR_DEV.test(k)) return false;
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
