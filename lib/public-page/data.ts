import { prisma } from "@/lib/prisma";
import {
  normaliseOpeningHours,
  PUBLIC_SPECIAL_CATEGORIES,
  type OpeningHoursEntry,
} from "./types";

/**
 * Everything the public page is allowed to know. Deliberately a hand-written
 * shape rather than a Prisma payload type, so that adding a column to Business
 * or Dish can never silently expose it publicly.
 */
export interface PublicVenueData {
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  heroImage: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  bookingUrl: string | null;
  currency: string;
  venueType: string | null;
  cuisine: string | null;
  geoLat: number | null;
  geoLng: number | null;
  openingHours: OpeningHoursEntry[];
  noIndex: boolean;
  showBooking: boolean;
  showPrices: boolean;
  dishes: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    price: number | null;
    image: string | null;
  }[];
  specials: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    date: Date;
    endDate: Date | null;
    image: string | null;
  }[];
}

/**
 * Load a published public page by slug, or null.
 *
 * Returns null (-> 404) when the page is disabled, so toggling it off in
 * Settings takes the page down immediately.
 */
export async function getPublicVenue(slug: string): Promise<PublicVenueData | null> {
  const business = await prisma.business.findUnique({
    where: { publicSlug: slug },
    select: {
      id: true,
      name: true,
      currency: true,
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
      // Default venue supplies contact/location fallbacks. NOTE: `notes` and
      // `equipment` are internal and must never be selected here.
      venues: {
        where: { isDefault: true, active: true },
        take: 1,
        select: {
          address: true,
          phone: true,
          email: true,
          website: true,
          geoLat: true,
          geoLng: true,
          venueType: true,
          cuisine: true,
        },
      },
    },
  });

  if (!business || !business.publicPageEnabled || !business.publicSlug) return null;

  const venue = business.venues[0] ?? null;

  // Menu: only active dishes. costPrice is never selected.
  const dishes = business.publicShowMenu
    ? await prisma.dish.findMany({
        where: { businessId: business.id, active: true },
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          sellPrice: true,
          imageUrl: true,
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
        take: 200,
      })
    : [];

  // Specials: current only, and only guest-facing categories.
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const specials = business.publicShowSpecials
    ? await prisma.menuSpecial.findMany({
        where: {
          businessId: business.id,
          archived: false,
          category: { in: PUBLIC_SPECIAL_CATEGORIES },
          OR: [
            { endDate: null, date: { gte: todayStart } },
            { endDate: { gte: todayStart } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          date: true,
          endDate: true,
          imageUrl: true,
        },
        orderBy: [{ pinned: "desc" }, { date: "asc" }],
        take: 12,
      })
    : [];

  return {
    name: business.name,
    slug: business.publicSlug,
    tagline: business.publicTagline,
    about: business.publicAbout,
    heroImage: business.publicHeroImage,
    phone: business.publicPhone || venue?.phone || null,
    email: business.publicEmail || venue?.email || null,
    address: business.publicAddress || venue?.address || null,
    website: business.publicWebsite || venue?.website || null,
    instagram: business.publicInstagram,
    facebook: business.publicFacebook,
    bookingUrl: business.publicBookingUrl,
    currency: business.currency || "EUR",
    venueType: venue?.venueType ?? null,
    cuisine: venue?.cuisine ?? null,
    geoLat: venue?.geoLat ?? null,
    geoLng: venue?.geoLng ?? null,
    openingHours: normaliseOpeningHours(business.publicOpeningHours),
    noIndex: business.publicNoIndex,
    showBooking: business.publicShowBooking,
    showPrices: business.publicShowPrices,
    dishes: dishes.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      category: d.category,
      price: business.publicShowPrices ? d.sellPrice : null,
      image: d.imageUrl,
    })),
    specials: specials.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category,
      date: s.date,
      endDate: s.endDate,
      image: s.imageUrl,
    })),
  };
}

/** Slugs of every live public page — used by the sitemap. */
export async function listPublicVenueSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
  const rows = await prisma.business.findMany({
    where: { publicPageEnabled: true, publicNoIndex: false, publicSlug: { not: null } },
    select: { publicSlug: true, updatedAt: true },
  });
  return rows
    .filter((r): r is { publicSlug: string; updatedAt: Date } => Boolean(r.publicSlug))
    .map((r) => ({ slug: r.publicSlug, updatedAt: r.updatedAt }));
}
