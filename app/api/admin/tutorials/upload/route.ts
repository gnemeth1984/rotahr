// @ts-nocheck
/**
 * Client-upload token route for tutorial videos — /api/admin/tutorials/upload
 *
 * Why this exists instead of the usual `put()` in a route handler:
 * every other upload in this repo (receipts, dish photos, log-book proof
 * shots) posts the file to a serverless function, which then calls put().
 * That works because those are small images. Vercel caps a serverless request
 * body at ~4.5MB, so the same pattern applied to a screen recording would pass
 * a 2MB test clip and then fail on the first real video.
 *
 * So the browser uploads straight to Vercel Blob and this route only mints a
 * short-lived, scoped token. The file never passes through a function.
 *
 * The blob is PUBLIC on purpose. A private blob would have to be streamed back
 * through a proxy route: no CDN, no range requests (so no seeking), and
 * function seconds burned per viewer. These are marketing videos on a page
 * that is deliberately visible to logged-out visitors — there is nothing to
 * protect. Auth lives on the WRITE side, here.
 *
 * The DB row is written by the admin UI after upload resolves, not in
 * onUploadCompleted, because that callback cannot reach localhost during
 * development and a video with no row is invisible and easy to miss.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";

// 500MB. A 5 minute 1080p screen recording lands around 60-120MB, so this is
// generous without letting a stray 4K export sit in the store forever.
const MAX_BYTES = 500 * 1024 * 1024;

const ALLOWED_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov, what a Mac screen recording produces
  "video/webm",
  "video/x-m4v",
];

export async function POST(req: NextRequest) {
  // Guard runs BEFORE the token is minted. Without this any visitor could ask
  // for a write token and use our blob store as free hosting.
  const session = await getServerSession(authOptions);
  if (!isSuperAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_TYPES,
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        // Immutable: the pathname carries a random suffix, so a given URL
        // never changes content. Let the CDN hold it for a year.
        cacheControlMaxAge: 31536000,
      }),
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
