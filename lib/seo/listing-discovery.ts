import { prisma } from "@/lib/prisma";
import { navigatorJson } from "@/lib/navigator/ai";

/**
 * Weekly hunt for places Rotahr can be listed or mentioned for free.
 *
 * WHY THIS IS NOT A SUBMISSION BOT
 * Every directory worth appearing in — Capterra, G2, Product Hunt, AlternativeTo
 * — puts a human, a captcha or an editorial review in front of the form. The
 * ones that accept an automated POST are precisely the ones whose links are
 * worthless or actively harmful. So this job does the part that is genuinely
 * mechanical: find the target, work out whether it is real, write the copy, and
 * put it in a queue. Gabor clicks submit. That is roughly three minutes each and
 * it is the only part that cannot be removed.
 *
 * WHY EVERY CANDIDATE IS VETTED BEFORE IT IS STORED
 * A search for "free SaaS directory" returns a long tail of link farms. Adding
 * those to the queue is worse than adding nothing: they waste the only scarce
 * resource here, which is Gabor's willingness to sit and fill in forms, and a
 * cluster of links from spam domains is a negative ranking signal rather than a
 * neutral one. The model gets an explicit instruction to reject rather than fill
 * the quota, and anything it is unsure about is dropped.
 *
 * BUDGET
 * Serper gives 2,500 free queries. Six queries a week is ~310 a year, so this
 * runs indefinitely inside the free tier alongside the daily comment discovery.
 */

const MODEL_BUDGET_PER_RUN = 12;

/** Hard floor. Below this a target is not worth a form fill. */
export const MIN_WEIGHT = 4;

/**
 * Rotated so the same six queries are not run every week — a query returns the
 * same first page for months, and re-running it just burns budget re-rejecting
 * rows that are already in the table. Week number picks the slice.
 */
const QUERY_POOL: string[] = [
  // Software directories
  "free SaaS directory submit your product",
  "submit your startup free directory list",
  "free software listing site for B2B SaaS",
  "add your product free alternative to directory",
  // Vertical — the highest-intent ones for a hospitality tool
  "hospitality technology directory submit vendor",
  "restaurant technology vendor directory free listing",
  "hospitality supplier directory add your business free",
  "restaurant software comparison site add product",
  // Regional business listings
  "free business listing Ireland add your business",
  "free UK business directory submit listing",
  "Ireland startup directory submit",
  // Editorial / community
  "hospitality blog write for us guest post",
  "restaurant industry publication contribute article",
  "hospitality podcast guest submission form",
  "startup community show and tell submit product",
  // Founder / indie
  "indie hacker product directory free submission",
  "launch platform submit SaaS free no payment",
];

export function queriesForWeek(date: Date, take = 6): string[] {
  // ISO-ish week number. Exactness does not matter; only that it advances.
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.floor((date.getTime() - start) / (7 * 86_400_000));
  const out: string[] = [];
  for (let i = 0; i < take; i++) {
    out.push(QUERY_POOL[(week * take + i) % QUERY_POOL.length]);
  }
  return [...new Set(out)];
}

export type SerperHit = { title: string; link: string; snippet: string };

async function serper(query: string): Promise<SerperHit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": process.env.SERPER_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: 10 }),
  });
  if (!res.ok) {
    console.error("[listing-discovery] serper", res.status, await res.text().catch(() => ""));
    return [];
  }
  const data = await res.json();
  return (data.organic || []).map((i: any) => ({
    title: String(i.title || ""),
    link: String(i.link || ""),
    snippet: String(i.snippet || ""),
  }));
}

/**
 * Hosts that are never the target itself.
 *
 * Listicles are the single biggest source of noise: a search for "free SaaS
 * directory" mostly returns blog posts ABOUT directories. Those are useful to a
 * human and useless to this job, which needs the directory itself.
 */
const NEVER = [
  "reddit.com",
  "quora.com",
  "medium.com",
  "youtube.com",
  "linkedin.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "pinterest.com",
  "rotahr.com",
  "google.com",
  "wikipedia.org",
];

/** Titles that mean "an article listing directories", not "a directory". */
const LISTICLE = /\b(\d{2,}\+?\s|top\s\d|best\s\d|list of|ultimate guide|roundup|we tested|i audited)\b/i;

export function isPlausibleTarget(hit: SerperHit): boolean {
  let host: string;
  try {
    host = new URL(hit.link).hostname.replace(/^www\./, "");
  } catch {
    return false;
  }
  if (NEVER.some((n) => host === n || host.endsWith(`.${n}`))) return false;
  if (LISTICLE.test(hit.title)) return false;
  return true;
}

/** Root domain, so a second page on a site already in the table is not a new row. */
export function rootOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

type Vetted = {
  keep: boolean;
  /** The page could not be fetched, so "keep" is a guess and a human should look. */
  unreadable?: boolean;
  reason: string;
  name?: string;
  kind?: string;
  region?: string;
  weight?: number;
  angle?: string;
  submitUrl?: string;
  pitch?: string;
};

