import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

// GET /api/admin/email/contacts?audienceId=xxx
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
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
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, firstName, lastName, audienceId } = await req.json();
    if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

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
