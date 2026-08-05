export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { runBatch } from "@/lib/outreach/sender";

/**
 * Runs a batch inline and awaits it. Fire-and-forget is not an option: a
 * serverless function is frozen the moment it responds, which silently drops
 * whatever sends were still in flight.
 *
 * A real send requires `confirm: true`. Without it the batch is a dry run that
 * reports exactly who would be contacted with which subject — these are cold
 * emails to strangers, so the safe default is to show, not send.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as {
    country?: string;
    segment?: string;
    limit?: number;
    confirm?: boolean;
    emails?: string[];
  };

  const dryRun = body.confirm !== true;

  const result = await runBatch({
    country: body.country && body.country !== "all" ? body.country : null,
    segment: body.segment && body.segment !== "all" ? body.segment : null,
    limit: body.limit ? Math.min(200, Math.max(1, Number(body.limit))) : null,
    emails: Array.isArray(body.emails) && body.emails.length ? body.emails.slice(0, 200) : null,
    dryRun,
  });

  return NextResponse.json({ dryRun, ...result });
}
