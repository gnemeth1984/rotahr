/**
 * Download beacon — POST /api/templates/download
 *
 * The files themselves are static and served off the CDN, so nothing here is in
 * the download path; this only records which templates get used, so the library
 * can be extended towards what people actually take. Unknown slugs are dropped
 * rather than stored, otherwise this is an open write endpoint.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORMATS = new Set(["pdf", "xlsx", "csv"]);

export async function POST(req: Request) {
  try {
    const { slug, format } = await req.json();
    if (typeof slug !== "string" || !getTemplate(slug)) {
      return NextResponse.json({ ok: false }, { status: 204 });
    }
    if (typeof format !== "string" || !FORMATS.has(format)) {
      return NextResponse.json({ ok: false }, { status: 204 });
    }

    await prisma.activityLog.create({
      data: {
        action: "template_download",
        details: { slug, format },
      },
    });
  } catch {
    // A failed beacon must never surface to the visitor.
  }
  return NextResponse.json({ ok: true });
}
