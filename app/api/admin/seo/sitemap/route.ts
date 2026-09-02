/**
 * /api/admin/seo/sitemap — read and (re)submit the Search Console sitemap.
 *
 * GET  → what Search Console currently knows about the sitemap: when it last
 *        downloaded the file, how many URLs it read, warnings and errors.
 * POST → resubmit it, and fire IndexNow at the same time so Bing/Yandex pick
 *        the new URLs up immediately.
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

/** Read the live sitemap and pull the URLs out of it. */
async function sitemapUrls(limit = 50): Promise<string[]> {
  try {
    const res = await fetch(SITEMAP_URL, { cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const found = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    return found.slice(0, limit);
  } catch {
    return [];
  }
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

  const urls = await sitemapUrls();
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
    `${urls.length} url(s) in sitemap`,
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
      urlCount: urls.length,
      indexNow,
      sitemap: mine,
      sitemaps,
      error,
    },
    { status: submitted ? 200 : 502 }
  );
}
