import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/prisma";
import {
  normaliseOpeningHours,
  validateSlug,
  slugify,
  PUBLIC_SPECIAL_CATEGORIES,
  type OpeningHoursEntry,
} from "@/lib/public-page/types";
import { syncAutoIndex } from "@/lib/public-page/provision";

export const dynamic = "force-dynamic";

const SELECT = {
  name: true,
  publicPageEnabled: true,
  publicSlug: true,
  publicTagline: true,
  publicAbout: true,
  publicHeroImage: true,
  publicPhone: true,
  publicEmail: true,
  publicAddress: true,
  publicWebsite: true,
  publicInstagram: true,
  publicFacebook: true,
  publicBookingUrl: true,
  publicOpeningHours: true,
  publicShowMenu: true,
  publicShowSpecials: true,
  publicShowPrices: true,
  publicShowBooking: true,
  publicNoIndex: true,
} as const;

async function requireManager() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  if (!session?.user?.businessId || (role !== "MANAGER" && role !== "ADMIN")) return null;
  return session.user.businessId as string;
}

export async function GET() {
  const businessId = await requireManager();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: SELECT,
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Counts so the settings page can warn when the page would look empty.
  const [dishCount, specialCount] = await Promise.all([
    prisma.dish.count({ where: { businessId, active: true } }),
    prisma.menuSpecial.count({
      where: {
        businessId,
        archived: false,
        hideFromPublic: false,
        category: { in: [...PUBLIC_SPECIAL_CATEGORIES] },
      },
    }),
  ]);

  return NextResponse.json({
    ...business,
    publicOpeningHours: normaliseOpeningHours(business.publicOpeningHours),
    suggestedSlug: slugify(business.name),
    dishCount,
    specialCount,
  });
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t.length ? t : null;
}

/** Accept a bare domain and normalise to a URL, or reject nonsense. */
function url(v: unknown): string | null {
  const s = str(v, 300);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  const businessId = await requireManager();
  if (!businessId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  // ── Slug ────────────────────────────────────────────────────────────────
  if (body.publicSlug !== undefined) {
    const slug = (str(body.publicSlug, 60) ?? "").toLowerCase();
    if (slug) {
      const check = validateSlug(slug);
      if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

      const taken = await prisma.business.findFirst({
        where: { publicSlug: slug, NOT: { id: businessId } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: "That page address is already taken. Try another." },
          { status: 409 }
        );
      }
      data.publicSlug = slug;
    } else {
      data.publicSlug = null;
    }
  }

  // ── Enabling requires a slug ────────────────────────────────────────────
  if (body.publicPageEnabled !== undefined) {
    const enabling = Boolean(body.publicPageEnabled);
    if (enabling) {
      const slug =
        (data.publicSlug as string | null | undefined) ??
        (
          await prisma.business.findUnique({
            where: { id: businessId },
            select: { publicSlug: true },
          })
        )?.publicSlug;
      if (!slug) {
        return NextResponse.json(
          { error: "Choose a page address before publishing." },
          { status: 400 }
        );
      }
    }
    data.publicPageEnabled = enabling;
  }

  if (body.publicTagline !== undefined) data.publicTagline = str(body.publicTagline, 120);
  if (body.publicAbout !== undefined) data.publicAbout = str(body.publicAbout, 2000);
  if (body.publicHeroImage !== undefined) data.publicHeroImage = str(body.publicHeroImage, 500);
  if (body.publicPhone !== undefined) data.publicPhone = str(body.publicPhone, 40);
  if (body.publicEmail !== undefined) data.publicEmail = str(body.publicEmail, 120);
  if (body.publicAddress !== undefined) data.publicAddress = str(body.publicAddress, 300);
  if (body.publicWebsite !== undefined) data.publicWebsite = url(body.publicWebsite);
  if (body.publicInstagram !== undefined) data.publicInstagram = url(body.publicInstagram);
  if (body.publicFacebook !== undefined) data.publicFacebook = url(body.publicFacebook);
  if (body.publicBookingUrl !== undefined) data.publicBookingUrl = url(body.publicBookingUrl);

  for (const key of [
    "publicShowMenu",
    "publicShowSpecials",
    "publicShowPrices",
    "publicShowBooking",
    "publicNoIndex",
  ] as const) {
    if (body[key] !== undefined) data[key] = Boolean(body[key]);
  }

  if (body.publicOpeningHours !== undefined) {
    const hours: OpeningHoursEntry[] = normaliseOpeningHours(body.publicOpeningHours);
    data.publicOpeningHours = hours;
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data,
    select: SELECT,
  });

  // New signups start noindex because a name-only page is a thin page. Once
  // they add an address, hours or a description, let search engines in — unless
  // they explicitly ticked "hide from search" in this same save.
  await syncAutoIndex(businessId, body.publicNoIndex === true ? true : undefined).catch(() => {});

  // Re-read the flag so the UI shows the state syncAutoIndex may have just changed.
  const fresh = await prisma.business.findUnique({
    where: { id: businessId },
    select: { publicNoIndex: true },
  });

  return NextResponse.json({
    ...updated,
    publicNoIndex: fresh?.publicNoIndex ?? updated.publicNoIndex,
    publicOpeningHours: normaliseOpeningHours(updated.publicOpeningHours),
  });
}
