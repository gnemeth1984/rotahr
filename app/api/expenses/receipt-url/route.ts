import { NextRequest, NextResponse } from "next/server";
import { requirePermission, isResponse } from "@/lib/auth/middleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/expenses/receipt-url?url=<private-blob-url>
 * Proxies a private Vercel Blob file through the server so the client
 * never needs a presigned URL (avoids the @vercel/blob presign bug).
 */
export async function GET(req: NextRequest) {
  const session = await requirePermission("bookkeeping");
  if (isResponse(session)) return session;

  const blobUrl = req.nextUrl.searchParams.get("url");
  if (!blobUrl) return NextResponse.json({ error: "Missing url param" }, { status: 400 });

  // Only allow our own blob store
  if (!blobUrl.includes("blob.vercel-storage.com")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN!;
    const res = await fetch(blobUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Blob fetch failed: ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
