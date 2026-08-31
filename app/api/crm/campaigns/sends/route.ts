import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sendApprovedSends } from "@/lib/crm/campaigns";
import { logActivity } from "@/lib/services/activity.service";

/**
 * Review queue for a campaign.
 *
 * GET lists the drafts, PATCH approves or parks rows, POST delivers whatever has
 * been approved. Approval is deliberately a separate step from building drafts:
 * nothing reaches a guest without somebody ticking it first.
 */

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

const patchSchema = z.object({
  campaignId: z.string().min(1),
  action: z.enum(["approve", "unapprove", "skip", "delete"]),
  ids: z.array(z.string().min(1)).max(500).optional(),
  all: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200"), 500);

  const where: any = { businessId };
  if (campaignId) where.campaignId = campaignId;
  if (status) where.status = status;

  const [sends, groups] = await Promise.all([
    prisma.campaignSend.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
      select: {
        id: true,
        campaignId: true,
        customerId: true,
        channel: true,
        toAddress: true,
        subject: true,
        body: true,
        status: true,
        skipReason: true,
        approvedAt: true,
        sentAt: true,
        errorMessage: true,
        createdAt: true,
        customer: { select: { id: true, name: true, loyaltyTier: true, totalSpend: true } },
        campaign: { select: { id: true, name: true, channel: true } },
      },
    }),
    prisma.campaignSend.groupBy({
      by: ["status"],
      where: campaignId ? { businessId, campaignId } : { businessId },
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    sends,
    counts: Object.fromEntries(groups.map((g) => [g.status, g._count._all])),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { campaignId, action, ids, all } = parsed.data;

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    select: { id: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  if (!all && (!ids || ids.length === 0))
    return NextResponse.json({ error: "Nothing selected" }, { status: 400 });

  // Sent rows are history and are never re-touched by an approval action.
  const base: any = { businessId, campaignId, status: { in: ["draft", "approved", "skipped"] } };
  if (!all) base.id = { in: ids };

  let result: { count: number };
  if (action === "approve") {
    result = await prisma.campaignSend.updateMany({
      where: { ...base, status: "draft" },
      data: {
        status: "approved",
        approvedById: session!.user.id ?? null,
        approvedAt: new Date(),
      },
    });
  } else if (action === "unapprove") {
    result = await prisma.campaignSend.updateMany({
      where: { ...base, status: "approved" },
      data: { status: "draft", approvedById: null, approvedAt: null },
    });
  } else if (action === "skip") {
    result = await prisma.campaignSend.updateMany({
      where: { ...base, status: { in: ["draft", "approved"] } },
      data: { status: "skipped", skipReason: "duplicate", approvedAt: null, approvedById: null },
    });
  } else {
    result = await prisma.campaignSend.deleteMany({
      where: { ...base, status: { in: ["draft", "skipped"] } },
    });
  }

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: `crm_campaign_sends_${action}`,
    details: { count: result.count },
  });

  return NextResponse.json({ ok: true, count: result.count });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const campaignId = new URL(req.url).searchParams.get("campaignId");
  if (!campaignId) return NextResponse.json({ error: "Missing campaignId" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, businessId },
    select: { id: true, name: true, channel: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

  const approved = await prisma.campaignSend.count({
    where: { businessId, campaignId, status: "approved" },
  });
  if (approved === 0)
    return NextResponse.json(
      { error: "Nothing is approved yet. Tick the messages you want to send first." },
      { status: 400 }
    );

  let result;
  try {
    result = await sendApprovedSends(businessId, campaignId, {
      userId: session!.user.id,
      userName: session!.user.name,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Send failed" }, { status: 500 });
  }

  if (result.blocked) {
    return NextResponse.json({ ...result, message: result.blocked }, { status: 400 });
  }

  const remaining = await prisma.campaignSend.count({
    where: { businessId, campaignId, status: { in: ["draft", "approved"] } },
  });
  if (remaining === 0) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "sent" } });
  }

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_campaign_sent",
    details: { sent: result.sent, failed: result.failed, channel: campaign.channel },
  });

  return NextResponse.json({
    ...result,
    message: `${result.sent} message(s) sent${result.failed ? `, ${result.failed} failed` : ""}.`,
  });
}
