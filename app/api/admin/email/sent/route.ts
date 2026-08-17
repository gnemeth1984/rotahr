import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { Resend } from "resend";
import { isUnroutableAddress } from "@/lib/email/send";

const resend = new Resend(process.env.RESEND_API_KEY!);

/**
 * Resend's send log is raw history — it keeps every message the account has
 * ever sent, including the demo-domain shift reminders that hard-bounced
 * before `isUnroutableAddress` was added to lib/email/send.ts. Those rows can
 * never be retried and are not a live problem, but sitting untagged in the
 * table they made the campaign screen look like real outreach was bouncing.
 *
 * So each row is tagged here rather than in the UI: the server already knows
 * the rule, and tagging server-side keeps the same definition of "unroutable"
 * for the send path, the audience cleaner and this log.
 */
interface TaggedEmail extends Record<string, unknown> {
  demo: boolean;
}

// GET /api/admin/email/sent?limit=50
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 100);

  try {
    const { data, error } = await resend.emails.list({ limit });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data?.data ?? []) as Array<Record<string, unknown>>;
    const tagged: TaggedEmail[] = rows.map((row) => {
      const to = row.to;
      const recipients = Array.isArray(to) ? (to as string[]) : to ? [String(to)] : [];
      // A row counts as demo only if every recipient is unroutable — a mixed
      // batch still contained a real send worth showing.
      const demo = recipients.length > 0 && recipients.every((r) => isUnroutableAddress(r));
      return { ...row, demo };
    });

    return NextResponse.json({
      ...data,
      data: tagged,
      demoCount: tagged.filter((t) => t.demo).length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
