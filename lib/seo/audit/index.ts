/**
 * Site audit orchestrator — works against any domain.
 *
 * Time budget matters: Vercel caps the function, so the crawl gets a hard wall
 * clock and PSI (which alone can take 60s+) runs concurrently with it rather than
 * after. A partial report is far more useful than a timeout, so every stage
 * degrades to a warning instead of throwing.
 */

import { analyse, buildAiReadiness } from "./analyse";
import { crawlSite, fetchRobots, fetchSitemap, normaliseDomain } from "./crawl";
import { runPsi } from "./psi";
import type { AuditReport } from "./types";

export * from "./types";
export { normaliseDomain } from "./crawl";

export interface AuditOptions {
  maxPages?: number;
  /** Wall clock for the crawl stage only. */
  crawlBudgetMs?: number;
  /** Skip PageSpeed Insights (much faster, no Core Web Vitals). */
  skipPsi?: boolean;
  psiStrategy?: "mobile" | "desktop";
}

async function checkLlmsTxt(origin: string): Promise<{ found: boolean; bytes: number }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${origin}/llms.txt`, {
      signal: ctrl.signal,
      headers: { "user-agent": "RotahrSiteAudit/1.0" },
    }).finally(() => clearTimeout(t));
    if (!res.ok) return { found: false, bytes: 0 };
    const text = await res.text();
    // Some hosts serve an HTML 404 page with a 200 status.
    if (/<html/i.test(text.slice(0, 200))) return { found: false, bytes: 0 };
    return { found: true, bytes: text.length };
  } catch {
    return { found: false, bytes: 0 };
  }
}

export async function auditSite(input: string, opts: AuditOptions = {}): Promise<AuditReport> {
  const maxPages = Math.min(opts.maxPages ?? 25, 60);
  const crawlBudgetMs = Math.min(opts.crawlBudgetMs ?? 45000, 120000);

  const norm = normaliseDomain(input);
  if (!norm) throw new Error(`"${input}" is not a valid domain.`);
  const { origin } = norm;

  const startedAt = new Date();
  const warnings: string[] = [];

  // Confirm the origin is reachable, and follow http->https or apex->www so the
  // whole audit runs against the URL that actually serves the site.
  let effectiveOrigin = origin;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const probe = await fetch(origin + "/", {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "RotahrSiteAudit/1.0" },
    }).finally(() => clearTimeout(t));
    const finalOrigin = new URL(probe.url).origin;
    if (finalOrigin !== origin) {
      warnings.push(`${origin} redirects to ${finalOrigin} — audited the destination.`);
      effectiveOrigin = finalOrigin;
    }
    if (probe.status >= 400) {
      warnings.push(`Homepage returned HTTP ${probe.status}.`);
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Could not reach ${origin}: ${msg}`);
  }

  // PSI is slow and independent of the crawl, so start it now and await later.
  const psiPromise = opts.skipPsi
    ? Promise.resolve(null)
    : runPsi(effectiveOrigin + "/", opts.psiStrategy ?? "mobile");

  const robots = await fetchRobots(effectiveOrigin);
  const [sitemap, llmsTxt, crawl] = await Promise.all([
    fetchSitemap(effectiveOrigin, robots.sitemaps),
    checkLlmsTxt(effectiveOrigin),
    crawlSite(effectiveOrigin, { maxPages, budgetMs: crawlBudgetMs }),
  ]);

  warnings.push(...crawl.warnings);

  const psi = await psiPromise;
  if (psi && !psi.ok && psi.error) warnings.push(psi.error);

  const ai = buildAiReadiness(crawl.pages, robots, llmsTxt);
  const { issues, score, breakdown } = analyse({
    origin: effectiveOrigin,
    pages: crawl.pages,
    robots,
    sitemap,
    psi,
    ai,
  });

  const finishedAt = new Date();

  return {
    domain: norm.host,
    origin: effectiveOrigin,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    pagesCrawled: crawl.pages.length,
    pagesRequested: crawl.requested,
    robots,
    sitemap,
    psi,
    ai,
    pages: crawl.pages,
    issues,
    score,
    scoreBreakdown: breakdown,
    warnings,
  };
}
