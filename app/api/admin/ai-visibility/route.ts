/**
 * GET /api/admin/ai-visibility — AI share-of-voice for the admin dashboard.
 *
 * Reads stored answers only; no live model calls on page load, so opening the
 * tab costs nothing and can't be used to burn API credit.
 */

import { NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/seo/auth";
import { visibilitySummary } from "@/lib/seo/ai-visibility";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await visibilitySummary();
  return NextResponse.json(data);
}
