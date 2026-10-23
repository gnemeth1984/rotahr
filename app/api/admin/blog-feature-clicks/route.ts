export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { BLOG_FEATURE_CLICK_ACTION, FEATURE_PITCHES, type PromoFeatureSlug } from "@/lib/blog/feature-promo";

/**
 * GET /api/admin/blog-feature-clicks?days=30 — clicks on the feature promo
 * under blog articles, by feature, by article, and by placement/target.
 * Read-only.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const daysParam = Number(new URL(req.url).searchParams.get("days") || 30);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 730) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.activityLog.findMany({
    where: { action: BLOG_FEATURE_CLICK_ACTION, createdAt: { gte: since } },
    select: { details: true },
    take: 20000,
  });

  const byFeature = new Map<string, number>();
  const byPost = new Map<string, { total: number; register: number; feature: string }>();
  const split = { inlineFeature: 0, endFeature: 0, endRegister: 0 };
  for (const r of rows) {
    const d = (r.details ?? {}) as { post?: string; feature?: string; placement?: string; target?: string };
    if (!d.post || !d.feature) continue;
    byFeature.set(d.feature, (byFeature.get(d.feature) ?? 0) + 1);
    const p = byPost.get(d.post) ?? { total: 0, register: 0, feature: d.feature };
    p.total++;
    if (d.target === "register") p.register++;
    byPost.set(d.post, p);
    if (d.placement === "inline") split.inlineFeature++;
    else if (d.target === "register") split.endRegister++;
    else split.endFeature++;
  }

  const name = (s: string) => FEATURE_PITCHES[s as PromoFeatureSlug]?.name ?? s;
  return NextResponse.json({
    days,
    total: rows.length,
    split,
    features: [...byFeature.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([slug, count]) => ({ slug, name: name(slug), count })),
    posts: [...byPost.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([slug, v]) => ({ slug, ...v, featureName: name(v.feature) })),
  });
}
