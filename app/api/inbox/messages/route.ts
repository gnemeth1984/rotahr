export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "../_auth";
import { inboxStats } from "@/lib/inbox/sync";

export async function GET(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));

  const where: Record<string, unknown> = {};
  if (status && status !== "all") {
    // "Needs you" is a view over the data rather than a stored status: it is
    // anything still open that the assistant refused to answer alone.
    if (status === "needs-human") {
      where.needsHuman = true;
      where.status = { in: ["new", "drafted"] };
    } else {
      where.status = status;
    }
  }
  if (category && category !== "all") where.category = category;

  const [messages, stats] = await Promise.all([
    prisma.inboundEmail.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: limit,
    }),
    inboxStats(),
  ]);

  return NextResponse.json({ messages, stats });
}