const VET_SYSTEM = `You vet link-building targets for Rotahr, an all-in-one operations app for hospitality businesses (rota scheduling, bookings, payroll, HACCP food-safety logs, stock, bookkeeping). Sold to restaurants, pubs, cafes and hotels in Ireland, the UK, the US, Canada and Australia. Pricing is EUR 59 / 119 / 215 a month.

Your job is to REJECT most of what you are shown. You are the only thing standing between a founder with no marketing budget and an afternoon wasted filling in forms on link farms.

REJECT, with no exceptions:
- Anything that charges to be listed, or where the free tier is nofollow-only and buried.
- Link farms: pages that are nothing but outbound links, thin auto-generated directories, "submit your site" pages with no editorial standard.
- Blog posts, listicles or articles ABOUT directories. You want the directory itself.
- Anything unrelated to software, business, hospitality or startups.
- Anything where the page text shows what it is and it is none of the above.

ACCEPT if a real person would plausibly find Rotahr there while looking for software or a supplier, AND listing is genuinely free.

Judge the PAGE TEXT, not the snippet. A snippet is 160 characters picked by a search engine and is not enough to reject on. A working software, vendor or supplier directory in hospitality, restaurants, hotels or B2B SaaS that takes self-serve listings is a KEEP even when the page is plain, sparse or unglamorous — thin design is not a link farm. What makes a link farm is unrelated outbound links in bulk and no editorial standard.

If the page could not be read, do not reject for that reason alone. Set "unreadable": true and give your best guess from the title and URL. Bot protection is normal on large legitimate directories.

Reject for a charge only when the page actually shows one. "Money back guarantee", a 14-day trial or a pricing table on a listing page means paid: reject that. A site that merely has pricing somewhere for a different product does not.

weight, 1-10, is how much this single listing would matter:
  9-10 a category-defining site buyers already search (Capterra, G2, Product Hunt)
  7-8  a well-known directory or a real publication in hospitality or SaaS
  5-6  a legitimate but minor directory, or a regional business listing
  1-4  technically real but close to worthless

kind must be one of: directory, press, guest_post, podcast, community, partner
region must be one of: ie, uk, general

If you accept, also write "pitch": the actual submission copy, ready to paste, no placeholders and nothing for the user to fill in. Match what the target accepts — a one-paragraph product description for a directory, a short pitch email for a publication. Mention concretely what Rotahr does. Never invent a customer count, a funding round, an award or a testimonial: Rotahr has no paying customers yet and saying otherwise on a public profile is a lie that outlives the listing. Do not use the words "revolutionary", "seamless", "cutting-edge" or "game-changing".

Return JSON: {"keep":boolean,"unreadable":boolean,"reason":string,"name":string,"kind":string,"region":string,"weight":number,"angle":string,"submitUrl":string,"pitch":string}
"reason" is one short line and is required whether you keep or reject.`;

/**
 * What the page actually says, not what Google's snippet says about it.
 *
 * This exists because of restaurant-resource.com. The vetter rejected it as
 * weight 1 off a two-line snippet; Gabor submitted it by hand anyway and it
 * turned out to be an indexable, dofollow, correctly categorised software
 * listing — exactly the kind of target this job is supposed to find. A snippet
 * is 160 characters chosen by a search engine to match a query, and judging a
 * directory on it is guesswork dressed up as a decision.
 *
 * Returns null when the page cannot be read at all. That is not evidence of a
 * bad target: Cloudflare answers 403 to a datacentre IP for plenty of sites
 * worth listing on, including SaaSHub, SourceForge and Crunchbase.
 */
type PageContext = { text: string; hasSubmitRoute: boolean };

async function fetchPageContext(url: string): Promise<PageContext | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 400_000);

    // A "submit your product" route is the single strongest signal that a
    // directory takes self-serve listings rather than only paid sales contact.
    const hasSubmitRoute =
      /href="[^"]*(add|submit|list|create|new|register|vendor|get-listed)[^"]*"/i.test(html);

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);

    return text.length < 80 ? null : { text, hasSubmitRoute };
  } catch {
    return null;
  }
}

