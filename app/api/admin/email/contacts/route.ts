import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { Resend } from "resend";
import { isUnroutableAddress } from "@/lib/email/send";
import { purgeUnroutableContacts } from "@/lib/email/audience";

const resend = new Resend(process.env.RESEND_API_KEY!);

// GET /api/admin/email/contacts?audienceId=xxx
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const audienceId = searchParams.get("audienceId");

  try {
    const opts = audienceId ? { audienceId } : undefined;
    const { data, error } = await resend.contacts.list(opts as Parameters<typeof resend.contacts.list>[0]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/email/contacts — add a contact
// body: { email, firstName?, lastName?, audienceId? }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, firstName, lastName, audienceId } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
    // Keep demo and reserved-domain addresses out of the audience entirely —
    // a contact list is reused across every future broadcast, so one bad
    // address bounces repeatedly rather than once.
    if (isUnroutableAddress(email)) {
      return NextResponse.json(
        { error: "That address is on a demo or reserved domain (.demo/.test/example.com) and would bounce." },
        { status: 400 }
      );
    }

    const payload = audienceId
      ? { email, firstName, lastName, audienceId } // legacy API with audienceId
      : { email, firstName, lastName };

    const { data, error } = await resend.contacts.create(payload as Parameters<typeof resend.contacts.create>[0]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * Remove contacts from an audience.
 *
 * Two modes:
 *   ?id=<contactId>              remove one contact
 *   ?audienceId=<id>&purge=demo  remove every unroutable address in the audience
 *
 * The purge exists because the create guard only stops NEW bad addresses. An
 * audience is reused by every future broadcast, and a broadcast sends to the
 * whole audience in one API call - it never passes through sendEmail(), so the
 * unroutable filter there cannot protect it. Any demo address added before the
 * guard would therefore bounce again on every single broadcast.
 */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const audienceId = searchParams.get("audienceId");
  const purge = searchParams.get("purge");

  try {
    if (id) {
      const { error } = await resend.contacts.remove(id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ removed: 1 });
    }

    if (purge === "demo" && audienceId) {
      const result = await purgeUnroutableContacts(audienceId);
      if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Pass ?id= or ?audienceId=&purge=demo" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
