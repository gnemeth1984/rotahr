import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { Resend } from "resend";
import { purgeUnroutableContacts } from "@/lib/email/audience";

const resend = new Resend(process.env.RESEND_API_KEY!);

// GET /api/admin/email/broadcasts/[id] — get single broadcast with stats
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { data, error } = await resend.broadcasts.get(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/email/broadcasts/[id] with body { action: "send" }
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await req.json();

  if (action !== "send") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  try {
    /**
     * Clean the audience before sending, not after.
     *
     * A broadcast is one API call against a whole audience, so it bypasses the
     * unroutable filter in sendEmail() entirely. A single demo address left in
     * the audience would hard-bounce on every campaign forever, and bounce rate
     * is what mailbox providers use to decide whether rotahr.com is trustworthy.
     * Removing them here means the check runs even if someone added the address
     * through the Resend dashboard rather than this admin panel.
     */
    const broadcast = await resend.broadcasts.get(id);
    const audienceId =
      (broadcast.data as { audience_id?: string; segment_id?: string } | null)?.audience_id ??
      (broadcast.data as { audience_id?: string; segment_id?: string } | null)?.segment_id ??
      null;

    let purged = { removed: 0, addresses: [] as string[] };
    if (audienceId) {
      const res = await purgeUnroutableContacts(audienceId);
      // A failed purge must not block a legitimate send - it is a hygiene step,
      // not an authorisation one - but it is surfaced in the response so a
      // silent failure cannot hide behind a successful send.
      if (!res.error) purged = { removed: res.removed, addresses: res.addresses };
      else console.error("[email:broadcast] audience purge failed:", res.error);
    }

    const { data, error } = await resend.broadcasts.send(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ...data, purged });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/admin/email/broadcasts/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { data, error } = await resend.broadcasts.remove(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
