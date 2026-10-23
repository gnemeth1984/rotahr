/**
 * Client-safe constants for the template download form. No server imports here:
 * DownloadButtons (a client component) reads these.
 */

/**
 * Whether the follow-up email checkbox starts ticked.
 *
 * The owner chose pre-ticked (22 Oct 2026) for list growth. Note: under GDPR
 * (Recital 32, CJEU Planet49 C-673/17) a pre-ticked box is not valid consent,
 * so the Irish DPC could treat follow-ups sent on that basis as unsolicited.
 * Setting this to false is the whole change needed to make it opt-in. The
 * consent wording and the box's starting state are stored on every lead.
 */
export const CONSENT_DEFAULT_CHECKED = true;

/** The exact wording beside the checkbox. Stored with the lead as the consent record. */
export const CONSENT_TEXT =
  "Also send me more free templates, tips and Rotahr offers (a few short emails, unsubscribe any time).";

export const VENUE_TYPES = [
  { id: "restaurant", label: "Restaurant" },
  { id: "cafe", label: "Café" },
  { id: "bar", label: "Bar / pub" },
  { id: "hotel", label: "Hotel" },
  { id: "catering", label: "Catering" },
  { id: "other", label: "Other" },
] as const;

export type VenueType = (typeof VENUE_TYPES)[number]["id"];

/** Best guess from the template the visitor picked. Empty = no guess. */
export function guessVenueType(category: string): VenueType | "" {
  if (category === "bar") return "bar";
  if (category === "hotel") return "hotel";
  if (["haccp", "open-close", "cleaning", "stock"].includes(category)) return "restaurant";
  return "";
}

/** localStorage key: set once a visitor has given an email, so they aren't asked again. */
export const LEAD_STORAGE_KEY = "rotahr_tpl_email";
