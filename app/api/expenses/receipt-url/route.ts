// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";
import { issueSignedToken, presignUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/receipt-url?url=<private-blob-url>
 * Returns a short-lived (1h) presigned URL for viewing a private receipt.
 */
export async function GET(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  try {
    const urlObj = new URL(blobUrl);
    const pathname = urlObj.pathname.replace(/^\//, "");

    const token = process.env.BLOB_READ_WRITE_TOKEN!;
    const signedTokenData = await issueSignedToken({
      token,
      pathname,
      expiresIn: 3600,
      operations: ["get"],
    });

    const result = await presignUrl(signedTokenData, {
      operation: "get",
      url: blobUrl,
      pathname,
    });

    return NextResponse.json({ url: result.presignedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
