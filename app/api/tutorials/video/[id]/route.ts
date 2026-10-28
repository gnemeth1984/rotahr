/**
 * GET /api/tutorials/video/<id> — stream a tutorial video from the private
 * Vercel Blob store.
 *
 * Public for published tutorials (the /tutorials page is for logged-out
 * visitors); drafts only for the super admin, so the admin tab can preview.
 *
 * Range requests are passed through so <video> can seek. Open-ended ranges
 * ("bytes=0-", what browsers send first) are capped to CHUNK bytes and
 * answered 206 with the true total in Content-Range; the browser then asks for
 * the next slice. That keeps each function invocation short instead of holding
 * one open for the length of the video.
 *
 * Cache-Control is private (browser only). A shared CDN cache keyed on URL
 * alone could hand one viewer's byte range to another.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/db";

const CHUNK = 4 * 1024 * 1024;

const PASS_HEADERS = ["content-type", "content-length", "content-range", "etag", "last-modified"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tutorial = await prisma.tutorial.findUnique({
    where: { id: params.id },
    select: { videoUrl: true, published: true },
  });
  if (!tutorial) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!tutorial.published) {
    const session = await getServerSession(authOptions);
    if (!isSuperAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  let range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
    if (m) {
      const start = Number(m[1]);
      const askedEnd = m[2] ? Number(m[2]) : Infinity;
      range = `bytes=${start}-${Math.min(askedEnd, start + CHUNK - 1)}`;
    }
  }

  const upstream = await fetch(tutorial.videoUrl, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN ?? ""}`,
      ...(range ? { Range: range } : {}),
    },
    cache: "no-store",
  });

  if (upstream.status === 416) {
    return new NextResponse(null, { status: 416, headers: { "content-range": upstream.headers.get("content-range") ?? "" } });
  }
  if (!upstream.ok) {
    return NextResponse.json({ error: `Video fetch failed (${upstream.status})` }, { status: upstream.status === 404 ? 404 : 502 });
  }

  const headers = new Headers();
  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", tutorial.published ? "private, max-age=3600" : "private, no-store");
  headers.set("x-content-type-options", "nosniff");

  return new Response(upstream.body, { status: upstream.status, headers });
}
