import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/app/api/inbox/_auth";
import {
  runEnrichmentBatch,
  enrichmentQueue,
  publishEnrichment,
  rejectEnrichment,
  type ApprovedFields,
} from "@/lib/public-page/enrich-store";

/**
 * Venue page enrichment: read a venue's own site, then approve field by field.
 *
 * `run` only queues. Publishing is a separate, explicit call with the exact
 * fields ticked, because these pages carry other businesses' names and an
 * unreviewed scraped opening time is a false statement about a real venue.
 */

export const maxDuration = 300;

export async function GET(req: Request) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const rows = await enrichmentQueue(status);
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const { error, session } = await requirePlatformAdmin();
  if (error) return error;
  const reviewer = session!.user!.email!;

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
    limit?: number;
    approved?: ApprovedFields;
  };

  if (body.action === "run") {
    // Capped: each venue is several page fetches and several model calls, and a
    // runaway batch would hammer other people's websites.
    const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 15);
    const summary = await runEnrichmentBatch(limit);
    return NextResponse.json(summary);
  }

  if (body.action === "publish") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const approved: ApprovedFields = {
      openingHours: Boolean(body.approved?.openingHours),
      about: Boolean(body.approved?.about),
      cuisine: Boolean(body.approved?.cuisine),
      dishes: Array.isArray(body.approved?.dishes) ? body.approved!.dishes!.map(String) : [],
    };
    const res = await publishEnrichment(body.id, approved, reviewer);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  if (body.action === "reject") {
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
    return NextResponse.json(await rejectEnrichment(body.id, reviewer));
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
