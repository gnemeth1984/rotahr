/**
 * GET /api/admin/seo — everything the SEO Autopilot tab renders.
 *
 * Reads only from our own tables (SeoKeyword / SeoMetric / SeoRun / BlogPost).
 * Search Console is queried by the weekly cron, not on page load, so opening
 * the dashboard is instant and can't blow an API quota.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/seo/auth";
import { gscConfigured } from "@/lib/seo/gsc";
import { indexNowKey } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalKeywords,
    queued,
    written,
    skipped,
    posts,
    withKeyword,
    refreshed,
    topQueue,
    striking,
    clusters,
    runs,
    recentPosts,
  ] = await Promise.all([
    prisma.seoKeyword.count(),
    prisma.seoKeyword.count({ where: { status: { in: ["new", "queued"] } } }),
    prisma.seoKeyword.count({ where: { status: "written" } }),
    prisma.seoKeyword.count({ where: { status: "skipped" } }),
    prisma.blogPost.count({ where: { published: true } }),
    prisma.blogPost.count({ where: { published: true, keyword: { not: null } } }),
    prisma.blogPost.count({ where: { refreshCount: { gt: 0 } } }),
    prisma.seoKeyword.findMany({
      where: { status: { in: ["new", "queued"] } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 25,
      select: {
        id: true,
        keyword: true,
        cluster: true,
        intent: true,
        priority: true,
        impressions: true,
        clicks: true,
        position: true,
        source: true,
      },
    }),
    // Already ranking 4-20 — the cheapest traffic available.
    prisma.seoKeyword.findMany({
      where: { position: { gte: 4, lte: 20 }, impressions: { gt: 0 } },
      orderBy: { impressions: "desc" },
      take: 20,
      select: {
        id: true,
        keyword: true,
        position: true,
        impressions: true,
        clicks: true,
        status: true,
      },
    }),
    prisma.seoKeyword.groupBy({
      by: ["cluster"],
      _count: { _all: true },
      orderBy: { _count: { cluster: "desc" } },
      take: 15,
    }),
    prisma.seoRun.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        slug: true,
        title: true,
        keyword: true,
        wordCount: true,
        refreshCount: true,
        createdAt: true,
      },
    }),
  ]);

  // Traffic trend from the stored Search Console snapshots. Site-level rows
  // only (page="" / query=""), so per-page rows can't double-count the totals.
  const metrics = await prisma.seoMetric.findMany({
    where: { page: "", query: "" },
    orderBy: { date: "asc" },
    select: { date: true, clicks: true, impressions: true, position: true, ctr: true },
  });

  const trend = metrics.map((m) => ({
    date: m.date.toISOString().slice(0, 10),
    clicks: m.clicks,
    impressions: m.impressions,
    position: m.position,
    ctr: m.ctr,
  }));

  /**
   * Compare the last N days against the N before them. This is the number that
   * answers "is this actually working" — a total on its own can't.
   */
  function delta(windowDays: number) {
    const recent = trend.slice(-windowDays);
    const prior = trend.slice(-windowDays * 2, -windowDays);
    if (!recent.length || !prior.length) return null;

    const sum = (rows: typeof trend, k: "clicks" | "impressions") =>
      rows.reduce((s, r) => s + r[k], 0);
    // Position is an average, not a total — and lower is better, so the sign
    // is flipped to keep "positive change = good" true across every metric.
    const avgPos = (rows: typeof trend) => {
      const seen = rows.filter((r) => r.impressions > 0);
      if (!seen.length) return null;
      return seen.reduce((s, r) => s + r.position, 0) / seen.length;
    };

    const pct = (now: number, before: number) =>
      before === 0 ? (now > 0 ? 100 : 0) : ((now - before) / before) * 100;

    const rc = sum(recent, "clicks");
    const pc = sum(prior, "clicks");
    const ri = sum(recent, "impressions");
    const pi = sum(prior, "impressions");
    const rp = avgPos(recent);
    const pp = avgPos(prior);

    return {
      days: windowDays,
      clicks: { now: rc, before: pc, changePct: pct(rc, pc) },
      impressions: { now: ri, before: pi, changePct: pct(ri, pi) },
      position:
        rp !== null && pp !== null
          ? { now: rp, before: pp, change: pp - rp } // positive = moved up
          : null,
    };
  }

  return NextResponse.json({
    config: {
      searchConsole: gscConfigured(),
      indexNow: !!indexNowKey(),
      openai: !!process.env.OPENAI_API_KEY,
      cronSecret: !!process.env.CRON_SECRET,
    },
    counts: { totalKeywords, queued, written, skipped, posts, withKeyword, refreshed },
    topQueue,
    striking,
    clusters: clusters.map((c) => ({ cluster: c.cluster, count: c._count._all })),
    runs,
    recentPosts,
    trend,
    deltas: { week: delta(7), month: delta(28) },
  });
}
