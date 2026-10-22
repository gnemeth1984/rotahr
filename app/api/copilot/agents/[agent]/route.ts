export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireCopilot, scopeErrorResponse } from "@/lib/copilot/guard";
import { AGENT_KEYS, buildScope, runAgent } from "@/lib/copilot/copilot";
import type { AgentKey } from "@/lib/copilot/types";

/** GET /api/copilot/agents/:agent?venueId=&date= — one agent, always fresh. */
export async function GET(req: NextRequest, { params }: { params: { agent: string } }) {
  const u = await requireCopilot();
  if (u instanceof NextResponse) return u;
  if (!AGENT_KEYS.includes(params.agent as AgentKey)) return NextResponse.json({ error: "Unknown agent" }, { status: 404 });
  const q = req.nextUrl.searchParams;
  try {
    const scope = await buildScope(u.businessId, { venueId: q.get("venueId") || null, date: q.get("date") || null });
    const result = await runAgent(scope, params.agent as AgentKey);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return scopeErrorResponse(err);
  }
}
