/**
 * Core Web Vitals via Google PageSpeed Insights.
 *
 * Lighthouse cannot run inside a Vercel function — there is no Chrome binary and
 * no memory headroom for one. PSI runs the identical Lighthouse audit on Google's
 * own infrastructure and returns the same categories and metrics over HTTP, so we
 * get real lab data without shipping a browser.
 *
 * The API works without a key at low volume but is aggressively rate limited;
 * PAGESPEED_API_KEY raises the quota. Absence of a key is not an error.
 */

import type { PsiResult } from "./types";

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

function metric(audits: Record<string, { numericValue?: number }>, id: string): number | null {
  const v = audits?.[id]?.numericValue;
  return typeof v === "number" ? Math.round(v * 1000) / 1000 : null;
}

function score(cats: Record<string, { score?: number | null }>, id: string): number | null {
  const s = cats?.[id]?.score;
  return typeof s === "number" ? Math.round(s * 100) : null;
}

export async function runPsi(
  url: string,
  strategy: "mobile" | "desktop" = "mobile",
): Promise<PsiResult> {
  const empty: PsiResult = {
    ok: false,
    strategy,
    performance: null,
    seo: null,
    accessibility: null,
    bestPractices: null,
    lcp: null,
    cls: null,
    tbt: null,
    fcp: null,
    si: null,
    fieldLcp: null,
    fieldCls: null,
    fieldInp: null,
    hasFieldData: false,
  };

  const params = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "seo", "accessibility", "best-practices"]) {
    params.append("category", c);
  }
  const key = process.env.PAGESPEED_API_KEY;
  if (key) params.set("key", key);

  const ctrl = new AbortController();
  // PSI regularly takes 30s+ on a cold URL; give it room but stay bounded.
  const timer = setTimeout(() => ctrl.abort(), 75000);

  try {
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: ctrl.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let msg = `PSI HTTP ${res.status}`;
      try {
        const j = JSON.parse(body);
        if (j?.error?.message) msg = `PSI: ${j.error.message}`;
      } catch { /* keep generic message */ }
      if (res.status === 429) {
        msg = "PSI rate limit reached. Set PAGESPEED_API_KEY to raise the quota.";
      }
      return { ...empty, error: msg };
    }

    const json = await res.json();
    const lh = json?.lighthouseResult;
    if (!lh) return { ...empty, error: "PSI returned no Lighthouse result" };

    const audits = lh.audits ?? {};
    const cats = lh.categories ?? {};

    const loading = json?.loadingExperience?.metrics ?? {};
    const fieldLcp = loading?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null;
    const fieldCls = loading?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile ?? null;
    const fieldInp = loading?.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;

    return {
      ok: true,
      strategy,
      performance: score(cats, "performance"),
      seo: score(cats, "seo"),
      accessibility: score(cats, "accessibility"),
      bestPractices: score(cats, "best-practices"),
      lcp: metric(audits, "largest-contentful-paint"),
      cls: metric(audits, "cumulative-layout-shift"),
      tbt: metric(audits, "total-blocking-time"),
      fcp: metric(audits, "first-contentful-paint"),
      si: metric(audits, "speed-index"),
      // CLS field data arrives scaled by 100.
      fieldLcp: typeof fieldLcp === "number" ? fieldLcp : null,
      fieldCls: typeof fieldCls === "number" ? fieldCls / 100 : null,
      fieldInp: typeof fieldInp === "number" ? fieldInp : null,
      hasFieldData: Boolean(fieldLcp || fieldCls || fieldInp),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ...empty, error: msg.includes("abort") ? "PSI timed out after 75s" : msg };
  } finally {
    clearTimeout(timer);
  }
}
