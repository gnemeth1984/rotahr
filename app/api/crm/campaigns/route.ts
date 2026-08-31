import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { SEGMENTS } from "@/lib/crm/segments";
import { logActivity } from "@/lib/services/activity.service";

/**
 * Marketing campaigns.
 *
 * A campaign is a segment plus a message. Creating or editing one never queues
 * or sends anything: /run builds draft sends, a manager approves them, and only
 * then does /sends POST deliver. Nothing on this route can reach a guest.
 */

const AUTOMATION_RULES = ["no_visit_30", "birthday", "high_spender", "tier_upgrade"] as const;
const CHANNELS = ["email", "sms"] as const;
const STATUSES = ["draft", "scheduled", "review", "sent", "paused", "cancelled"] as const;

const bodySchema = z.object({
  name: z.string().min(1).max(120),
  segment: z.string().refine((s) => SEGMENTS.some((seg) => seg.key === s), "Unknown segment"),
  channel: z.enum(CHANNELS).default("email"),
  subject: z.string().max(200).optional().nullable(),
  message: z.string().min(1).max(8000),
  scheduleAt: z.string().optional().nullable(),
  status: z.enum(STATUSES).optional(),
  automationRule: z.enum(AUTOMATION_RULES).optional().nullable(),
  active: z.boolean().optional(),
  segmentTag: z.string().max(60).optional().nullable(),
});

const patchSchema = bodySchema.partial();

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

function parseSchedule(raw: string | null | undefined): Date | null | "invalid" {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "invalid" : d;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const campaign = await prisma.campaign.findFirst({
      where: { id, businessId },
      include: { _count: { select: { sends: true } } },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const sendCounts = await prisma.campaignSend.groupBy({
      by: ["status"],
      where: { campaignId: id, businessId },
      _count: { _all: true },
    });
    return NextResponse.json({
      campaign,
      sendCounts: Object.fromEntries(sendCounts.map((s) => [s.status, s._count._all])),
    });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { businessId },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { _count: { select: { sends: true } } },
  });

  const counts = await prisma.campaignSend.groupBy({
    by: ["campaignId", "status"],
    where: { businessId },
    _count: { _all: true },
  });

  const byCampaign: Record<string, Record<string, number>> = {};
  for (const c of counts) {
    byCampaign[c.campaignId] = byCampaign[c.campaignId] || {};
    byCampaign[c.campaignId][c.status] = c._count._all;
  }

  return NextResponse.json({
    campaigns: campaigns.map((c) => ({ ...c, sendCounts: byCampaign[c.id] ?? {} })),
    segments: SEGMENTS,
    automationRules: AUTOMATION_RULES,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const schedule = parseSchedule(d.scheduleAt);
  if (schedule === "invalid") return NextResponse.json({ error: "Invalid schedule date" }, { status: 400 });

  if (d.channel === "email" && !d.subject?.trim())
    return NextResponse.json({ error: "Email campaigns need a subject" }, { status: 400 });

  // One automation per rule keeps the cron predictable.
  if (d.automationRule) {
    const clash = await prisma.campaign.findFirst({
      where: { businessId, automationRule: d.automationRule, active: true },
      select: { id: true, name: true },
    });
    if (clash)
      return NextResponse.json(
        { error: `"${clash.name}" already runs that automation. Pause it first.` },
        { status: 409 }
      );
  }

  const campaign = await prisma.campaign.create({
    data: {
      businessId,
      name: d.name.trim(),
      segment: d.segment,
      channel: d.channel,
      subject: d.subject?.trim() || null,
      message: d.message,
      scheduleAt: schedule,
      status: d.status ?? "draft",
      automationRule: d.automationRule ?? null,
      active: d.active ?? Boolean(d.automationRule),
      segmentTag: d.segmentTag?.trim() || null,
      createdById: session!.user.id ?? null,
      createdBy: session!.user.name ?? null,
    },
  });

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_campaign_created",
    details: { segment: d.segment, channel: d.channel, automation: d.automationRule ?? null },
  });

  return NextResponse.json({ campaign }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.campaign.findFirst({ where: { id, businessId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const data: any = {};
  if (d.name !== undefined) data.name = d.name.trim();
  if (d.segment !== undefined) data.segment = d.segment;
  if (d.channel !== undefined) data.channel = d.channel;
  if (d.subject !== undefined) data.subject = d.subject?.trim() || null;
  if (d.message !== undefined) data.message = d.message;
  if (d.status !== undefined) data.status = d.status;
  if (d.active !== undefined) data.active = d.active;
  if (d.segmentTag !== undefined) data.segmentTag = d.segmentTag?.trim() || null;
  if (d.automationRule !== undefined) data.automationRule = d.automationRule ?? null;
  if (d.scheduleAt !== undefined) {
    const schedule = parseSchedule(d.scheduleAt);
    if (schedule === "invalid") return NextResponse.json({ error: "Invalid schedule date" }, { status: 400 });
    data.scheduleAt = schedule;
  }

  const channel = data.channel ?? existing.channel;
  const subject = data.subject !== undefined ? data.subject : existing.subject;
  if (channel === "email" && !subject?.trim())
    return NextResponse.json({ error: "Email campaigns need a subject" }, { status: 400 });

  const rule = data.automationRule !== undefined ? data.automationRule : existing.automationRule;
  const active = data.active !== undefined ? data.active : existing.active;
  if (rule && active) {
    const clash = await prisma.campaign.findFirst({
      where: { businessId, automationRule: rule, active: true, id: { not: id } },
      select: { name: true },
    });
    if (clash)
      return NextResponse.json(
        { error: `"${clash.name}" already runs that automation. Pause it first.` },
        { status: 409 }
      );
  }

  const campaign = await prisma.campaign.update({ where: { id }, data });

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_campaign_updated",
    details: { fields: Object.keys(data) },
  });

  return NextResponse.json({ campaign });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const existing = await prisma.campaign.findFirst({
    where: { id, businessId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sent = await prisma.campaignSend.count({ where: { campaignId: id, status: "sent" } });
  if (sent > 0) {
    // Delivered messages are a record of what a guest was told. Keep the history.
    const campaign = await prisma.campaign.update({
      where: { id },
      data: { status: "cancelled", active: false },
    });
    await prisma.campaignSend.deleteMany({ where: { campaignId: id, status: { in: ["draft", "approved"] } } });
    return NextResponse.json({
      campaign,
      archived: true,
      message: `Campaign archived rather than deleted: ${sent} message(s) were already sent and the history is kept.`,
    });
  }

  await prisma.campaign.delete({ where: { id } });

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_campaign_deleted",
    details: {},
  });

  return NextResponse.json({ ok: true });
}
