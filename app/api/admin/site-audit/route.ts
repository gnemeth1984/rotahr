/**
 * Site audit API — platform admin only.
 *
 * POST { domain } runs a fresh audit and stores it.
 * GET  ?domain=  returns audit history; GET ?id= returns one full report.
 *
 * Gated on isPlatformAdmin, never on role: every business owner is role ADMIN
 * inside their own business, so a role check would hand a customer a crawler
 * they could point at arbitrary third-party domains from our IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { auditSite, normaliseDomain } from "@/lib/seo/audit";
import { isPlatformAdmin } from "@/lib/seo/auth";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const domain = url.searchParams.get("domain");

  if (id) {
    const audit = await prisma.siteAudit.findUnique({ where: { id } });
    if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ audit });
  }

  const history = await prisma.siteAudit.findMany({
    where: domain ? { domain } : undefined,
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      domain: true,
      origin: true,
      score: true,
      pagesCrawled: true,
      issueCount: true,
      criticalCount: true,
      warningCount: true,
      performance: true,
      lcp: true,
      cls: true,
      durationMs: true,
      createdAt: true,
    },
  });

  // Distinct domains audited, for the quick-pick list in the UI.
  const domains = await prisma.siteAudit.groupBy({
    by: ["domain"],
    _count: { domain: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: 20,
  });

  return NextResponse.json({
    history,
    domains: domains.map((d) => ({
      domain: d.domain,
      runs: d._count.domain,
      lastRun: d._max.createdAt,
    })),
    psiConfigured: Boolean(process.env.PAGESPEED_API_KEY),
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isPlatformAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { domain?: string; maxPages?: number; skipPsi?: boolean; strategy?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body.domain ?? "").trim();
  if (!raw) return NextResponse.json({ error: "A domain is required." }, { status: 400 });

  const norm = normaliseDomain(raw);
  if (!norm) {
    return NextResponse.json({ error: `"${raw}" doesn't look like a valid domain.` }, { status: 400 });
  }

  // Block obvious internal targets so this can't be used to probe our own
  // infrastructure or a private network from the server's vantage point.
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(norm.host)) {
    return NextResponse.json({ error: "Private and loopback hosts cannot be audited." }, { status: 400 });
  }

  const maxPages = Math.min(Math.max(Number(body.maxPages) || 25, 1), 60);
  const strategy = body.strategy === "desktop" ? "desktop" : "mobile";

  try {
    const report = await auditSite(norm.origin, {
      maxPages,
      // Leave headroom inside maxDuration for PSI and the DB write.
      crawlBudgetMs: 90000,
      skipPsi: body.skipPsi === true,
      psiStrategy: strategy,
    });

    const saved = await prisma.siteAudit.create({
      data: {
        domain: report.domain,
        origin: report.origin,
        score: report.score,
        pagesCrawled: report.pagesCrawled,
        issueCount: report.issues.length,
        criticalCount: report.issues.filter((i) => i.severity === "critical").length,
        warningCount: report.issues.filter((i) => i.severity === "warning").length,
        performance: report.psi?.performance ?? null,
        lcp: report.psi?.lcp ?? null,
        cls: report.psi?.cls ?? null,
        report: report as unknown as object,
        durationMs: report.durationMs,
        runById: session.user.id ?? null,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, id: saved.id, report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[site-audit]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
