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
 * Listing went live 11 Aug 2026 and is indexed by Google. The URL is the
 * canonical `/p/<id>/Rotahr/` form; the .ca and other regional hosts are the
 * same profile and redirect back to it, so only this one is referenced.
 *
 * Note for anyone checking it from a server: Capterra returns 403 to datacenter
 * IPs regardless of user-agent. The listing is live in a browser — a 403 from a
 * script is bot protection, not a dead page.
 */
export const CAPTERRA_URL: string | null = "https://www.capterra.com/p/10055933/Rotahr/";

/**
 * Review invite link. Capterra hands vendors a dedicated review URL; until we
 * have it, the listing URL is where a reviewer starts anyway.
 */
export const CAPTERRA_REVIEW_URL: string | null = null;

/** True when the listing link is configured and safe to render. */
export function hasCapterraListing(): boolean {
  return typeof CAPTERRA_URL === "string" && CAPTERRA_URL.startsWith("https://");
}
