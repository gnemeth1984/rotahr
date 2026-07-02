import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

/**
 * GET /api/menu/dishes/image-url?url=<private-blob-url>
 * Proxies a private Vercel Blob dish photo through the server so the
 * client never needs a presigned URL (store is private-access only).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
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
