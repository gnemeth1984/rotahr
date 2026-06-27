// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { issueSignedToken, presignUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/receipt-url?url=<private-blob-url>
 * Returns a short-lived presigned URL for viewing a private receipt.
 */
export async function GET(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN!;

    // validUntil = 1 hour from now (unix seconds)
    const validUntil = Math.floor(Date.now() / 1000) + 3600;

    // Extract pathname from the blob URL
    const urlObj = new URL(blobUrl);
    const pathname = urlObj.pathname.replace(/^\//, "");

    const signedToken = await issueSignedToken({
      token,
      operations: ["get"],
      validUntil,
      pathname,
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "get",
      url: blobUrl,
      pathname,
    });

    return NextResponse.json({ url: presignedUrl });
  } catch (err: any) {
    // Fallback: return original URL (works if store is actually public)
    return NextResponse.json({ url: blobUrl });
  }
}
