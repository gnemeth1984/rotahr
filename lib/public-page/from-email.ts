import { prisma } from "@/lib/prisma";
import { normaliseEmail } from "@/lib/email/suppression";
import { extractVenueFromUrl, type ExtractedVenue } from "@/lib/ai/venue-extract";
import { createProspectVenuePage, hasIndexableContent } from "./provision";
import { isTakenDown } from "./takedown";

/**
 * Turn a bare email address into a live prospect page.
 *
 * This is the piece that was missing. `extractVenueFromUrl()` already builds a
 * venue record from a URL, but the input we actually have is an address someone
 * typed — so the work here is getting from `info@thealgiersinn.ie` to a page
 * worth emailing about, and refusing to publish when we can't.
 *
 * WHY IT REFUSES RATHER THAN PUBLISHES A THIN PAGE
 * A page with nothing but a name is useless to the venue and actively harmful to
 * us: it can't be indexed, it makes the "I built you a page" email look like
 * spam, and a pile of them drags the whole domain down in search. So a build
 * that finds no address, no hours and no description fails loudly and asks for a
 * URL instead of quietly creating something embarrassing.
 */

/** Free-mail domains that tell us nothing about the venue's own website. */
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.co.uk",
  "outlook.com",
  "outlook.ie",
  "live.com",
  "live.ie",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.ie",
  "icloud.com",
  "me.com",
  "aol.com",
  "eircom.net",
  "gmx.com",
  "protonmail.com",
  "proton.me",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
]);

export function domainFromEmail(email: string): string | null {
  const at = normaliseEmail(email).split("@");
  if (at.length !== 2 || !at[1].includes(".")) return null;
  return at[1];
}

export function isGenericDomain(email: string): boolean {
  const d = domainFromEmail(email);
  return d ? GENERIC_DOMAINS.has(d) : false;
}

/**
 * Find the venue's website from its email domain.
 *
 * Tries https and http, with and without www, and requires a response that
 * actually looks like a site rather than a parked-domain placeholder. A mail
 * domain very often has no website at all, so this returning null is normal and
 * not an error.
 */
export async function websiteFromEmail(email: string): Promise<string | null> {
  const domain = domainFromEmail(email);
  if (!domain || GENERIC_DOMAINS.has(domain)) return null;

  const candidates = [
    `https://${domain}`,
    `https://www.${domain}`,
    `http://${domain}`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      // A parked domain returns 200 with almost nothing on it. Publishing a page
      // built from a registrar placeholder would be worse than not building one.
      if (html.length < 600) continue;
      if (/domain (is )?(for sale|parked)|buy this domain|godaddy\.com\/domainfind/i.test(html)) continue;
      return res.url || url;
    } catch {
      // next candidate
    }
  }
  return null;
}

export interface BuildFromEmailInput {
  email: string;
  /** Overrides the guessed website. Use when the domain has no site (Facebook, Google Maps). */
  sourceUrl?: string | null;
  /** Overrides the extracted name. */
  name?: string | null;
  city?: string | null;
}

export type BuildFromEmailResult =
  | {
      ok: true;
      businessId: string;
      slug: string;
      name: string;
      takedownToken: string;
      extracted: ExtractedVenue;
      sourceUrl: string;
      indexable: boolean;
      warnings: string[];
    }
  | { ok: false; error: string; needsUrl?: boolean };

/**
 * Build and publish a prospect page from an email address.
 *
 * Does NOT send anything. Sending is a separate, explicit step so the page can
 * be looked at before a real venue is told it exists.
 */
export async function buildPageFromEmail(
  input: BuildFromEmailInput
): Promise<BuildFromEmailResult> {
  const email = normaliseEmail(input.email);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "That isn't a valid email address." };
  }

  // Never rebuild a page for a venue that asked to be removed. Checked here as
  // well as inside createProspectVenuePage so the caller gets a clear message
  // instead of a thrown error after doing all the enrichment work.
  const takenDownByEmail = await prisma.listingTakedown.findFirst({ where: { email } });
  if (takenDownByEmail) {
    return { ok: false, error: "This venue previously asked to be removed. Not rebuilding." };
  }

  // Already have a page for this address? Return it rather than making a second.
  const existing = await prisma.business.findFirst({
    where: { publicEmail: email, publicProspect: true },
    select: { id: true, name: true, publicSlug: true, publicTakedownToken: true },
  });
  if (existing?.publicSlug) {
    return {
      ok: false,
      error: `A page already exists for this address: /v/${existing.publicSlug}`,
    };
  }

  const sourceUrl = input.sourceUrl?.trim() || (await websiteFromEmail(email));
  if (!sourceUrl) {
    return {
      ok: false,
      needsUrl: true,
      error: isGenericDomain(email)
        ? "That's a free email address (gmail, hotmail…), so there's no website to read. Paste their website, Facebook page or Google Maps link."
        : "Couldn't find a working website on that email's domain. Paste their website, Facebook page or Google Maps link.",
    };
  }

  const extracted = await extractVenueFromUrl(sourceUrl);

  const name = input.name?.trim() || extracted.name;
  if (!name) {
    return {
      ok: false,
      needsUrl: true,
      error: "Couldn't work out the venue's name from that source. Add the name by hand or paste a better link.",
    };
  }

  if (await isTakenDown(name, email)) {
    return { ok: false, error: `${name} previously asked to be removed. Not rebuilding.` };
  }

  // Refuse to publish a page with nothing on it.
  const indexable = hasIndexableContent({
    address: extracted.address,
    about: extracted.about,
    openingHours: extracted.openingHours,
  });
  if (!indexable) {
    return {
      ok: false,
      needsUrl: true,
      error:
        `Found the site but almost nothing usable on it — no address, hours or description. ` +
        `A page with just a name isn't worth emailing about. Paste their Google Maps link, which usually has the address.`,
    };
  }

  const business = await createProspectVenuePage({
    name,
    about: extracted.about,
    tagline: extracted.tagline,
    address: extracted.address,
    phone: extracted.phone,
    email,
    website: extracted.website ?? sourceUrl,
    facebook: extracted.facebook,
    instagram: extracted.instagram,
    venueType: extracted.venueType,
    cuisine: extracted.cuisine,
    geoLat: extracted.geoLat,
    geoLng: extracted.geoLng,
    openingHours: extracted.openingHours,
  });

  const warnings = [...extracted.notesForReview];
  if (!extracted.phone) warnings.push("No phone number found.");

  return {
    ok: true,
    businessId: business.id,
    slug: business.publicSlug!,
    name: business.name,
    takedownToken: business.publicTakedownToken!,
    extracted,
    sourceUrl,
    indexable,
    warnings: warnings.slice(0, 8),
  };
}
