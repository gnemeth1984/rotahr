import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { NextResponse } from "next/server";

const EMAIL_SYSTEM_URL = process.env.EMAIL_SYSTEM_URL || "https://rotahr-email-production.up.railway.app";
const API_SECRET = process.env.OUTREACH_API_SECRET || "rotahr-api-2026";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}

export async function proxyGet(path: string, searchParams?: URLSearchParams) {
  const url = `${EMAIL_SYSTEM_URL}${path}${searchParams?.toString() ? "?" + searchParams.toString() : ""}`;
  const r = await fetch(url, {
    headers: { "x-api-secret": API_SECRET },
    next: { revalidate: 0 },
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}

export async function proxyPost(path: string, body?: object) {
  const url = `${EMAIL_SYSTEM_URL}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-secret": API_SECRET },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json();
  return NextResponse.json(data, { status: r.status });
}
