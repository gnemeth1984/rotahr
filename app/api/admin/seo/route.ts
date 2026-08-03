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

  // Traffic trend from the stored Search Console snapshots.
  const metrics = await prisma.seoMetric.groupBy({
    by: ["date"],
    _sum: { clicks: true, impressions: true },
    orderBy: { date: "asc" },
    take: 60,
  });

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
    trend: metrics.map((m) => ({
      date: m.date,
      clicks: m._sum.clicks ?? 0,
      impressions: m._sum.impressions ?? 0,
    })),
  });
}
