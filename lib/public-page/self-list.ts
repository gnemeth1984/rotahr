import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { createProspectVenuePage } from "./provision";
import { validateSlug } from "./types";

/**
 * Self-service venue listing.
 *
 * WHY THIS EXISTS
 * `createProspectVenuePage()` builds a page for a venue we sourced ourselves, and
 * `findClaimable()` lets the real owner take it over — but only if we already
 * built them a page and already held their email. A venue that hears about
 * Rotahr and simply wants to be listed had no route in at all. Cold outreach
 * offers a free listing, so the landing spot has to exist.
 *
 * OWNERSHIP MODEL
 * The proof of ownership is possession of the mailbox, exactly as in claim.ts.
 * The difference is that here the submitter supplies the address, so a submission
 * proves nothing on its own. Therefore:
 *   - the page is created with `publicPageEnabled: false`, so /v/<slug> 404s
 *     (data.ts requires publicPageEnabled) and it is absent from the sitemap
 *   - a manage link is emailed to the submitted address
 *   - opening that link is what flips the page live
 * So anyone can type a venue name, but only someone who can read that mailbox can
 * publish a page. Nobody can create a live page about a business they don't
 * control, and nobody can silently take over a listing that already exists.
 *
 * `publicProspect` stays true, which keeps the existing claim flow available: the
 * owner can later set a password and convert the listing into a real account
 * without us migrating anything.
 */

const MANAGE_TOKEN_BYTES = 24;

export interface SelfListingInput {
  name: string;
  email: string;
  town?: string | null;
  venueType?: string | null;
  phone?: string | null;
  website?: string | null;
}

export interface SelfListing {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  live: boolean;
  heroImage: string | null;
  tagline: string | null;
  about: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
}

function normaliseEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Deliberately loose - we only need to know it could plausibly receive mail. */
export function looksLikeEmail(email: string) {
  return /^[^@\s]+@[^@\s.]+\.[^@\s]{2,}$/.test(email.trim());
}

function shape(b: {
  id: string;
  name: string;
  publicSlug: string | null;
  publicEmail: string | null;
  publicPageEnabled: boolean;
  publicHeroImage: string | null;
  publicTagline: string | null;
  publicAbout: string | null;
  publicAddress: string | null;
  publicPhone: string | null;
  publicWebsite: string | null;
}): SelfListing {
  return {
    id: b.id,
    name: b.name,
    slug: b.publicSlug ?? "",
    email: b.publicEmail,
    live: b.publicPageEnabled,
    heroImage: b.publicHeroImage,
    tagline: b.publicTagline,
    about: b.publicAbout,
    address: b.publicAddress,
    phone: b.publicPhone,
    website: b.publicWebsite,
  };
}

const SELECT = {
  id: true,
  name: true,
  publicSlug: true,
  publicEmail: true,
  publicPageEnabled: true,
  publicHeroImage: true,
  publicTagline: true,
  publicAbout: true,
  publicAddress: true,
  publicPhone: true,
  publicWebsite: true,
} as const;

/**
 * Create an unpublished listing and return its manage token.
 *
 * Returns `null` when a live page already exists for that name, so the caller can
 * answer identically either way. Telling a stranger "that venue is already
 * listed" would leak which venues we hold, and would let someone probe for an
 * unclaimed page to hijack.
 */
export async function createSelfListing(
  input: SelfListingInput
): Promise<{ listing: SelfListing; token: string } | null> {
  const name = input.name.trim();
  const email = normaliseEmail(input.email);
  if (!name || !looksLikeEmail(email)) return null;

  // An existing listing for this exact name is handled by re-sending its manage
  // link to the address ALREADY on file - never to the submitted one. Otherwise
  // submitting a known venue name with your own address would hand you the page.
  const existing = await prisma.business.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, publicProspect: true },
    select: { ...SELECT, publicClaimToken: true, _count: { select: { users: true } } },
  });

  if (existing) {
    if (existing._count.users > 0) return null; // real account - not up for grabs
    if (!existing.publicEmail || normaliseEmail(existing.publicEmail) !== email) return null;
    const token = await rotateManageToken(existing.id);
    return { listing: shape(existing), token };
  }

  const business = await createProspectVenuePage({
    name,
    email,
    address: input.town?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    venueType: input.venueType?.trim() || null,
    // Unverified: keep it dark until the mailbox is proven, and out of the index
    // until there is real content on it.
    noIndex: true,
  });

  await prisma.business.update({
    where: { id: business.id },
    data: { publicPageEnabled: false },
  });

  const token = await rotateManageToken(business.id);
  const fresh = await prisma.business.findUnique({ where: { id: business.id }, select: SELECT });
  if (!fresh) return null;
  return { listing: shape(fresh), token };
}

