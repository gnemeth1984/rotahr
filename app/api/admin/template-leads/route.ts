export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import { freeTemplates, getTemplate } from "@/lib/templates";
import { CONSENT_DEFAULT_CHECKED, CONSENT_TEXT, VENUE_TYPES } from "@/lib/templates/lead-consent";
import {
  FINAL_STEP,
  leadHistory,
  planLead,
  renderStep,
  sendLeadStepNow,
  skipLeadStep,
  STEP_LABEL,
  templateEmailsEnabled,
} from "@/lib/templates/leads";

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) return null;
  return session;
}

/**
 * GET /api/admin/template-leads?slug=&venue= — free-template leads, what each
 * one has been sent and which email is next, plus a preview of every email in
 * the series rendered for a sample lead.
 * GET /api/admin/template-leads?lead=<id> — that lead's next email, rendered.
 * Sending happens only on POST, on an explicit admin click.
 */
export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);

  const leadId = url.searchParams.get("lead");
  if (leadId) {
    const lead = await prisma.templateLead.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    const plan = await planLead(lead);
    if (plan.nextStep === null) return NextResponse.json({ plan, email: null });
    return NextResponse.json({ to: lead.email, plan, email: renderStep(plan.nextStep, lead) });
  }

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
      prisma.templateLead.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    stats = {
      total,
      consented,
      last7d,
      byStatus: Object.fromEntries(statusRows.map((r) => [r.status, r._count._all])),
      byStep: Object.fromEntries(stepRows.map((r) => [String(r.step), r._count._all])),
      topSlugs: slugRows.map((r) => ({ slug: r.firstSlug, leads: r._count._all })),
    };
    const oldest = rows.length ? rows[rows.length - 1].createdAt : new Date();
    const history = await leadHistory(rows.map((r) => r.id), oldest);
    recent = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        email: r.email,
        marketingConsent: r.marketingConsent,
        firstSlug: r.firstSlug,
        slugs: r.slugs,
        downloads: r.downloads,
        venueType: r.venueType,
        country: r.country,
        step: r.step,
        status: r.status,
        lastSentAt: r.lastSentAt,
        createdAt: r.createdAt,
        plan: await planLead(r),
        history: history[r.id] ?? [],
      })),
    );
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

/**
 * POST /api/admin/template-leads { action: "send" | "skip", leadId, step, early? }
 * Send (or skip) ONE lead's next email on an explicit admin click. Re-checks
 * server-side: refuses if the lead has moved on, is unsubscribed, has no
 * consent for follow-ups or is already a customer. Sending before the
 * scheduled day needs early: true.
 */
export async function POST(req: NextRequest) {
  const session = await requireSuperAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as {
    action?: unknown;
    leadId?: unknown;
    step?: unknown;
    early?: unknown;
  };
  const leadId = typeof body.leadId === "string" ? body.leadId : "";
  const step = typeof body.step === "number" && Number.isInteger(body.step) ? body.step : -1;
  if (!leadId || step < 0 || step > FINAL_STEP || (body.action !== "send" && body.action !== "skip")) {
    return NextResponse.json({ error: "action (send|skip), leadId and step are required" }, { status: 400 });
  }
  const sentBy = session.user?.email ?? null;
  const res =
    body.action === "send"
      ? await sendLeadStepNow({ leadId, step, early: body.early === true, sentBy })
      : await skipLeadStep({ leadId, step, sentBy });
  return NextResponse.json(res, { status: res.ok ? 200 : 409 });
}
