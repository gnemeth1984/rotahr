export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { prisma } from "@/lib/prisma";
import { createProspectVenuePage, hasIndexableContent } from "@/lib/public-page/provision";
import { validateSlug } from "@/lib/public-page/types";
import { z } from "zod";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isSuperAdminEmail(session.user.email)) return null;
  return session;
}

/** Every public page, prospect and customer, so the tool is the one place to see them. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await prisma.business.findMany({
    where: { publicSlug: { not: null } },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicPageEnabled: true,
      publicNoIndex: true,
      publicProspect: true,
      publicAddress: true,
      publicPhone: true,
      publicAbout: true,
      publicOpeningHours: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    venues: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.publicSlug,
      enabled: r.publicPageEnabled,
      noIndex: r.publicNoIndex,
      prospect: r.publicProspect,
      address: r.publicAddress,
      phone: r.publicPhone,
      userCount: r._count.users,
      indexable: hasIndexableContent({
        address: r.publicAddress,
        about: r.publicAbout,
        openingHours: r.publicOpeningHours,
      }),
      createdAt: r.createdAt,
    })),
  });
}

const hoursSchema = z.array(
  z.object({
    day: z.number().int().min(0).max(6),
    closed: z.boolean(),
    open: z.string().regex(/^\d{2}:\d{2}$/),
    close: z.string().regex(/^\d{2}:\d{2}$/),
  })
);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(3).max(60),
  tagline: z.string().max(160).optional().nullable(),
  about: z.string().max(4000).optional().nullable(),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(60).optional().nullable(),
  email: z.string().max(160).optional().nullable(),
  website: z.string().max(300).optional().nullable(),
  facebook: z.string().max(300).optional().nullable(),
  instagram: z.string().max(300).optional().nullable(),
  venueType: z.string().max(40).optional().nullable(),
  cuisine: z.string().max(60).optional().nullable(),
  geoLat: z.number().min(-90).max(90).optional().nullable(),
  geoLng: z.number().min(-180).max(180).optional().nullable(),
  currency: z.string().max(4).optional().nullable(),
  timezone: z.string().max(60).optional().nullable(),
  openingHours: hoursSchema.optional().nullable(),
  noIndex: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
  }

  const slugCheck = validateSlug(parsed.data.slug);
  if (slugCheck.ok === false) return NextResponse.json({ error: slugCheck.error }, { status: 400 });

  try {
    const business = await createProspectVenuePage(parsed.data);
    return NextResponse.json(
      { id: business.id, slug: business.publicSlug, url: `https://rotahr.com/v/${business.publicSlug}` },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create that page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

const patchSchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean().optional(),
  noIndex: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id, ...data } = parsed.data;
  const updated = await prisma.business.update({
    where: { id },
    data: {
      ...(data.enabled === undefined ? {} : { publicPageEnabled: data.enabled }),
      ...(data.noIndex === undefined ? {} : { publicNoIndex: data.noIndex }),
    },
    select: { id: true, publicPageEnabled: true, publicNoIndex: true },
  });

  return NextResponse.json({ ok: true, venue: updated });
}

/**
 * Delete a prospect page. Refuses to touch a real customer's business — that
 * would take their whole account with it. Turn the page off instead.
 */
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const business = await prisma.business.findUnique({
    where: { id },
    select: { publicProspect: true, _count: { select: { users: true, employees: true } } },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!business.publicProspect || business._count.users > 0 || business._count.employees > 0) {
    return NextResponse.json(
      { error: "That's a real account, not a prospect page. Turn the page off instead of deleting it." },
      { status: 409 }
    );
  }

  await prisma.business.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
