export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { importLeads, parseLeadCsv } from "@/lib/outreach/import";

/**
 * Bulk lead import. Accepts a raw CSV body (text/csv) or JSON `{ csv }`.
 * Required columns: name, email. Optional: segment, city, region/county,
 * country, source.
 *
 * Upserts on email so re-importing a corrected file is safe, and never
 * resurrects a lead that has already unsubscribed.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const contentType = req.headers.get("content-type") || "";
  let csv = "";

  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { csv?: string };
    csv = body.csv ?? "";
  } else {
    csv = await req.text();
  }

  if (!csv.trim()) {
    return NextResponse.json({ error: "No CSV content received" }, { status: 400 });
  }

  const parsed = parseLeadCsv(csv);
  if (!parsed.rows.length) {
    return NextResponse.json(
      { error: "No usable rows found", skippedRows: parsed.skipped },
      { status: 400 }
    );
  }

  const result = await importLeads(parsed.rows);
  return NextResponse.json({ ...result, malformedRows: parsed.skipped });
}
