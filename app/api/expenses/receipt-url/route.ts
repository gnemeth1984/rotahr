import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/receipt-url?url=<blob-url>
 * Returns the URL for viewing a receipt (public blobs returned as-is).
 */
export async function GET(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  // Public blob URLs are directly accessible — return as-is
  return NextResponse.json({ url: blobUrl });
}
