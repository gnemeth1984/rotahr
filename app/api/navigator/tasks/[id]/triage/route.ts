import { NextResponse } from "next/server";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { triageDraft } from "@/lib/navigator/ai";

export const dynamic = "force-dynamic";

// POST /api/navigator/tasks/[id]/triage
// Turns a raw captured draft into a real task: the model fills priority, effort
// and the start trigger, then flips status to "todo". Ownership is enforced
// inside triageDraft, which scopes the lookup to the caller's own rows.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();
  const { id } = await params;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const out = await triageDraft(userId, id);
    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Triage failed" },
      { status: 500 }
    );
  }
}
