export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireCopilot, scopeErrorResponse } from "@/lib/copilot/guard";
import { buildScope, getBrief } from "@/lib/copilot/copilot";

/** GET /api/copilot/brief?venueId=&date=YYYY-MM-DD&refresh=1 — the daily brief. */
export async function GET(req: NextRequest) {
  const u = await requireCopilot();
  if (u instanceof NextResponse) return u;
  const q = req.nextUrl.searchParams;
  try {
    const scope = await buildScope(u.businessId, { venueId: q.get("venueId") || null, date: q.get("date") || null });
    const brief = await getBrief(scope, { refresh: q.get("refresh") === "1" });
    return NextResponse.json(brief, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return scopeErrorResponse(err);
  }
}
