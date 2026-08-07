export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "../_auth";
import { syncInbox } from "@/lib/inbox/sync";
import { testConnection } from "@/lib/inbox/imap";

/** Connection check that imports nothing — used by the UI to diagnose setup. */
export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  return NextResponse.json(await testConnection());
}

export async function POST(req: NextRequest) {
  const { error } = await requirePlatformAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { limit?: number };
  const limit = body.limit ? Math.min(50, Math.max(1, Number(body.limit))) : 25;

  // Awaited deliberately: a serverless function is frozen the instant it
  // responds, so backgrounding this would silently abandon the work mid-run.
  const result = await syncInbox(limit);
  return NextResponse.json(result);
}
