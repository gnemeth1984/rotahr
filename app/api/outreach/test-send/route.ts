export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../_auth";
import { sendTestEmail } from "@/lib/outreach/sender";
import { checkBrevoAccount } from "@/lib/outreach/brevo";

/** Verifies the Brevo key works, without touching the lead list. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json(await checkBrevoAccount());
}

/**
 * Sends the first sequence email to one address. Only ever to a mailbox the
 * caller names explicitly — never to a lead.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { to } = (await req.json().catch(() => ({}))) as { to?: string };
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to.trim())) {
    return NextResponse.json({ error: "A valid 'to' address is required" }, { status: 400 });
  }

  return NextResponse.json(await sendTestEmail(to.trim()));
}
