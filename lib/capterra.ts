/**
 * Capterra listing.
 *
 * Rotahr is published on Capterra (Gartner Digital Markets). Two reasons to
 * link it from our own site rather than leave it floating:
 *
 *  1. Buyers check a directory before they trust a new vendor. A link from
 *     rotahr.com to the listing and back is what ties the two identities
 *     together — otherwise the listing is a stranger with the same name.
 *  2. `sameAs` in the Organization schema tells a crawler the directory
 *     profile and this site are the same entity, which is how a new brand
 *     accumulates the signals a knowledge panel is built from.
 *
 * Set CAPTERRA_URL to the canonical listing URL (`https://www.capterra.com/p/<id>/Rotahr/`).
 * While it is null every consumer below renders nothing — a placeholder or a
 * guessed URL would be a broken outbound link on the landing page, which is
 * worse than no link at all.
 */
export const CAPTERRA_URL: string | null = null;

/**
 * Review invite link. Capterra hands vendors a dedicated review URL; until we
 * have it, the listing URL is where a reviewer starts anyway.
 */
export const CAPTERRA_REVIEW_URL: string | null = null;

/** True when the listing link is configured and safe to render. */
export function hasCapterraListing(): boolean {
  return typeof CAPTERRA_URL === "string" && CAPTERRA_URL.startsWith("https://");
}
