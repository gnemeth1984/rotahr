import { prisma } from "@/lib/prisma";
import { normaliseEmail } from "@/lib/email/suppression";
import { extractVenueFromUrl, type ExtractedVenue } from "@/lib/ai/venue-extract";
import { createProspectVenuePage, hasIndexableContent } from "./provision";
import { isTakenDown } from "./takedown";
import { discoverContacts, type DiscoveredContacts } from "./contact-discovery";

/**
 * Build a page from a URL — a Google Maps pin, a Facebook page, a website.
 *
 * WHY THIS EXISTS SEPARATELY FROM from-email.ts
 * That path takes an address and works out the website. This one has no address
 * at all, which changes what the page can do:
 *
 *   - The page still earns search traffic and still carries "Is this your
 *     venue?".
 *   - It CANNOT be invited, because there is nobody to invite.
 *   - It CANNOT be claimed until an address exists, because the claim flow
 *     proves ownership by emailing the address already on file and deliberately
 *     never accepts one from the request.
 *
 * So a page built this way is a search asset, not a lead, until discovery or a
 * human supplies a contact. That is stated in the result rather than left for
 * someone to find out when the invite button does nothing.
 */

export interface BuildFromUrlInput {
  url: string;
  /** Overrides the extracted name. */
  name?: string | null;
  /** Skip contact discovery (it costs several fetches). */
  discover?: boolean;
  /** Address supplied by hand, e.g. read off a Maps listing by eye. */
  email?: string | null;
}

export type BuildFromUrlResult =
  | {
      ok: true;
      businessId: string;
      slug: string;
      name: string;
      takedownToken: string;
      extracted: ExtractedVenue;
      sourceUrl: string;
      /** Address stored on the page, if any. */
      email: string | null;
      /** True when there is no contact at all — page is unclaimable for now. */
      needsContact: boolean;
      contacts: DiscoveredContacts | null;
      warnings: string[];
    }
  | { ok: false; error: string; contacts?: DiscoveredContacts | null };

function normaliseUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function buildPageFromUrl(input: BuildFromUrlInput): Promise<BuildFromUrlResult> {
  const url = normaliseUrl(input.url);
  if (!url) return { ok: false, error: "That isn't a usable URL." };

  const extracted = await extractVenueFromUrl(url);

  const name = input.name?.trim() || extracted.name;
  if (!name) {
    return {
      ok: false,
      error:
        "Couldn't work out the venue's name from that link. Google Maps share links (maps.app.goo.gl) often hide everything — try the full /place/ URL, or type the name in by hand.",
    };
  }

  // Refuse to publish when the ONLY evidence is a name match on OpenStreetMap.
  //
  // This is not theoretical. Google Maps blocks server-side fetches, so a pasted
  // Maps link often yields nothing but a name, which then gets looked up on OSM.
  // A test with a Dublin pub published a New York address that way: same name,
  // different continent. Coordinates are now checked against the pin, but a
  // single unverified name match is still too weak to put a real business's
  // address on a public page under our domain.
  // A name match is only trustworthy when it was anchored to the pin's
  // coordinates. Bounded to the map pin, "The Long Hall" resolves to the right
  // Dublin pub; unbounded, the same query returns a bar in Manhattan 5,111km
  // away. So OSM-only is allowed when the URL carried coordinates to check
  // against, and refused when it didn't.
  const used = extracted.sourcesUsed;
  const onlyOsm = used.length > 0 && used.every((s) => s === "OpenStreetMap");
  const hadPin = /@(-?\d+\.\d+),(-?\d+\.\d+)/.test(url);
  if (onlyOsm && !hadPin) {
    return {
      ok: false,
      error:
        `Only found "${name}" by name-matching OpenStreetMap, with no coordinates in the link to check it against — ` +
        `venue names repeat across countries, so this could easily be the wrong place. Paste the full Google Maps ` +
        `/place/ URL (the one with @lat,long in it), or the venue's own website.`,
    };
  }

  // Refuse a thin page for the same reason as the email path: a name-only page
  // can't be indexed and a pile of them drags the domain down in search.
  if (
    !hasIndexableContent({
      address: extracted.address,
      about: extracted.about,
      openingHours: extracted.openingHours,
    })
  ) {
    return {
      ok: false,
      error: `Found "${name}" but no address, hours or description — nothing worth publishing. Try the full Google Maps /place/ link, which almost always has the address.`,
    };
  }

  if (await isTakenDown(name, input.email ?? extracted.email)) {
    return { ok: false, error: `${name} previously asked to be removed. Not rebuilding.` };
  }

  // Hunt for a contact before creating anything, so the page is created with the
  // address already on it and is claimable from the moment it exists.
  let contacts: DiscoveredContacts | null = null;
  if (input.discover !== false) {
    contacts = await discoverContacts({
      name,
      website: extracted.website ?? (/facebook\.com|google\./i.test(url) ? null : url),
      facebook: extracted.facebook,
      instagram: extracted.instagram,
      knownPhone: extracted.phone,
    });
  }

  const handEmail = input.email?.trim() ? normaliseEmail(input.email) : null;
  // Only auto-adopt an address whose domain can actually receive mail.
  const best = contacts?.emails.find((c) => c.mx !== "no-mx") ?? null;
  const email = handEmail || extracted.email || best?.value || null;

  if (email) {
    const dupe = await prisma.business.findFirst({
      where: { publicEmail: email, publicProspect: true },
      select: { publicSlug: true },
    });
    if (dupe?.publicSlug) {
      return {
        ok: false,
        error: `A page already exists for ${email}: /v/${dupe.publicSlug}`,
        contacts,
      };
    }
  }

  // Same venue, no email, built twice would make two pages. Name+address is the
  // only handle we have, so use it.
  const existingByName = await prisma.business.findFirst({
    where: {
      publicProspect: true,
      name,
      ...(extracted.address ? { publicAddress: extracted.address } : {}),
    },
    select: { publicSlug: true },
  });
  if (existingByName?.publicSlug) {
    return {
      ok: false,
      error: `A page already exists for ${name}: /v/${existingByName.publicSlug}`,
      contacts,
    };
  }

  const business = await createProspectVenuePage({
    name,
    about: extracted.about,
    tagline: extracted.tagline,
    address: extracted.address,
    phone: extracted.phone || contacts?.phones[0]?.value || null,
    email,
    website: extracted.website,
    facebook: extracted.facebook ?? contacts?.socials.find((s) => /facebook/i.test(s.value))?.value ?? null,
    instagram: extracted.instagram ?? contacts?.socials.find((s) => /instagram/i.test(s.value))?.value ?? null,
    venueType: extracted.venueType,
    cuisine: extracted.cuisine,
    geoLat: extracted.geoLat,
    geoLng: extracted.geoLng,
    openingHours: extracted.openingHours,
  });

  const warnings = [...extracted.notesForReview, ...(contacts?.notes ?? [])];
  if (onlyOsm) {
    warnings.unshift(
      "Everything on this page came from OpenStreetMap matched to the map pin — Google Maps itself can't be read. Open the page and check the address before inviting anyone."
    );
  }
  if (!email) {
    warnings.unshift(
      "No contact address — this page can't be invited or claimed until one is added."
    );
  } else if (best && email === best.value) {
    warnings.unshift(`Email found on ${best.source} — check it looks right before sending.`);
  }
  if (!extracted.phone && !contacts?.phones.length) warnings.push("No phone number found.");

  return {
    ok: true,
    businessId: business.id,
    slug: business.publicSlug!,
    name: business.name,
    takedownToken: business.publicTakedownToken!,
    extracted,
    sourceUrl: url,
    email,
    needsContact: !email,
    contacts,
    warnings: warnings.slice(0, 10),
  };
}

/**
 * Attach a contact address to an existing page.
 *
 * Separate from the build so a page created blind can become invitable later,
 * once discovery, a phone call or a walk past the window turns up an address.
 */
export async function setPageContact(
  businessId: string,
  email: string
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const e = normaliseEmail(email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: "That isn't a valid email address." };

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, publicProspect: true },
  });
  if (!biz) return { ok: false, error: "No page with that id." };
  if (!biz.publicProspect) return { ok: false, error: "That business is claimed — not editing its contact." };

  const clash = await prisma.business.findFirst({
    where: { publicEmail: e, publicProspect: true, NOT: { id: businessId } },
    select: { publicSlug: true },
  });
  if (clash) return { ok: false, error: `That address is already on /v/${clash.publicSlug}.` };

  if (await isTakenDown(biz.name, e)) {
    return { ok: false, error: "That venue asked to be removed — not re-attaching a contact." };
  }

  await prisma.business.update({ where: { id: businessId }, data: { publicEmail: e } });
  // The claim flow reads the default venue's email as a fallback, so keep both
  // in step rather than leaving a stale address behind.
  await prisma.venue.updateMany({
    where: { businessId, isDefault: true },
    data: { email: e },
  });
  return { ok: true, email: e };
}
