// One search across every Navigator surface: tasks, captures, memory, chat.
//
// Read-only by design. Search is the one place where being wrong is cheap and
// being slow is expensive, so there is no AI call and no write path here — it
// answers from Postgres and ranks in memory.
import { NextRequest, NextResponse } from "next/server";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";
import { searchNavigator, type SearchSource } from "@/lib/navigator/search";

export const dynamic = "force-dynamic";

const ALL: SearchSource[] = ["task", "capture", "memory", "chat"];

export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ hits: [], tokens: [], counts: { task: 0, capture: 0, memory: 0, chat: 0 } });
  }

  // ?sources=task,chat narrows the search. An unknown value is dropped rather
  // than erroring: a stale client should get results, not a red banner.
  const rawSources = req.nextUrl.searchParams.get("sources");
  const sources = rawSources
    ? (rawSources.split(",").map((s) => s.trim()).filter((s): s is SearchSource => (ALL as string[]).includes(s)))
    : undefined;

  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);

  try {
    const result = await searchNavigator(userId, q, {
      limit: Number.isFinite(limit) ? limit : 30,
      sources: sources && sources.length ? sources : undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Search failed" },
      { status: 500 },
    );
  }
}
