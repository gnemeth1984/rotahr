/**
 * Template request queue — platform admin only.
 *
 *   GET   list requests + download counts
 *   PATCH set a status, attach the slug that answered it, and (only when asked)
 *         email the requester that their template is live
 *
 * The email is a separate explicit flag rather than something a status change
 * triggers, because "shipped" gets clicked while tidying the queue and a
 * surprise send to a stranger is not recoverable.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/app/api/inbox/_auth";
import { getTemplate } from "@/lib/templates";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["new", "planned", "shipped", "rejected"];

export async function GET() {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [requests, downloads] = await Promise.all([
    prisma.templateRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.activityLog.findMany({
      where: { action: "template_download", createdAt: { gte: weekAgo } },
      select: { details: true },
      take: 5000,
    }),
  ]);

  const counts = new Map<string, number>();
  for (const row of downloads) {
    const slug = (row.details as { slug?: string } | null)?.slug;
    if (typeof slug === "string") counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  return NextResponse.json({
    requests,
    downloads7d: Array.from(counts.entries())
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count),
  });
}

export async function PATCH(req: Request) {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;

  const body = await req.json().catch(() => ({}));
  const { id, status, fulfilledBy, adminNote, notify } = body as {
    id?: string;
    status?: string;
    fulfilledBy?: string | null;
    adminNote?: string | null;
    notify?: boolean;
  };

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (status && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Unknown status" }, { status: 400 });
  }
  if (fulfilledBy && !getTemplate(fulfilledBy)) {
    return NextResponse.json({ error: "Unknown template slug" }, { status: 400 });
  }

  const existing = await prisma.templateRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let emailResult: { ok: boolean; error: string | null } | null = null;

  if (notify) {
    const slug = fulfilledBy ?? existing.fulfilledBy;
    const tpl = slug ? getTemplate(slug) : null;
    if (!existing.email) {
      return NextResponse.json(
        { error: "That request has no email address." },
        { status: 400 },
      );
    }
    if (!tpl) {
      return NextResponse.json(
        { error: "Attach the template slug that answers this request first." },
        { status: 400 },
      );
    }
    if (existing.notifiedAt) {
      return NextResponse.json(
        { error: "Already emailed on " + existing.notifiedAt.toISOString() },
        { status: 400 },
      );
    }

    const res = await sendEmail({
      to: existing.email,
      subject: `Your template is ready: ${tpl.name}`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;color:#0f1c35;max-width:560px">
          <p>Hi,</p>
          <p>You asked us for a template — &ldquo;${existing.request
            .slice(0, 300)
            .replace(/</g, "&lt;")}&rdquo;. It's live now:</p>
          <p style="margin:20px 0">
            <a href="https://rotahr.com/templates/${tpl.slug}"
               style="background:#ff6b35;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">
              ${tpl.name}
            </a>
          </p>
          <p style="font-size:14px;color:#475569">
            PDF, Excel and CSV, free, no sign-up. Direct downloads:
            <a href="https://rotahr.com/templates/${tpl.slug}.pdf">PDF</a> ·
            <a href="https://rotahr.com/templates/${tpl.slug}.xlsx">Excel</a>
          </p>
          <p style="font-size:14px;color:#475569">
            That's the only email you'll get about this — we don't add template
            requests to any list.
          </p>
          <p style="font-size:14px;color:#475569">Gabor<br>Rotahr — rotahr.com</p>
        </div>`,
      text: `Your template is live: https://rotahr.com/templates/${tpl.slug}\n\nPDF: https://rotahr.com/templates/${tpl.slug}.pdf\nExcel: https://rotahr.com/templates/${tpl.slug}.xlsx\n\nGabor — Rotahr`,
      replyTo: "sales@rotahr.com",
      context: "template-request-fulfilled",
    });
    emailResult = { ok: res.ok, error: res.error };
    if (!res.ok) {
      return NextResponse.json(
        { error: res.error || "Email failed" },
        { status: 502 },
      );
    }
  }

  const updated = await prisma.templateRequest.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(fulfilledBy !== undefined ? { fulfilledBy } : {}),
      ...(adminNote !== undefined ? { adminNote } : {}),
      ...(emailResult?.ok ? { notifiedAt: new Date() } : {}),
    },
  });

  return NextResponse.json({ ok: true, request: updated, emailed: emailResult?.ok ?? false });
}
