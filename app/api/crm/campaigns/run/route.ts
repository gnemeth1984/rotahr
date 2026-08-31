import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildCampaignDrafts } from "@/lib/crm/campaigns";
import { logActivity } from "@/lib/services/activity.service";

/**
 * Build the draft sends for a campaign.
 *
 * This never delivers anything. It resolves the segment, renders a message per
 * guest and writes CampaignSend rows with status "draft" (or "skipped" with a
 * reason). Delivery is a separate, explicit approval step.
 */

function guard(session: any) {
  if (!session?.user?.businessId) return { error: "Unauthorized", status: 401 };
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return { error: "Forbidden", status: 403 };
  return null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const bad = guard(session);
  if (bad) return NextResponse.json({ error: bad.error }, { status: bad.status });
  const businessId = session!.user.businessId as string;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const campaign = await prisma.campaign.findFirst({
    where: { id, businessId },
    select: { id: true, name: true, segment: true, segmentTag: true, channel: true },
  });
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let result;
  try {
    result = await buildCampaignDrafts(businessId, id, { tag: campaign.segmentTag });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Could not build drafts" }, { status: 500 });
  }

  await prisma.campaign.update({
    where: { id },
    data: { lastRunAt: new Date(), status: result.drafted > 0 ? "review" : undefined },
  });

  await logActivity({
    businessId,
    userId: session!.user.id,
    userName: session!.user.name,
    action: "crm_campaign_drafts_built",
    details: { drafted: result.drafted, skipped: result.skipped, duplicates: result.duplicates },
  });

  return NextResponse.json({
    ...result,
    message:
      result.drafted > 0
        ? `${result.drafted} draft message(s) ready to review. Nothing has been sent.`
        : "No new drafts. Everyone matching is either already queued or not contactable.",
  });
}
