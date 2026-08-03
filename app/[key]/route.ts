/**
 * Serves the IndexNow key file at https://rotahr.com/<INDEXNOW_KEY>.txt
 *
 * IndexNow requires the key to be retrievable from the domain root as proof of
 * ownership. Serving it from a route rather than /public means rotating the key
 * is an env-var change, not a deploy.
 *
 * Anything that isn't exactly "<key>.txt" 404s, so this catch-all never
 * shadows a real page.
 */

import { NextResponse } from "next/server";
import { indexNowKey } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const key = indexNowKey();
  if (!key || params.key !== `${key}.txt`) {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse(key, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
