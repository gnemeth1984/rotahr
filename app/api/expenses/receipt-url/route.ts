// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { UserRole as Role } from "@/types/roles";
import { issueSignedToken, presignUrl } from "@vercel/blob";

export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/receipt-url?url=<private-blob-url>
 * Returns a short-lived (1h) presigned URL for viewing a private receipt.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== Role.MANAGER && session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  try {
    // Extract the pathname from the blob URL
    const urlObj = new URL(blobUrl);
    const pathname = urlObj.pathname.replace(/^\//, ""); // remove leading slash

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
