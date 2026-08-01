import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/public/venue-image?url=<private-blob-url>
 *
 * Public, unauthenticated proxy for images shown on public venue pages. The
 * Vercel Blob store is private-access only, so the browser can't read blob URLs
 * directly — the server fetches them with the store token and streams the bytes.
 *
 * Hardened against being used as an open proxy:
 *  - only https
 *  - only *.blob.vercel-storage.com hostnames (exact suffix match on the parsed
 *    hostname, not a substring check — "evil.com/blob.vercel-storage.com" fails)
 *  - only image content types are passed through
 */
const ALLOWED_HOST_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!target.hostname.endsWith(ALLOWED_HOST_SUFFIX)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const upstream = await fetch(target.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: "Image unavailable" }, { status: 404 });
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image" }, { status: 400 });
    }

    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Blob URLs are content-addressed, so this is safe to cache hard.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
