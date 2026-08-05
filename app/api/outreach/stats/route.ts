export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { prisma } from "@/lib/db";
import { getSentToday, DEFAULT_DAILY_LIMIT } from "@/lib/outreach/sender";
import { isBrevoConfigured, checkSenderDomain, outreachFromEmail } from "@/lib/outreach/brevo";

/**
 * Shape is kept identical to what the old Railway service returned, so the
 * existing dashboard keeps working unchanged. Engagement fields are additive.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const [byStatus, byCountry, bySegment, total, sends, opened, clicked, failed, suppressed, sentToday] =
    await Promise.all([
      prisma.outreachLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.outreachLead.groupBy({ by: ["country"], _count: { _all: true } }),
      prisma.outreachLead.groupBy({ by: ["segment"], _count: { _all: true } }),
      prisma.outreachLead.count(),
      prisma.outreachSend.count(),
      prisma.outreachSend.count({ where: { opened: true } }),
      prisma.outreachSend.count({ where: { clicked: true } }),
      prisma.outreachSend.count({ where: { failedAt: { not: null } } }),
      prisma.emailSuppression.count({ where: { revokedAt: null } }),
      getSentToday(),
    ]);

  // Surfaced so the dashboard can block sending rather than let it fail silently.
  const domain = isBrevoConfigured()
    ? await checkSenderDomain()
    : { domain: outreachFromEmail().split("@")[1] ?? "", authenticated: false, missing: [] };

  const s = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Record<
    string,
    number
  >;

  return NextResponse.json({
    total,
    new_count: s.new ?? 0,
    contacted: s.contacted ?? 0,
    followup1: s.followup_1 ?? 0,
    followup2: s.followup_2 ?? 0,
    followup3: s.followup_3 ?? 0,
    replied: s.replied ?? 0,
    cold: s.cold ?? 0,
    unsubscribed: s.unsubscribed ?? 0,
    bounced: s.bounced ?? 0,
    sentToday,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    // Batches now run inline inside the request, so there is no separate
    // background job that could be "running" between polls.
    batchRunning: false,
    byCountry: byCountry
      .map((r) => ({ country: r.country, cnt: r._count._all }))
      .sort((a, b) => b.cnt - a.cnt),
    bySegment: bySegment
      .map((r) => ({ segment: r.segment, cnt: r._count._all }))
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, 8),
    totalSends: sends,
    opened,
    clicked,
    failed,
    openRate: sends ? Math.round((opened / sends) * 1000) / 10 : 0,
    clickRate: sends ? Math.round((clicked / sends) * 1000) / 10 : 0,
    suppressed,
    brevoConfigured: isBrevoConfigured(),
    fromEmail: outreachFromEmail(),
    domainAuthenticated: domain.authenticated,
    domainMissingRecords: domain.missing,
    domainError: "error" in domain ? domain.error : undefined,
    updatedAt: new Date().toISOString(),
  });
}
