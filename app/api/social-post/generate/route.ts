import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { ImageResponse } from "next/og";
import { authOptions } from "@/lib/auth/options";
import { UserRole as Role } from "@/types/roles";
import { loadSocialPostFonts } from "@/lib/social-post/fonts";
import { renderTemplate, TEMPLATE_SIZE } from "@/lib/social-post/templates";
import type { SocialPostTemplateId, SocialPostSpecialInput } from "@/lib/social-post/types";

export const runtime = "nodejs";
export const maxDuration = 30;

function canUse(role: string, permissions: string[]) {
  return role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");
}

const VALID_TEMPLATES: SocialPostTemplateId[] = [
  "classic",
  "split",
  "overlay",
  "minimal",
  "neon",
  "chalkboard",
  "polaroid",
  "boldtype",
  "story",
  "print",
];

async function photoUrlToDataUri(photoUrl: string): Promise<string> {
  if (photoUrl.startsWith("data:")) return photoUrl;

  // Our dish/special photos live in a private Vercel Blob store — those URLs
  // 403 on a plain fetch and need the read/write token as a bearer header.
  const isOwnBlob = photoUrl.includes("blob.vercel-storage.com");
  const headers: Record<string, string> = {};
  if (isOwnBlob && process.env.BLOB_READ_WRITE_TOKEN) {
    headers.Authorization = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
  }

  const res = await fetch(photoUrl, { headers });
  if (!res.ok) throw new Error(`Could not fetch photo (${res.status})`);
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUse(session.user.role, session.user.permissions ?? []))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const {
      photoUrl,
      templateId,
      headline,
      specials,
      tagline,
      hashtags,
      accent,
      panelColor,
      businessName,
    } = body as {
      photoUrl?: string;
      templateId?: string;
      headline?: string;
      specials?: SocialPostSpecialInput[];
      tagline?: string;
      hashtags?: string[];
      accent?: string;
      panelColor?: string;
      businessName?: string;
    };

    if (!photoUrl) return NextResponse.json({ error: "photoUrl is required" }, { status: 400 });
    if (!templateId || !VALID_TEMPLATES.includes(templateId as SocialPostTemplateId))
      return NextResponse.json({ error: "Invalid templateId" }, { status: 400 });
    if (!specials || !Array.isArray(specials) || specials.length === 0)
      return NextResponse.json({ error: "At least one special is required" }, { status: 400 });

    const [photoDataUri, fonts] = await Promise.all([
      photoUrlToDataUri(photoUrl),
      loadSocialPostFonts(),
    ]);

    const tId = templateId as SocialPostTemplateId;
    const size = TEMPLATE_SIZE[tId];

    const element = renderTemplate(tId, {
      photoDataUri,
      businessName: businessName || "Our Place",
      headline: headline || "Today's Specials",
      specials: specials.slice(0, 6).map((s) => ({
        title: String(s.title || "").slice(0, 80),
        description: s.description ? String(s.description).slice(0, 140) : undefined,
      })),
      tagline: tagline ? String(tagline).slice(0, 90) : undefined,
      hashtags: Array.isArray(hashtags) ? hashtags.slice(0, 8).map(String) : undefined,
      accent: accent || "#d9662b",
      panelColor: panelColor || "#1f3d2e",
    });

    const image = new ImageResponse(element, {
      width: size.width,
      height: size.height,
      fonts,
    });

    const arrayBuffer = await image.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
