export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";
import {
  UNSUB_FEEDBACK_ACTION,
  UNSUB_REASONS,
  unsubReasonLabel,
} from "@/lib/email/unsubscribe-feedback";

/**
 * GET /api/admin/unsubscribe-feedback?days=90 — why people unsubscribed.
 * Read-only. Each answer is tagged with where the address came from (template
 * download, Rotahr account, or other/outreach) so you can see which emails
 * are driving the opt-outs.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const daysParam = Number(new URL(req.url).searchParams.get("days") || 90);
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 730) : 90;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [rows, unsubscribes] = await Promise.all([
    prisma.activityLog.findMany({
      where: { action: UNSUB_FEEDBACK_ACTION, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: { id: true, details: true, createdAt: true },
    }),
    prisma.emailSuppression.count({ where: { createdAt: { gte: since }, revokedAt: null } }).catch(() => null),
  ]);

  const items = rows
    .map((r) => {
      const d = (r.details ?? {}) as { email?: string; reason?: string; comment?: string | null };
      return {
        id: r.id,
        email: d.email ?? "",
        reason: d.reason ?? "other",
        comment: d.comment ?? null,
        createdAt: r.createdAt,
      };
    })
    .filter((i) => i.email);

  const emails = items.map((i) => i.email);
  let leadSet = new Set<string>();
  let userSet = new Set<string>();
  if (emails.length > 0) {
    const [leads, users] = await Promise.all([
      prisma.templateLead
        .findMany({ where: { email: { in: emails } }, select: { email: true } })
        .catch(() => [] as { email: string }[]),
      prisma.user.findMany({
        where: { email: { in: emails, mode: "insensitive" } },
        select: { email: true },
      }),
    ]);
    leadSet = new Set(leads.map((l) => l.email.toLowerCase()));
    userSet = new Set(users.map((u) => (u.email ?? "").toLowerCase()));
  }

  const counts: Record<string, number> = Object.fromEntries(UNSUB_REASONS.map((r) => [r.id, 0]));
  for (const i of items) counts[i.reason] = (counts[i.reason] ?? 0) + 1;

  return NextResponse.json({
    days,
    total: items.length,
    unsubscribes,
    reasons: UNSUB_REASONS.map((r) => ({ id: r.id, label: r.label, count: counts[r.id] ?? 0 })),
    recent: items.slice(0, 40).map((i) => ({
      ...i,
      reasonLabel: unsubReasonLabel(i.reason),
      source: userSet.has(i.email) ? "account" : leadSet.has(i.email) ? "template" : "other",
    })),
  });
}
