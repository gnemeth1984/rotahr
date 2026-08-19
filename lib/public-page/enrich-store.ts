// Queue, review and publish enrichment for public venue pages.
//
// The extraction lives in ./enrich. This module is the part that decides what
// actually reaches the open web, and it has one rule: a person ticks each field
// first. Nothing here runs on a cron and nothing publishes itself.
//
// Why so careful: 148 of the 158 pages at /v/<slug> describe venues that are not
// customers and never asked for a page. A wrong opening time on one of those
// pages is not a bug in our product, it is a false statement about someone
// else's business — and Google treats a pile of thin auto-filled pages as spam,
// which would cost the pages that actually sell Rotahr.

import { prisma } from "@/lib/prisma";
import { enrichFromWebsite, type EnrichmentResult, type EnrichedDish } from "./enrich";
import type { OpeningHoursEntry } from "./types";

/** Which fields a reviewer approved. Anything absent stays unpublished. */
export interface ApprovedFields {
  openingHours?: boolean;
  about?: boolean;
  cuisine?: boolean;
  /** Exact dish names the reviewer kept. An empty array publishes no dishes. */
  dishes?: string[];
}

export interface QueueRow {
  id: string;
  businessId: string;
  slug: string;
  name: string;
  status: string;
  hasHours: boolean;
  dishCount: number;
  warningCount: number;
  pagesFetched: number;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  publishedFields: ApprovedFields | null;
  /** What is currently live, so the reviewer can compare rather than trust. */
  current: {
    openingHours: OpeningHoursEntry[] | null;
    about: string | null;
    cuisine: string | null;
    dishCount: number;
    website: string | null;
  };
  proposed: {
    openingHours: OpeningHoursEntry[] | null;
    about: string | null;
    cuisine: string | null;
    dishes: EnrichedDish[];
    pagesFetched: string[];
    provenance: EnrichmentResult["provenance"];
    warnings: string[];
    error?: string;
  };
}

