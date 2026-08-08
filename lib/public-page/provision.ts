// Creating public venue pages (rotahr.com/v/<slug>) automatically.
//
// Two entry points:
//  - provisionPublicPageForBusiness(): called when a new business signs up, so
//    every customer gets a page without touching Settings.
//  - createProspectVenuePage(): called from the admin venue-pages tool, for
//    venues that aren't customers yet.

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { slugify, validateSlug, RESERVED_SLUGS, type OpeningHoursEntry } from "./types";
import { isTakenDown } from "./takedown";

/**
 * Businesses that must never get a public page: seed/demo data and the
 * platform's own admin business. Indexing these would put fake venues in
 * Google under the Rotahr domain.
 */
export function isNonPublicBusiness(id: string, name?: string | null): boolean {
  if (id.startsWith("demo-")) return true;
  if (id === "admin-test-biz") return true;
  const n = (name ?? "").toLowerCase();
  return n.includes("rotahr hq") || n.includes("test business");
}

/**
 * A page with only a name is a thin page, and a pile of thin pages drags down
 * the whole domain in search. We only let a page into the sitemap once it has
 * something a human would actually read: an address, or opening hours, or a
 * description.
 */
export function hasIndexableContent(input: {
  address?: string | null;
  about?: string | null;
  openingHours?: unknown;
}): boolean {
  if (input.address && input.address.trim().length > 5) return true;
  if (input.about && input.about.trim().length > 40) return true;
  if (Array.isArray(input.openingHours) && input.openingHours.length > 0) return true;
  return false;
}

/**
 * Find a free slug for a business name. Falls back to a numeric suffix, then to
 * a random suffix, so this can never loop forever or throw on a unique clash.
 */
export async function uniquePublicSlug(name: string, excludeBusinessId?: string): Promise<string> {
  let base = slugify(name);
  if (!base || base.length < 3 || RESERVED_SLUGS.has(base)) {
    base = `venue-${slugify(name) || randomBytes(3).toString("hex")}`.slice(0, 60);
  }
  if (validateSlug(base).ok === false) base = `venue-${randomBytes(4).toString("hex")}`;

  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`.slice(0, 60);
    if (RESERVED_SLUGS.has(candidate)) continue;
    const existing = await prisma.business.findUnique({
      where: { publicSlug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeBusinessId) return candidate;
  }
  return `${base.slice(0, 45)}-${randomBytes(4).toString("hex")}`;
}

/**
 * Give a freshly created business a live public page.
 *
 * Fails soft on purpose: this runs inside signup, and a slug clash or a DB
 * hiccup must never stop somebody creating their account.
 */
export async function provisionPublicPageForBusiness(businessId: string, name: string): Promise<string | null> {
  try {
    if (isNonPublicBusiness(businessId, name)) return null;

    const existing = await prisma.business.findUnique({
      where: { id: businessId },
      select: { publicSlug: true, publicAddress: true, publicAbout: true, publicOpeningHours: true },
    });
    if (!existing) return null;
    if (existing.publicSlug) return existing.publicSlug; // already has one

    const slug = await uniquePublicSlug(name, businessId);

    // Live from day one, but only crawlable once there is real content on it.
    // A brand-new signup has a name and nothing else, so it starts noindex and
    // flips itself the moment they fill in an address or hours (see
    // syncAutoIndex, called from the public-page settings PATCH).
    const indexable = hasIndexableContent({
      address: existing.publicAddress,
      about: existing.publicAbout,
      openingHours: existing.publicOpeningHours,
    });

    await prisma.business.update({
      where: { id: businessId },
      data: {
        publicSlug: slug,
        publicPageEnabled: true,
        publicNoIndex: !indexable,
        publicShowBooking: false, // opt-in — nobody should get bookings they aren't watching for
      },
    });
    return slug;
  } catch (err) {
    console.error("[public-page] provision failed", businessId, err);
    return null;
  }
}

/**
 * Keep noindex in step with page content after a settings save. Only ever
 * removes noindex automatically — if the owner deliberately ticked "hide from
 * search", `respectManualChoice` keeps that.
 */
export async function syncAutoIndex(businessId: string, manualNoIndex?: boolean): Promise<void> {
  if (manualNoIndex === true) return; // owner asked to stay hidden
  const b = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, publicAddress: true, publicAbout: true, publicOpeningHours: true, publicNoIndex: true },
  });
  if (!b || !b.publicNoIndex) return;
  if (isNonPublicBusiness(b.id, b.name)) return;
  if (!hasIndexableContent({ address: b.publicAddress, about: b.publicAbout, openingHours: b.publicOpeningHours })) return;
  await prisma.business.update({ where: { id: businessId }, data: { publicNoIndex: false } });
}

export interface ProspectVenueInput {
  name: string;
  slug?: string | null;
  tagline?: string | null;
  about?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  venueType?: string | null;
  cuisine?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  currency?: string | null;
  timezone?: string | null;
  openingHours?: OpeningHoursEntry[] | null;
  noIndex?: boolean;
}

/** Create a Business + default Venue whose only purpose is the public page. */
export async function createProspectVenuePage(input: ProspectVenueInput) {
  // A venue that already asked us to remove its page must never be republished
  // by a later import. Enforced here rather than at the call sites so no future
  // bulk tool can forget to check.
  if (await isTakenDown(input.name, input.email)) {
    throw new Error(
      `${input.name} previously asked to be removed from Rotahr — not republishing.`
    );
  }

  const slug = input.slug ? input.slug : await uniquePublicSlug(input.name);
  const check = validateSlug(slug);
  if (check.ok === false) throw new Error(check.error);

  const clash = await prisma.business.findUnique({ where: { publicSlug: slug }, select: { id: true } });
  if (clash) throw new Error(`The address /v/${slug} is already taken.`);

  const noIndex =
    input.noIndex ??
    !hasIndexableContent({ address: input.address, about: input.about, openingHours: input.openingHours });

  return prisma.$transaction(async (tx) => {
    const business = await tx.business.create({
      data: {
        name: input.name,
        currency: input.currency || "EUR",
        publicSlug: slug,
        publicPageEnabled: true,
        publicProspect: true,
        publicClaimToken: randomBytes(16).toString("hex"),
        // Issued at creation, not on demand: the invite email that announces the
        // page must be able to carry a working "remove this" link in the same
        // message. Offering removal only after they reply is not one click.
        publicTakedownToken: randomBytes(24).toString("base64url"),
        publicNoIndex: noIndex,
        publicTagline: input.tagline || null,
        publicAbout: input.about || null,
        publicAddress: input.address || null,
        publicPhone: input.phone || null,
        publicEmail: input.email || null,
        publicWebsite: input.website || null,
        publicFacebook: input.facebook || null,
        publicInstagram: input.instagram || null,
        publicOpeningHours: (input.openingHours as object[] | null) ?? undefined,
        publicShowMenu: false, // no verified menu for a venue we don't run
        publicShowSpecials: false,
        publicShowPrices: false,
        publicShowBooking: false, // never — nobody is monitoring that inbox
      },
    });

    await tx.venue.create({
      data: {
        businessId: business.id,
        name: input.name,
        isDefault: true,
        active: true,
        address: input.address || null,
        phone: input.phone || null,
        email: input.email || null,
        website: input.website || null,
        geoLat: input.geoLat ?? null,
        geoLng: input.geoLng ?? null,
        venueType: input.venueType || null,
        cuisine: input.cuisine || null,
        timezone: input.timezone || "Europe/Dublin",
      },
    });

    return business;
  });
}
