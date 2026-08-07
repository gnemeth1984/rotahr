export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { NextRequest, NextResponse } from "next/server";
import { syncInbox } from "@/lib/inbox/sync";

/**
 * Periodic inbox pull. Only fetches, classifies and drafts — it never sends,
 * so an unattended run can never put mail in front of a customer.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncInbox(25);
  return NextResponse.json(result);
}
