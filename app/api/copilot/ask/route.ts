export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCopilot, scopeErrorResponse } from "@/lib/copilot/guard";
import { buildScope } from "@/lib/copilot/copilot";
import { ask } from "@/lib/copilot/ask";
import { isRateLimited } from "@/lib/auth/rate-limit";

const schema = z.object({
  question: z.string().trim().min(2).max(500),
  venueId: z.string().max(64).nullish(),
  date: z.string().max(10).nullish(),
});

/**
 * POST /api/copilot/ask — read-only; POST only to carry the question body.
 * Listed in ALWAYS_WRITABLE so a read-only trial can still ask.
 */
export async function POST(req: NextRequest) {
  const u = await requireCopilot();
  if (u instanceof NextResponse) return u;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question (2–500 characters)" }, { status: 400 });
  if (isRateLimited(`copilot-ask:${u.userId}`, 20, 60_000))
    return NextResponse.json({ error: "Too many questions — try again in a minute" }, { status: 429 });
  try {
    const scope = await buildScope(u.businessId, { venueId: parsed.data.venueId || null, date: parsed.data.date || null });
    const out = await ask(scope, parsed.data.question);
    return NextResponse.json(out, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return scopeErrorResponse(err);
  }
}
