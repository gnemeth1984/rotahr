/**
 * Polite breadth-first crawler + HTML parser.
 *
 * Deliberately dependency-free regex parsing rather than a DOM library: this
 * runs inside a Vercel function with a hard time budget, and we only need a
 * fixed set of head/body signals. Malformed HTML degrades to nulls instead of
 * throwing, which matters because we point this at arbitrary third-party sites.
 */

import type { PageResult, RobotsInfo, SitemapInfo } from "./types";

const UA =
  "Mozilla/5.0 (compatible; RotahrSiteAudit/1.0; +https://rotahr.com/site-audit)";

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
];

/** Normalise user input ("example.com", "http://example.com/x") to an origin. */
export function normaliseDomain(input: string): { origin: string; host: string } | null {
  let raw = input.trim();
  if (!raw) return null;
  raw = raw.replace(/\s+/g, "");
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (!u.hostname.includes(".")) return null;
    // Strip credentials and any path — we always crawl from the root.
    return { origin: `${u.protocol}//${u.host}`, host: u.host };
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? decodeEntities(m[1].trim()) : null;
}

/** Strip script/style/nav chrome, then count visible words. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fetchWithTimeout(url: string, ms: number, method: "GET" | "HEAD" = "GET") {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, {
    method,
    redirect: "follow",
    signal: ctrl.signal,
    headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*" },
  }).finally(() => clearTimeout(t));
}

export async function fetchPage(url: string, timeoutMs = 15000): Promise<PageResult> {
  const started = Date.now();
  const base: PageResult = {
    url,
    status: 0,
    redirectChain: 0,
    contentType: "",
    loadMs: 0,
    bytes: 0,
    title: null,
    titleLength: 0,
    metaDescription: null,
    metaDescriptionLength: 0,
    h1: [],
    h2: [],
    canonical: null,
    robotsMeta: null,
    noindex: false,
    lang: null,
    wordCount: 0,
    firstParagraph: null,
    images: 0,
    imagesMissingAlt: 0,
    internalLinks: [],
    externalLinks: [],
    schemaTypes: [],
    schemaErrors: [],
    openGraph: {},
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, timeoutMs);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...base, loadMs: Date.now() - started, error: msg === "The operation was aborted." ? "timeout" : msg };
  }

  base.status = res.status;
  base.contentType = res.headers.get("content-type") ?? "";
  if (res.url && res.url !== url) base.redirectedTo = res.url;

  if (!base.contentType.includes("html")) {
    base.loadMs = Date.now() - started;
    return base;
  }

  let html: string;
  try {
    html = await res.text();
  } catch (e: unknown) {
    base.loadMs = Date.now() - started;
    base.error = e instanceof Error ? e.message : String(e);
    return base;
  }

  base.loadMs = Date.now() - started;
  base.bytes = html.length;

  const head = html.slice(0, 200000);

  const titleM = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) {
    base.title = decodeEntities(visibleText(titleM[1]));
    base.titleLength = base.title.length;
  }

  const htmlTag = head.match(/<html[^>]*>/i);
  if (htmlTag) base.lang = attr(htmlTag[0], "lang");

  for (const m of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0];
    const name = (attr(tag, "name") ?? "").toLowerCase();
    const prop = (attr(tag, "property") ?? "").toLowerCase();
    const content = attr(tag, "content");
    if (!content) continue;
    if (name === "description") {
      base.metaDescription = content;
      base.metaDescriptionLength = content.length;
    }
    if (name === "robots") {
      base.robotsMeta = content;
      if (/noindex/i.test(content)) base.noindex = true;
    }
    if (prop.startsWith("og:")) base.openGraph[prop] = content;
  }

  const canonM = head.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
  if (canonM) base.canonical = attr(canonM[0], "href");

  for (const m of html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)) {
    const t = visibleText(m[1]);
    if (t) base.h1.push(t);
  }
  for (const m of html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const t = visibleText(m[1]);
    if (t) base.h2.push(t);
  }

  // Body-only word count, so nav/footer boilerplate in <head> can't inflate it.
  const bodyM = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyHtml = bodyM ? bodyM[1] : html;
  const text = visibleText(bodyHtml);
  base.wordCount = text ? text.split(/\s+/).length : 0;

  const pM = bodyHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pM) {
    const p = visibleText(pM[1]);
    if (p) base.firstParagraph = p.slice(0, 400);
  }

  for (const m of bodyHtml.matchAll(/<img\s+[^>]*>/gi)) {
    base.images++;
    // An explicit alt="" is the correct markup for a purely decorative image,
    // so only a genuinely absent alt attribute counts as a fault. Also skip
    // images the page has marked as presentational.
    const alt = attr(m[0], "alt");
    const role = attr(m[0], "role");
    const decorative =
      role === "presentation" ||
      role === "none" ||
      attr(m[0], "aria-hidden") === "true";
    if (alt === null && !decorative) base.imagesMissingAlt++;
  }

  const origin = new URL(url).origin;
  const seen = new Set<string>();
  for (const m of bodyHtml.matchAll(/<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const href = decodeEntities(m[1].trim());
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    let abs: URL;
    try {
      abs = new URL(href, url);
    } catch {
      continue;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    abs.hash = "";
    const s = abs.toString();
    if (seen.has(s)) continue;
    seen.add(s);
    if (abs.origin === origin) base.internalLinks.push(s);
    else base.externalLinks.push(s);
  }

  for (const m of html.matchAll(
    /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const collect = (node: unknown) => {
        if (Array.isArray(node)) return node.forEach(collect);
        if (node && typeof node === "object") {
          const t = (node as Record<string, unknown>)["@type"];
          if (typeof t === "string") base.schemaTypes.push(t);
          else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && base.schemaTypes.push(x));
          const graph = (node as Record<string, unknown>)["@graph"];
          if (graph) collect(graph);
        }
      };
      collect(parsed);
    } catch (e: unknown) {
      base.schemaErrors.push(e instanceof Error ? e.message.slice(0, 120) : "invalid JSON-LD");
    }
  }

  return base;
}

export async function fetchRobots(origin: string): Promise<RobotsInfo> {
  const info: RobotsInfo = {
    found: false,
    raw: null,
    sitemaps: [],
    aiCrawlers: {},
    blocksEverything: false,
  };
  for (const c of AI_CRAWLERS) info.aiCrawlers[c] = "unmentioned";

  let text: string;
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`, 10000);
    if (!res.ok) return info;
    text = await res.text();
  } catch {
    return info;
  }

  info.found = true;
  info.raw = text.slice(0, 8000);

  for (const m of text.matchAll(/^\s*sitemap:\s*(\S+)/gim)) info.sitemaps.push(m[1].trim());

  // Walk user-agent groups so a Disallow is attributed to the right crawler.
  const lines = text.split(/\r?\n/);
  let current: string[] = [];
  const groups: { agents: string[]; disallows: string[]; allows: string[] }[] = [];
  let g: { agents: string[]; disallows: string[]; allows: string[] } | null = null;
  for (const line of lines) {
    const l = line.replace(/#.*$/, "").trim();
    if (!l) continue;
    const ua = l.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      if (g && (g.disallows.length || g.allows.length)) {
        groups.push(g);
        g = null;
      }
      if (!g) g = { agents: [], disallows: [], allows: [] };
      g.agents.push(ua[1].trim().toLowerCase());
      current = g.agents;
      continue;
    }
    const dis = l.match(/^disallow:\s*(.*)$/i);
    if (dis && g) g.disallows.push(dis[1].trim());
    const allow = l.match(/^allow:\s*(.*)$/i);
    if (allow && g) g.allows.push(allow[1].trim());
  }
  if (g && (g.disallows.length || g.allows.length)) groups.push(g);
  void current;

  for (const crawler of AI_CRAWLERS) {
    const lc = crawler.toLowerCase();
    const group = groups.find((x) => x.agents.includes(lc));
    if (group) {
      info.aiCrawlers[crawler] = group.disallows.some((d) => d === "/") ? "blocked" : "allowed";
    }
  }

  const star = groups.find((x) => x.agents.includes("*"));
  if (star && star.disallows.some((d) => d === "/")) {
    info.blocksEverything = true;
    // A blanket block applies to AI crawlers that never got their own group.
    for (const crawler of AI_CRAWLERS) {
      if (info.aiCrawlers[crawler] === "unmentioned") info.aiCrawlers[crawler] = "blocked";
    }
  }

  return info;
}

export async function fetchSitemap(origin: string, hinted: string[]): Promise<SitemapInfo> {
  const info: SitemapInfo = {
    found: false,
    url: null,
    urlCount: 0,
    brokenSample: [],
    crossDomain: false,
  };

  const candidates = [...hinted, `${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const host = new URL(origin).host;

  for (const cand of candidates) {
    let xml: string;
    try {
      const res = await fetchWithTimeout(cand, 12000);
      if (!res.ok) continue;
      xml = await res.text();
    } catch {
      continue;
    }
    if (!xml.includes("<urlset") && !xml.includes("<sitemapindex")) continue;

    info.found = true;
    info.url = cand;

    // Follow one level of sitemap index, capped to keep the time budget.
    if (xml.includes("<sitemapindex")) {
      const children = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]).slice(0, 5);
      for (const child of children) {
        try {
          const r = await fetchWithTimeout(child, 10000);
          if (!r.ok) continue;
          const cx = await r.text();
          const locs = [...cx.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
          info.urlCount += locs.length;
          for (const l of locs.slice(0, 40)) {
            try {
              if (new URL(l).host !== host) info.crossDomain = true;
            } catch { /* ignore malformed loc */ }
          }
        } catch { /* skip unreachable child sitemap */ }
      }
      return info;
    }

    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    info.urlCount = locs.length;
    for (const l of locs.slice(0, 60)) {
      try {
        if (new URL(l).host !== host) info.crossDomain = true;
      } catch { /* ignore */ }
    }
    return info;
  }

  return info;
}

