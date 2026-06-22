import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// GET /api/admin/email/broadcasts
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { data, error } = await resend.broadcasts.list();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/admin/email/broadcasts — create a broadcast (draft)
// body: { name, subject, previewText, html, audienceId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { name, subject, previewText, html, audienceId } = await req.json();
    if (!name || !subject || !html || !audienceId) {
      return NextResponse.json({ error: "name, subject, html, audienceId required" }, { status: 400 });
    }

    const { data, error } = await resend.broadcasts.create({
      name,
      subject,
      previewText,
      html,
      audienceId,
      from: "Gabor from Rotahr <gabor@rotahr.app>",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