/** Rotate on every send so a link in an old inbox or proxy log stops working. */
export async function rotateManageToken(businessId: string): Promise<string> {
  const token = randomBytes(MANAGE_TOKEN_BYTES).toString("base64url");
  await prisma.business.update({ where: { id: businessId }, data: { publicClaimToken: token } });
  return token;
}

/** Look up a listing by manage token. Only ever an unclaimed prospect listing. */
export async function findByManageToken(token: string): Promise<SelfListing | null> {
  if (!token) return null;
  const b = await prisma.business.findFirst({
    where: { publicClaimToken: token, publicProspect: true },
    select: { ...SELECT, _count: { select: { users: true } } },
  });
  if (!b) return null;
  if (b._count.users > 0) return null; // converted to a real account already
  return shape(b);
}

/**
 * Opening the manage link proves the mailbox, so publish the page. Idempotent -
 * the owner will follow this link again to edit, and must not be re-verified.
 */
export async function publishListing(businessId: string): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { publicPageEnabled: true },
  });
}

export interface ListingEdits {
  tagline?: string | null;
  about?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  heroImage?: string | null;
}

const LIMITS: Record<keyof ListingEdits, number> = {
  tagline: 160,
  about: 2000,
  address: 300,
  phone: 40,
  website: 300,
  heroImage: 500,
};

function clean(value: string | null | undefined, max: number): string | null {
  if (value === undefined) return null;
  if (value === null) return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

/**
 * Apply owner edits. Once there is a cover image or an about section there is
 * something worth indexing, so lift `publicNoIndex` - an empty page in the
 * sitemap is a thin-content liability, a real one is an asset.
 */
export async function updateListing(businessId: string, edits: ListingEdits): Promise<SelfListing | null> {
  const data: Record<string, string | null | boolean> = {};
  for (const key of Object.keys(LIMITS) as (keyof ListingEdits)[]) {
    if (edits[key] === undefined) continue;
    data[`public${key[0].toUpperCase()}${key.slice(1)}`] = clean(edits[key], LIMITS[key]);
  }
  if (Object.keys(data).length === 0) {
    return findById(businessId);
  }

  const updated = await prisma.business.update({
    where: { id: businessId },
    data,
    select: SELECT,
  });

  const worthIndexing = Boolean(updated.publicHeroImage || updated.publicAbout || updated.publicAddress);
  if (worthIndexing) {
    await prisma.business.update({ where: { id: businessId }, data: { publicNoIndex: false } });
  }

  // Keep the default Venue in step - it is what the booking form and schema.org
  // output read from, and a listing whose contact details disagree with its own
  // venue row looks broken to both customers and crawlers.
  const venueData: Record<string, string | null> = {};
  if (edits.address !== undefined) venueData.address = clean(edits.address, LIMITS.address);
  if (edits.phone !== undefined) venueData.phone = clean(edits.phone, LIMITS.phone);
  if (edits.website !== undefined) venueData.website = clean(edits.website, LIMITS.website);
  if (Object.keys(venueData).length) {
    await prisma.venue.updateMany({ where: { businessId, isDefault: true }, data: venueData });
  }

  return shape(updated);
}

async function findById(businessId: string): Promise<SelfListing | null> {
  const b = await prisma.business.findUnique({ where: { id: businessId }, select: SELECT });
  return b ? shape(b) : null;
}

export function manageUrl(token: string, siteUrl: string) {
  return `${siteUrl.replace(/\/$/, "")}/list/manage/${token}`;
}

export function listingEmailHtml(opts: { venueName: string; url: string; slug: string; site: string }) {
  const site = opts.site.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <h1 style="font-size:20px;margin:0 0 16px">Finish listing ${escapeHtml(opts.venueName)}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px">
        Thanks for adding ${escapeHtml(opts.venueName)} to Rotahr. One click and the page
        goes live at <strong>${site}/v/${escapeHtml(opts.slug)}</strong>.
      </p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 24px">
        The same link lets you upload a cover photo and edit your details whenever you
        like - no password, no account needed.
      </p>
      <p style="margin:0 0 24px">
        <a href="${opts.url}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Publish my page</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#475569;margin:0 0 8px">
        The listing is free and there is nothing to pay. Until you open this link the
        page stays hidden, so if you didn't request it, ignore this email and it will
        never appear.
      </p>
      <p style="font-size:13px;line-height:1.6;color:#475569;margin:0">
        Keep this email - it's how you get back in to edit the page. Requesting a new
        link replaces this one.
      </p>
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}