/** Prospect pages worth reading, most useful first. */
export async function enrichmentTargets(limit: number) {
  const pages = await prisma.business.findMany({
    where: {
      publicPageEnabled: true,
      publicProspect: true,
      OR: [{ publicWebsite: { not: null } }, { publicFacebook: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicWebsite: true,
      publicFacebook: true,
      publicOpeningHours: true,
      publicAbout: true,
    },
  });

  const done = new Set(
    (
      await prisma.venueEnrichment.findMany({
        where: { status: { in: ["pending", "published"] } },
        select: { businessId: true },
      })
    ).map((r) => r.businessId)
  );

  // A page with no hours is the one costing us a real answer to a real search,
  // so it goes first.
  const ranked = pages
    .filter((p) => p.publicSlug && !done.has(p.id))
    .map((p) => {
      const hours = Array.isArray(p.publicOpeningHours) ? p.publicOpeningHours.length : 0;
      const thinAbout = (p.publicAbout ?? "").length < 200;
      return { page: p, score: (hours === 0 ? 2 : 0) + (thinAbout ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.page);

  return ranked;
}

/**
 * Read N venues' own sites and queue what was found for review.
 *
 * Sequential on purpose: it is polite to the venues' servers, and a batch that
 * takes two minutes is fine for something a human then has to read anyway.
 */
export async function runEnrichmentBatch(limit: number): Promise<{
  ran: number;
  queued: number;
  empty: number;
  results: { slug: string; name: string; ok: boolean; note: string }[];
}> {
  const targets = await enrichmentTargets(limit);
  const out: { slug: string; name: string; ok: boolean; note: string }[] = [];
  let queued = 0;
  let empty = 0;

  for (const t of targets) {
    // Facebook pages are next to useless for hours from a datacentre IP, but the
    // venue's own site is the only source we trust anyway.
    const website = t.publicWebsite ?? t.publicFacebook;
    if (!website) continue;

    let result: EnrichmentResult;
    try {
      result = await enrichFromWebsite({ slug: t.publicSlug!, website });
    } catch (e) {
      out.push({
        slug: t.publicSlug!,
        name: t.name,
        ok: false,
        note: e instanceof Error ? e.message : "failed",
      });
      continue;
    }

    const status = result.ok ? "pending" : "empty";
    if (result.ok) queued++;
    else empty++;

    await prisma.venueEnrichment.upsert({
      where: { businessId: t.id },
      create: {
        businessId: t.id,
        slug: t.publicSlug!,
        status,
        result: result as unknown as object,
        hasHours: Boolean(result.openingHours?.length),
        dishCount: result.dishes.length,
        warningCount: result.warnings.length,
        pagesFetched: result.pagesFetched.length,
      },
      update: {
        slug: t.publicSlug!,
        status,
        result: result as unknown as object,
        hasHours: Boolean(result.openingHours?.length),
        dishCount: result.dishes.length,
        warningCount: result.warnings.length,
        pagesFetched: result.pagesFetched.length,
        reviewedAt: null,
        reviewedBy: null,
        publishedFields: undefined,
      },
    });

    out.push({
      slug: t.publicSlug!,
      name: t.name,
      ok: result.ok,
      note: result.ok
        ? [
            result.openingHours ? `${new Set(result.openingHours.map((h) => h.day)).size} days of hours` : null,
            result.dishes.length ? `${result.dishes.length} dishes` : null,
            result.cuisine ? `cuisine "${result.cuisine}"` : null,
            result.about ? "about text" : null,
          ]
            .filter(Boolean)
            .join(", ")
        : (result.error ?? "nothing found"),
    });
  }

  return { ran: targets.length, queued, empty, results: out };
}

/** The review queue, with what is live beside what is proposed. */
export async function enrichmentQueue(status: string, limit = 60): Promise<QueueRow[]> {
  const rows = await prisma.venueEnrichment.findMany({
    where: status === "all" ? {} : { status },
    orderBy: [{ hasHours: "desc" }, { createdAt: "asc" }],
    take: limit,
  });
  if (rows.length === 0) return [];

  const businesses = await prisma.business.findMany({
    where: { id: { in: rows.map((r) => r.businessId) } },
    select: {
      id: true,
      name: true,
      publicAbout: true,
      publicOpeningHours: true,
      publicWebsite: true,
      venues: { take: 1, select: { cuisine: true } },
      _count: { select: { dishes: true } },
    },
  });
  const byId = new Map(businesses.map((b) => [b.id, b]));

  return rows.map((r) => {
    const b = byId.get(r.businessId);
    const proposed = r.result as unknown as EnrichmentResult;
    const live = Array.isArray(b?.publicOpeningHours)
      ? (b!.publicOpeningHours as unknown as OpeningHoursEntry[])
      : null;
    return {
      id: r.id,
      businessId: r.businessId,
      slug: r.slug,
      name: b?.name ?? r.slug,
      status: r.status,
      hasHours: r.hasHours,
      dishCount: r.dishCount,
      warningCount: r.warningCount,
      pagesFetched: r.pagesFetched,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewedBy: r.reviewedBy,
      publishedFields: (r.publishedFields as ApprovedFields | null) ?? null,
      current: {
        openingHours: live,
        about: b?.publicAbout ?? null,
        cuisine: b?.venues[0]?.cuisine ?? null,
        dishCount: b?._count.dishes ?? 0,
        website: b?.publicWebsite ?? null,
      },
      proposed: {
        openingHours: proposed?.openingHours ?? null,
        about: proposed?.about ?? null,
        cuisine: proposed?.cuisine ?? null,
        dishes: proposed?.dishes ?? [],
        pagesFetched: proposed?.pagesFetched ?? [],
        provenance: proposed?.provenance ?? {},
        warnings: proposed?.warnings ?? [],
        error: proposed?.error,
      },
    };
  });
}

/**
 * Publish only the ticked fields.
 *
 * Dishes are matched by exact name against what was extracted, so a stale form
 * cannot smuggle in an item nobody read.
 */
export async function publishEnrichment(
  id: string,
  approved: ApprovedFields,
  reviewer: string
): Promise<{ ok: boolean; published: string[]; error?: string }> {
  const row = await prisma.venueEnrichment.findUnique({ where: { id } });
  if (!row) return { ok: false, published: [], error: "not found" };

  const found = row.result as unknown as EnrichmentResult;
  const published: string[] = [];
  const businessUpdate: Record<string, unknown> = {};

  if (approved.openingHours && found.openingHours?.length) {
    businessUpdate.publicOpeningHours = found.openingHours as unknown as object[];
    published.push("openingHours");
  }
  if (approved.about && found.about) {
    businessUpdate.publicAbout = found.about;
    published.push("about");
  }

  const keepNames = new Set(approved.dishes ?? []);
  const dishes = (found.dishes ?? []).filter((d) => keepNames.has(d.name));

  await prisma.$transaction(async (tx) => {
    if (Object.keys(businessUpdate).length) {
      await tx.business.update({ where: { id: row.businessId }, data: businessUpdate });
    }

    if (approved.cuisine && found.cuisine) {
      const venue = await tx.venue.findFirst({
        where: { businessId: row.businessId },
        select: { id: true },
      });
      if (venue) {
        await tx.venue.update({ where: { id: venue.id }, data: { cuisine: found.cuisine } });
        published.push("cuisine");
      }
    }

    if (dishes.length) {
      // Replace rather than append, so approving twice cannot double the menu.
      await tx.dish.deleteMany({ where: { businessId: row.businessId } });
      await tx.dish.createMany({
        data: dishes.map((d) => ({
          businessId: row.businessId,
          name: d.name.slice(0, 120),
          description: d.description?.slice(0, 500) ?? null,
          category: d.category,
          sellPrice: d.price,
          active: true,
        })),
      });
      await tx.business.update({
        where: { id: row.businessId },
        data: { publicShowMenu: true },
      });
      published.push(`${dishes.length} dishes`);
    }

    await tx.venueEnrichment.update({
      where: { id },
      data: {
        status: "published",
        publishedFields: { ...approved, dishes: dishes.map((d) => d.name) } as unknown as object,
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      },
    });
  });

  // Traceable in the same feed as everything else that changes a page.
  await prisma.activityLog
    .create({
      data: {
        action: "venue_enrichment_published",
        businessId: row.businessId,
        userName: reviewer,
        details: { slug: row.slug, fields: published },
      },
    })
    .catch(() => {});

  return { ok: true, published };
}

export async function rejectEnrichment(id: string, reviewer: string) {
  await prisma.venueEnrichment.update({
    where: { id },
    data: { status: "rejected", reviewedBy: reviewer, reviewedAt: new Date() },
  });
  return { ok: true };
}