async function vet(hit: SerperHit, query: string): Promise<Vetted> {
  const page = await fetchPageContext(hit.link);
  try {
    return await navigatorJson<Vetted>(
      VET_SYSTEM,
      [
        `Found by searching: ${query}`,
        `Title: ${hit.title}`,
        `URL: ${hit.link}`,
        `Snippet: ${hit.snippet}`,
        "",
        page
          ? `Page text (fetched just now, ${page.hasSubmitRoute ? "HAS" : "has NO"} self-serve submit/add/list link in its markup):\n${page.text}`
          : "Page text: COULD NOT BE READ (bot protection or timeout). Judge on the title, URL and snippet, and set unreadable=true so a human checks it rather than binning it.",
      ].join("\n"),
      900
    );
  } catch (e) {
    return { keep: false, reason: `vetting failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

const KINDS = new Set(["directory", "press", "guest_post", "podcast", "community", "partner"]);
const REGIONS = new Set(["ie", "uk", "general"]);

export type DiscoveryResult = {
  ok: boolean;
  queries: string[];
  seen: number;
  plausible: number;
  vetted: number;
  added: number;
  rejected: { url: string; reason: string }[];
  names: string[];
  skipped?: string;
};

export async function discoverListings(): Promise<DiscoveryResult> {
  const base: DiscoveryResult = {
    ok: true,
    queries: [],
    seen: 0,
    plausible: 0,
    vetted: 0,
    added: 0,
    rejected: [],
    names: [],
  };

  if (!process.env.SERPER_API_KEY) return { ...base, ok: false, skipped: "SERPER_API_KEY is not set" };
  if (!process.env.OPENAI_API_KEY) return { ...base, ok: false, skipped: "OPENAI_API_KEY is not set" };

  const queries = queriesForWeek(new Date());
  base.queries = queries;

  // Every root domain we already know about, kept or rejected. Rejections are
  // stored as rows too (status "rejected"), which is what stops the same link
  // farm being re-vetted every single week at model cost.
  const known = new Set(
    (await prisma.linkProspect.findMany({ select: { url: true } })).map((r) => rootOf(r.url))
  );

  const hits: { hit: SerperHit; query: string }[] = [];
  for (const q of queries) {
    const found = await serper(q);
    base.seen += found.length;
    for (const hit of found) {
      if (!isPlausibleTarget(hit)) continue;
      const root = rootOf(hit.link);
      if (known.has(root)) continue;
      known.add(root); // also dedupes within this run
      hits.push({ hit, query: q });
    }
  }
  base.plausible = hits.length;

  // Highest-value-looking first, so the model budget is spent on the hits most
  // likely to be worth keeping rather than on whatever came back first.
  const queue = hits.slice(0, MODEL_BUDGET_PER_RUN);

  for (const { hit, query } of queue) {
    const v = await vet(hit, query);
    base.vetted += 1;

    const weight = Number.isFinite(v.weight) ? Math.round(Number(v.weight)) : 0;
    const keep = Boolean(v.keep) && weight >= MIN_WEIGHT && Boolean(v.pitch?.trim());

    if (!keep) {
      base.rejected.push({
        url: hit.link,
        reason: !v.keep
          ? v.reason || "rejected"
          : weight < MIN_WEIGHT
            ? `weight ${weight} below floor ${MIN_WEIGHT}`
            : "no usable pitch written",
      });
      // A rejection is stored as a row so next week's run does not pay to reach
      // the same conclusion. But a row is also permanent, and a wrong rejection
      // is therefore permanent: restaurant-resource.com was binned at weight 1
      // and would never have been reconsidered, yet it is a live dofollow
      // listing today. So a rejection the model could not actually see the
      // evidence for is parked as "needs_check" instead of "rejected" — it stays
      // out of the paste-ready queue, but it is visible and revivable.
      const unreadable = Boolean(v.unreadable);
      await prisma.linkProspect
        .create({
          data: {
            name: (v.name || hit.title || rootOf(hit.link)).slice(0, 200),
            url: `https://${rootOf(hit.link)}/`,
            kind: "directory",
            region: "general",
            weight: Math.max(1, weight),
            status: unreadable ? "needs_check" : "rejected",
            source: "discovered",
            discoveredVia: query,
            notes: unreadable
              ? `Could not read the page ${new Date().toISOString().slice(0, 10)} (bot protection or timeout), so this was not judged on evidence. Model's guess: ${(v.reason || "").slice(0, 300)}. Open it in a browser before deciding.`
              : `Auto-rejected ${new Date().toISOString().slice(0, 10)}: ${(v.reason || "").slice(0, 300)}`,
          },
        })
        .catch(() => {}); // unique violation = already known, fine
      continue;
    }

    const created = await prisma.linkProspect
      .create({
        data: {
          name: (v.name || hit.title).slice(0, 200),
          url: hit.link,
          kind: KINDS.has(String(v.kind)) ? String(v.kind) : "directory",
          region: REGIONS.has(String(v.region)) ? String(v.region) : "general",
          weight: Math.min(10, Math.max(1, weight)),
          angle: v.angle?.slice(0, 1000) || null,
          submitUrl: v.submitUrl?.startsWith("http") ? v.submitUrl.slice(0, 500) : null,
          pitch: v.pitch!.slice(0, 4000),
          status: "new",
          source: "discovered",
          discoveredVia: query,
          contactNote: `Found automatically ${new Date().toISOString().slice(0, 10)}. Verify the submission route before sending — the URL above is where the search landed, not necessarily the form.`,
        },
      })
      .catch(() => null);

    if (created) {
      base.added += 1;
      base.names.push(created.name);
    }
  }

  return base;
}
