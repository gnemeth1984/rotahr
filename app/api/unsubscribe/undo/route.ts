import { NextRequest, NextResponse } from "next/server";
import { normaliseEmail, unsuppress } from "@/lib/email/suppression";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  await unsuppress(email);
  return NextResponse.json({ ok: true });
}
