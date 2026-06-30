// @ts-nocheck
/**
 * POST /api/demo/reset
 *
 * Safety-net endpoint to manually trigger a full demo data reset.
 * Protected by CRON_SECRET header so only trusted callers can invoke it.
 *
 * Usage:
 *   curl -X POST https://rotahr.vercel.app/api/demo/reset \
 *     -H "Authorization: Bearer <CRON_SECRET>"
 */

import { NextRequest, NextResponse } from "next/server";
import { seedAll } from "@/scripts/seed-demo";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel max for hobby plan

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[api/demo/reset] Manual reset triggered");
    await seedAll();
    console.log("[api/demo/reset] Reset complete");
    return NextResponse.json({ ok: true, message: "Demo data reset successfully" });
  } catch (err) {
    console.error("[api/demo/reset] Reset failed:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