/**
 * Breadth-first crawl from the origin, capped by page count and wall clock.
 * Concurrency is intentionally low — we are crawling someone else's server.
 */
export async function crawlSite(
  origin: string,
  opts: { maxPages: number; budgetMs: number; concurrency?: number },
): Promise<{ pages: PageResult[]; requested: number; warnings: string[] }> {
  const { maxPages, budgetMs } = opts;
  const concurrency = opts.concurrency ?? 4;
  const deadline = Date.now() + budgetMs;
  const warnings: string[] = [];

  const queue: string[] = [origin + "/"];
  const seen = new Set<string>([origin + "/"]);
  const pages: PageResult[] = [];
  let requested = 0;

  const skipExt = /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|zip|mp4|mp3|woff2?|ttf|xml|txt|json)$/i;

  while (queue.length && pages.length < maxPages) {
    if (Date.now() > deadline) {
      warnings.push(
        `Crawl stopped at the ${Math.round(budgetMs / 1000)}s time budget after ${pages.length} pages.`,
      );
      break;
    }

    const batch = queue.splice(0, concurrency);
    requested += batch.length;
    const results = await Promise.all(batch.map((u) => fetchPage(u)));

    for (const r of results) {
      pages.push(r);
      if (pages.length >= maxPages) break;
      // Only follow links from indexable HTML we actually got.
      if (r.status !== 200 || r.noindex) continue;
      for (const link of r.internalLinks) {
        if (seen.size >= maxPages * 6) break;
        let clean = link;
        try {
          const u = new URL(link);
          u.hash = "";
          clean = u.toString();
        } catch {
          continue;
        }
        if (seen.has(clean) || skipExt.test(new URL(clean).pathname)) continue;
        seen.add(clean);
        queue.push(clean);
      }
    }
  }

  return { pages, requested, warnings };
}
