// @ts-nocheck
/**
 * Public view counter — POST /api/tutorials/view  { slug }
 *
 * Unauthenticated on purpose: /tutorials is a logged-out page, so a guarded
 * counter would only ever count Gabor.
 *
 * This is a vanity metric, not analytics. It increments a single integer on a
 * published row and returns 204 no matter what happens, so a bot, a bad slug
 * or a dead database can never surface an error on a marketing page. It is
 * trivially inflatable by anyone with curl — treat the number as "roughly how
 * much interest", never as a figure to quote at anyone.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug || "").slice(0, 100);
    if (slug) {
      await prisma.tutorial.updateMany({
        where: { slug, published: true },
        data: { views: { increment: 1 } },
      });
    }
  } catch {
    // Swallowed deliberately. See the note above.
  }
  return new NextResponse(null, { status: 204 });
}
