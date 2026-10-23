export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { freeTemplates, getTemplate } from "@/lib/templates";
import { CONSENT_DEFAULT_CHECKED, CONSENT_TEXT, VENUE_TYPES } from "@/lib/templates/lead-consent";
import { FINAL_STEP, renderStep, STEP_LABEL, templateEmailsEnabled } from "@/lib/templates/leads";

/**
 * GET /api/admin/template-leads?slug=&venue= — free-template leads and a preview
 * of every email in the follow-up series, rendered for a sample lead. Read-only:
 * there is deliberately no send action here. The series is switched on with
 * TEMPLATE_EMAILS_ENABLED=1 once the emails have been reviewed.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(req.url);
  const slugParam = url.searchParams.get("slug") || "";
  const slug = getTemplate(slugParam) ? slugParam : "weekly-staff-rota";
  const venueParam = url.searchParams.get("venue") || "";
  const venue = VENUE_TYPES.some((v) => v.id === venueParam) ? venueParam : "restaurant";

  const sample = {
    email: "sample@example.com",
    firstSlug: slug,
    lastSlug: slug,
    slugs: [slug],
    venueType: venue,
    marketingConsent: true,
  };
  const previews = Array.from({ length: FINAL_STEP + 1 }, (_, step) => ({
    step,
    label: STEP_LABEL[step],
    ...renderStep(step, sample),
  }));

  let migrated = true;
  let stats: {
    total: number;
    consented: number;
    last7d: number;
    byStatus: Record<string, number>;
    byStep: Record<string, number>;
    topSlugs: { slug: string; leads: number }[];
  } | null = null;
  let recent: unknown[] = [];
  try {
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, consented, last7d, statusRows, stepRows, slugRows, rows] = await Promise.all([
      prisma.templateLead.count(),
      prisma.templateLead.count({ where: { marketingConsent: true } }),
      prisma.templateLead.count({ where: { createdAt: { gte: since7 } } }),
      prisma.templateLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.templateLead.groupBy({ by: ["step"], where: { status: "active" }, _count: { _all: true } }),
      prisma.templateLead.groupBy({ by: ["firstSlug"], _count: { _all: true }, orderBy: { _count: { firstSlug: "desc" } }, take: 8 }),
      prisma.templateLead.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          email: true,
          marketingConsent: true,
          firstSlug: true,
          slugs: true,
          downloads: true,
          venueType: true,
          country: true,
          step: true,
          status: true,
          lastSentAt: true,
          createdAt: true,
        },
      }),
    ]);
    stats = {
      total,
      consented,
      last7d,
      byStatus: Object.fromEntries(statusRows.map((r) => [r.status, r._count._all])),
      byStep: Object.fromEntries(stepRows.map((r) => [String(r.step), r._count._all])),
      topSlugs: slugRows.map((r) => ({ slug: r.firstSlug, leads: r._count._all })),
    };
    recent = rows;
  } catch (e) {
    if ((e as { code?: string })?.code !== "P2021") throw e;
    migrated = false;
  }
  // Leads captured while the table was missing (see app/api/templates/lead).
  const pending = await prisma.activityLog.count({ where: { action: "template_lead_pending" } }).catch(() => 0);

  return NextResponse.json({
    enabled: templateEmailsEnabled(),
    migrated,
    pending,
    consent: { text: CONSENT_TEXT, preTicked: CONSENT_DEFAULT_CHECKED },
    stats,
    recent,
    sample: { slug, venue },
    venueTypes: VENUE_TYPES,
    templates: freeTemplates.map((t) => ({ slug: t.slug, name: t.name })),
    previews,
  });
}
