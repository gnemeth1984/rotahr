import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BLOG_FEATURE_CLICK_ACTION, PROMO_FEATURE_SLUGS } from "@/lib/blog/feature-promo";

export const dynamic = "force-dynamic";

const BOT_UA = /bot|crawl|spider|slurp|preview|fetch|headless|monitor|curl|wget|python|axios/i;

/**
 * POST /api/blog/feature-click { post, feature, placement, target }
 * Counts clicks on the feature promo under blog articles. No cookies, no IP,
 * no personal data stored. Always answers 204 so it can never break a page.
 */
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

    const text = await req.text();
    if (text.length > 1000) return new NextResponse(null, { status: 204 });
    const body = JSON.parse(text || "{}");
    const post = typeof body?.post === "string" ? body.post : "";
    const feature = typeof body?.feature === "string" ? body.feature : "";
    const placement = body?.placement === "inline" || body?.placement === "end" ? body.placement : null;
    const target = body?.target === "feature" || body?.target === "register" ? body.target : null;
    if (
      !/^[a-z0-9-]{1,160}$/.test(post) ||
      !(PROMO_FEATURE_SLUGS as readonly string[]).includes(feature) ||
      !placement ||
      !target
    ) {
      return new NextResponse(null, { status: 204 });
    }
    await prisma.activityLog.create({
      data: { action: BLOG_FEATURE_CLICK_ACTION, details: { post, feature, placement, target } },
    });
  } catch {
    // ignore — tracking must never fail loudly
  }
  return new NextResponse(null, { status: 204 });
}
