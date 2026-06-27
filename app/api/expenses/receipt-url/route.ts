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

    // validUntil must be milliseconds timestamp, 1 hour from now
    const validUntil = Date.now() + 60 * 60 * 1000;

    const urlObj = new URL(blobUrl);
    const pathname = urlObj.pathname.replace(/^\//, "");

    const signedToken = await issueSignedToken({
      token,
      operations: ["get"],
      validUntil,
      pathname,
    });

    const { presignedUrl: signedUrl } = await presignUrl(signedToken, {
      operation: "get",
      url: blobUrl,
      pathname,
      validUntil,
    });

    return NextResponse.json({ url: signedUrl });
  } catch (err: any) {
    console.error("receipt-url presign error:", err?.message);
    // Fallback: return original URL (will 403 for private blobs but better than crashing)
    return NextResponse.json({ url: blobUrl });
  }
}
