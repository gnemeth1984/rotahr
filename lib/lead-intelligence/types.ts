import { z } from "zod";

export const MODEL_VERSION = "rotahr-lead-intelligence-v1";
export const SIGNAL_KEYS = [
  "hospitality", "food", "shiftStaff", "events", "functions", "entertainment",
  "beverage", "departments", "sevenDays", "multiLocations", "recruitment",
  "expansion", "investment", "newOpening", "managementHiring", "ownerManaged",
  "facebookActive", "instagramActive",
] as const;
export type SignalKey = typeof SIGNAL_KEYS[number];
export const CONTACT_KEYS = [
  "generalEmail", "reservationsEmail", "managerEmail", "ownerName", "phone",
  "facebook", "instagram", "linkedin", "contactForm",
] as const;
export type ContactKey = typeof CONTACT_KEYS[number];

export type SourceDocument = {
  url: string;
  text: string;
  kind: "website" | "search" | "maps" | "existing";
  fetchedAt: string;
};
const evidenceSchema = z.object({
  sourceUrl: z.string().max(2000),
  quote: z.string().min(3).max(800),
});
const signalSchema = evidenceSchema.extend({
  value: z.boolean(),
  confidence: z.enum(["observed", "inferred"]),
  eventDate: z.string().nullable().optional(),
});
const contactSchema = evidenceSchema.extend({ value: z.string().min(1).max(2000) });
const estimateSchema = evidenceSchema.extend({
  value: z.number().int().min(1).max(100000),
  confidence: z.enum(["stated", "estimated"]),
});

export const extractionSchema = z.object({
  identityConfirmed: z.boolean(),
  description: z.string().max(1500),
  signals: z.partialRecord(z.enum(SIGNAL_KEYS), signalSchema.nullable()),
  contacts: z.partialRecord(z.enum(CONTACT_KEYS), contactSchema.nullable()),
  locationsEstimate: estimateSchema.nullable(),
  staffEstimate: estimateSchema.nullable(),
  notes: z.array(z.string().max(500)).max(12),
});
export type Signal = z.infer<typeof signalSchema>;
export type Extraction = z.infer<typeof extractionSchema>;
export type LeadSeed = {
  name: string;
  website: string | null;
  category: string;
  country: string;
  county: string;
  city: string;
  address: string;
  sourceUrl: string;
  sourceKind: string;
  documents?: SourceDocument[];
};
export const LEAD_STATUSES = ["new", "qualified", "contacted", "callback", "not_interested", "converted", "suppressed"] as const;

export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!["https:", "http:"].includes(u.protocol) || u.username || u.password) return null;
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
    return u.toString().replace(/\/$/, "");
  } catch { return null; }
}
export function isFirstPartyRotahr(raw: string): boolean {
  try { const h = new URL(raw).hostname; return h === "rotahr.com" || h.endsWith(".rotahr.com"); }
  catch { return false; }
}
export function dedupeKey(seed: LeadSeed): string {
  // Do not collapse all venues sharing a hotel/group website into one lead.
  const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
  return [norm(seed.country), norm(seed.name), norm(seed.address || seed.city)].join(":");
}
export function normaliseCountry(v: string): string | null {
  const t = v.trim().toLowerCase();
  if (["ie", "ireland", "republic of ireland"].includes(t)) return "ie";
  if (["uk", "gb", "united kingdom", "england", "scotland", "wales", "northern ireland"].includes(t)) return "uk";
  return null;
}