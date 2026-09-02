/**
 * /api/admin/seo/sitemap — read and (re)submit the Search Console sitemap.
 *
 * GET  → what Search Console currently knows about the sitemap: when it last
 *        downloaded the file, how many URLs it read, warnings and errors.
 * POST → resubmit it, and fire IndexNow at the same time so Bing/Yandex pick
 *        the new URLs up immediately. IndexNow gets the URLs whose sitemap
 *        lastmod is inside the last FRESH_DAYS days; `?all=1` sends the lot.
 *
 * Worth being clear about what this does and doesn't do: a registered sitemap
 * is re-fetched by Google on its own schedule, so new pages get discovered
 * without anyone pressing anything. Submitting is a nudge that shortens the
 * wait after a batch of pages ships. Google's old ?ping= endpoint was retired
 * in 2023 and is not used here because it does nothing.
 *
 * Credentials live only in the deployment env (GSC_* are marked sensitive in
 * Vercel and cannot be read back out), which is why submission runs here
 * rather than from a local script.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canRunSeo } from "@/lib/seo/auth";
import { gscConfigured, listSitemaps, submitSitemap, SITEMAP_URL } from "@/lib/seo/gsc";
import { submitToIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

/** IndexNow accepts 10,000 URLs per request. Nothing here comes near it. */
const INDEXNOW_MAX = 10_000;

/** How recently a URL must have changed to be worth pinging. */
const FRESH_DAYS = 7;

type SitemapEntry = { loc: string; lastmod: Date | null };

/**
 * Read the live sitemap and pull out every <url> with its <lastmod>.
 *
 * Parsed per <url> block rather than by scraping <loc> globally, so a loc and
 * a lastmod can never be paired up across entry boundaries.
 */
async function readSitemap(): Promise<SitemapEntry[]> {
  try {
    const res = await fetch(SITEMAP_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();

    return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].flatMap((block) => {
      const body = block[1];
      const loc = /<loc>([^<]+)<\/loc>/.exec(body)?.[1]?.trim();
      if (!loc) return [];
      const raw = /<lastmod>([^<]+)<\/lastmod>/.exec(body)?.[1]?.trim();
      const parsed = raw ? new Date(raw) : null;
      return [
        {
          loc,
          lastmod: parsed && !Number.isNaN(parsed.getTime()) ? parsed : null,
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Which URLs to hand IndexNow.
 *
 * IndexNow exists to announce new and changed pages, and a fresh-URL ping
 * carries more weight than a bulk resubmit of pages the engines already have,
 * so the default is "changed in the last FRESH_DAYS days". `?all=1` overrides
 * it for a full resubmit.
 *
 * A URL with no lastmod is treated as fresh: unknown should not mean skipped.
 */
function toPing(entries: SitemapEntry[], all: boolean): string[] {
  if (all) return entries.map((e) => e.loc).slice(0, INDEXNOW_MAX);

  const cutoff = Date.now() - FRESH_DAYS * 86_400_000;
  return entries
    .filter((e) => !e.lastmod || e.lastmod.getTime() >= cutoff)
    .map((e) => e.loc)
    .slice(0, INDEXNOW_MAX);
}

export async function GET(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!gscConfigured()) {
    return NextResponse.json({ configured: false, sitemaps: [] });
  }

  try {
    const sitemaps = await listSitemaps();
    return NextResponse.json({
      configured: true,
      registered: sitemaps.some((s) => s.path === SITEMAP_URL),
      sitemapUrl: SITEMAP_URL,
      sitemaps,
    });
  } catch (err) {
    return NextResponse.json(
      { configured: true, sitemaps: [], error: String(err instanceof Error ? err.message : err) },
      { status: 502 }
    );
  }
}

export async function POST(req: Request) {
  if (!(await canRunSeo(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const all = new URL(req.url).searchParams.get("all") === "1";
  const entries = await readSitemap();
  const urls = toPing(entries, all);
  const indexNow = await submitToIndexNow(urls); // never throws
  let submitted = false;
  let detail = "";
  let error: string | null = null;

  if (!gscConfigured()) {
    error = "Search Console is not configured (GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY / GSC_SITE_URL).";
  } else {
    try {
      await submitSitemap();
      submitted = true;
    } catch (err) {
      error = String(err instanceof Error ? err.message : err);
    }
  }

  // Read the state back so the dashboard shows what Search Console now thinks,
  // not just that our request returned 200.
  let sitemaps: Awaited<ReturnType<typeof listSitemaps>> = [];
  if (gscConfigured()) {
    try {
      sitemaps = await listSitemaps();
    } catch {
      // Non-fatal: the submit is the job, the read-back is the nicety.
    }
  }

  const mine = sitemaps.find((s) => s.path === SITEMAP_URL) ?? null;
  detail = [
    submitted ? `submitted ${SITEMAP_URL}` : `submit failed: ${error}`,
    `${entries.length} url(s) in sitemap`,
    all
      ? `pinged all ${urls.length}`
      : `pinged ${urls.length} changed in last ${FRESH_DAYS}d`,
    indexNow,
    mine?.lastDownloaded ? `last downloaded ${mine.lastDownloaded}` : "not downloaded yet",
  ].join("; ");

  await prisma.seoRun
    .create({ data: { task: "sitemap", ok: submitted, detail } })
    .catch(() => null); // logging must never fail the request

  return NextResponse.json(
    {
      ok: submitted,
      sitemapUrl: SITEMAP_URL,
      urlCount: entries.length,
      pingedCount: urls.length,
      pingedAll: all,
      freshDays: FRESH_DAYS,
      indexNow,
      sitemap: mine,
      sitemaps,
      error,
    },
    { status: submitted ? 200 : 502 }
  );
}
