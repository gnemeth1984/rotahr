export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { extractVenueFromUrl } from "@/lib/ai/venue-extract";
import { uniquePublicSlug } from "@/lib/public-page/provision";
import { z } from "zod";

const schema = z.object({ url: z.string().url() });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Paste a full URL, including https://" }, { status: 400 });

  const url = parsed.data.url;
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "Only http(s) URLs are supported." }, { status: 400 });
  }

  try {
    const venue = await extractVenueFromUrl(url);
    const suggestedSlug = venue.name ? await uniquePublicSlug(venue.name) : null;
    return NextResponse.json({ venue, suggestedSlug, sourceUrl: url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read that page.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
