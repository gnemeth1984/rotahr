/**
 * Daily cron: keep the CRM rollups honest, then queue automation drafts.
 *
 * Two jobs, in order:
 *
 *  1. Recompute every guest's visit count, lifetime spend, average spend, last
 *     visit, favourite dishes, points and tier for any business that has guests.
 *     A tier that only moves when somebody happens to open a page is not a tier,
 *     so the truth is rebuilt here nightly.
 *
 *  2. For each active campaign carrying an automationRule, build draft sends.
 *
 * This route NEVER sends anything. Gabor's instruction stands: automations queue
 * drafts and a human approves them. Every draft is written with a dedupeKey of
 * rule + guest + period stamp, so re-running the cron (or a manager re-running
 * the campaign by hand) can never queue the same guest twice in the same period.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCronRun } from "@/lib/cron-run";
import { recomputeBusinessStats } from "@/lib/crm/stats";
import { buildCampaignDrafts } from "@/lib/crm/campaigns";

/** Period stamp: how often this rule is allowed to reach the same guest. */
function periodFor(rule: string, segment: string, now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  if (rule === "birthday") {
    // A birthday comes round once a year. Month stamp for the "birthday this
    // month" segment, week stamp for the tighter "birthday this week" one.
    return segment === "birthday_week" ? `${year}-W${isoWeek(now)}` : `${year}-${month}`;
  }
  if (rule === "no_visit_30") {
    // Weekly at most: a lapsed guest should not get a nudge every night.
    return `${year}-W${isoWeek(now)}`;
  }
  if (rule === "tier_upgrade") {
    // Once ever per guest per tier, so arriving in a tier is what triggers it.
    return `tier:${segment}`;
  }
  // high_spender and anything else: once a month.
  return `${year}-${month}`;
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return String(week).padStart(2, "0");
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return withCronRun("crm_automations", async () => {
    const now = new Date();

    // Only businesses that actually have guests. Most do not, and recomputing
    // 160 empty venues nightly is pure Neon compute for nothing.
    const withGuests = await prisma.customer.groupBy({
      by: ["businessId"],
      _count: { _all: true },
    });

    let guestsUpdated = 0;
    let upgrades = 0;
    const businessesTouched: string[] = [];

    for (const row of withGuests) {
      try {
        const res = await recomputeBusinessStats(row.businessId);
        guestsUpdated += res.updated;
        upgrades += res.upgrades.length;
        businessesTouched.push(row.businessId);
      } catch (err) {
        console.error("[crm-automations] recompute failed for", row.businessId, err);
      }
    }

    // Automations: active campaigns with a rule, in businesses that have guests.
    const campaigns = await prisma.campaign.findMany({
      where: {
        active: true,
        automationRule: { not: null },
        status: { notIn: ["cancelled", "paused"] },
        businessId: { in: businessesTouched.length ? businessesTouched : ["__none__"] },
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        segment: true,
        segmentTag: true,
        channel: true,
        automationRule: true,
      },
      take: 500,
    });

    let drafted = 0;
    let skipped = 0;
    let duplicates = 0;
    const perCampaign: { id: string; name: string; drafted: number; skipped: number }[] = [];

    for (const c of campaigns) {
      try {
        const period = periodFor(c.automationRule as string, c.segment, now);
        const res = await buildCampaignDrafts(c.businessId, c.id, {
          period,
          tag: c.segmentTag,
        });
        drafted += res.drafted;
        skipped += res.skipped;
        duplicates += res.duplicates;
        perCampaign.push({ id: c.id, name: c.name, drafted: res.drafted, skipped: res.skipped });

        await prisma.campaign.update({
          where: { id: c.id },
          data: {
            lastRunAt: now,
            ...(res.drafted > 0 ? { status: "review" } : {}),
          },
        });
      } catch (err) {
        console.error("[crm-automations] campaign failed", c.id, err);
      }
    }

    return {
      businesses: businessesTouched.length,
      guestsUpdated,
      tierUpgrades: upgrades,
      campaignsRun: campaigns.length,
      drafted,
      skipped,
      duplicates,
      perCampaign,
      sent: 0,
      note: "Drafts only. Nothing is delivered by this job.",
    };
  }).then(
    (out) => NextResponse.json({ ok: true, ...out }),
    (err) =>
      NextResponse.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      )
  );
}
