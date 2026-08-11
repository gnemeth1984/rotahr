/**
 * GET  /api/admin/links — the off-site visibility pipeline.
 * PATCH /api/admin/links — update one row's status / live URL / notes.
 *
 * There is deliberately no send action. Every row is a real editor,
 * association or directory whose attention is spent once. The pipeline records
 * what was asked and what came back; a human does the asking.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/seo/auth";

export const dynamic = "force-dynamic";

const STATUSES = ["new", "queued", "sent", "live", "rejected", "no_reply"] as const;

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.linkProspect.findMany({
    orderBy: [{ status: "asc" }, { weight: "desc" }, { name: "asc" }],
  });

  const byStatus: Record<string, number> = {};
  for (const s of STATUSES) byStatus[s] = 0;
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

  // Follow-ups that are due. A pitch with no reply and no follow-up is the
  // most common way this kind of work quietly dies.
  const now = Date.now();
  const dueFollowUps = rows.filter(
    (r) => r.status === "sent" && r.followUpAt && r.followUpAt.getTime() <= now,
  ).length;

  return NextResponse.json({
    rows,
    stats: {
      total: rows.length,
      byStatus,
      live: byStatus.live ?? 0,
      dueFollowUps,
      // The only number that matters: links actually earned.
      liveUrls: rows.filter((r) => r.status === "live" && r.liveUrl).map((r) => r.liveUrl),
    },
  });
}

export async function PATCH(req: Request) {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.status === "string") {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json({ error: `status must be one of ${STATUSES.join(", ")}` }, { status: 400 });
    }
    data.status = body.status;

    // Timestamps follow from the status rather than being set by hand, so the
    // record can't drift out of step with itself.
    if (body.status === "sent") {
      data.sentAt = new Date();
      // Two weeks is long enough not to nag an editor and short enough that the
      // thread is still recognisable.
      data.followUpAt = new Date(Date.now() + 14 * 864e5);
    }
    if (body.status === "live") {
      data.liveAt = new Date();
      data.followUpAt = null;
    }
    if (body.status === "rejected" || body.status === "no_reply") {
      data.followUpAt = null;
    }
  }

  if (typeof body.liveUrl === "string") {
    const v = body.liveUrl.trim();
    if (v && !/^https?:\/\//i.test(v)) {
      return NextResponse.json({ error: "liveUrl must be an absolute http(s) URL" }, { status: 400 });
    }
    data.liveUrl = v || null;
  }

  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 4000) || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const row = await prisma.linkProspect.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true, row });
}
