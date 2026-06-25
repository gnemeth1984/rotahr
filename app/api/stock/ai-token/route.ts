// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";

// Returns OpenAI key to authenticated managers/admins only
// so the browser can call OpenAI directly — bypasses Vercel function timeout
export async function GET(req: NextRequest) {
  const session = await requirePermission("stocktaking");
  if (isResponse(session)) return session;
  const key = process.env.OPENAI_API_KEY;
  if (!key) return NextResponse.json({ error: "Not configured" }, { status: 500 });
  return NextResponse.json({ key });
}
