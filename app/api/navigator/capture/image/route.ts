import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { navigatorUserId, forbidden } from "@/lib/navigator/guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/navigator/capture/image?id=<captureId>
 *
 * Streams a captured photo out of the private blob store.
 *
 * Takes a capture id, NOT a blob url. Same reasoning as speak/route.ts taking
 * a messageId instead of raw text: a url param would let any signed-in caller
 * name an arbitrary object in our store, and these are personal documents.
 * The row is looked up scoped to the Navigator user, so ownership is proven
 * before a single byte moves.
 */
export async function GET(req: NextRequest) {
  const userId = await navigatorUserId();
  if (!userId) return forbidden();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const capture = await prisma.navCapture.findFirst({
    where: { id, userId },
    select: { blobUrl: true, mimeType: true },
  });
  if (!capture) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "Blob storage is not configured" }, { status: 500 });

  try {
    const res = await fetch(capture.blobUrl, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      return NextResponse.json({ error: `Image fetch failed (${res.status})` }, { status: res.status });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? capture.mimeType,
        // private: this must never sit in a shared cache.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Image fetch failed" },
      { status: 500 }
    );
  }
}
