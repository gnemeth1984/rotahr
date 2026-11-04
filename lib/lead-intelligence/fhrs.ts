/** UK Food Hygiene Rating Scheme public API (free, no key). https://api.ratings.food.gov.uk/help */
import { z } from "zod";
import type { LeadSeed } from "./types";

export const FHRS_API = "https://api.ratings.food.gov.uk";
/** Restaurant/Cafe/Canteen, Hotel/B&B/guest house, Pub/bar/nightclub, Other catering premises. Takeaways and mobile caterers excluded. */
export const FHRS_BUSINESS_TYPES = [1, 7842, 7843, 7841] as const;
export const FHRS_MAX_RATING = 3;

const establishment = z.object({
  FHRSID: z.number().int(), BusinessName: z.string().min(1), BusinessType: z.string().default(""), BusinessTypeID: z.number().int().nullable().optional(),
  AddressLine1: z.string().nullable().optional(), AddressLine2: z.string().nullable().optional(), AddressLine3: z.string().nullable().optional(),
  AddressLine4: z.string().nullable().optional(), PostCode: z.string().nullable().optional(), RatingValue: z.union([z.string(), z.number()]).transform(String),
  RatingDate: z.string().nullable().optional(), LocalAuthorityName: z.string().default(""), Phone: z.string().nullable().optional(), SchemeType: z.string().optional(),
});
const page = z.object({ establishments: z.array(z.unknown()), meta: z.object({ totalPages: z.number().int(), pageNumber: z.number().int() }) });
export type FhrsRecord = { fhrsId: number; businessName: string; address: string; postcode: string; rating: string; ratingDate: Date | null;
  businessType: string; businessTypeId: number | null; localAuthority: string; phone: string | null };

export function parseEstablishments(raw: unknown): { records: FhrsRecord[]; totalPages: number } {
  const p = page.parse(raw);
  const records = p.establishments.flatMap(e => {
    const r = establishment.safeParse(e); if (!r.success) return [];
    const d = r.data;
    // Numeric FHRS ratings only (Scottish FHIS "Pass"/"Improvement Required" and "Exempt" are skipped).
    if (!/^[0-5]$/.test(d.RatingValue) || (d.SchemeType && d.SchemeType !== "FHRS")) return [];
    const date = d.RatingDate ? new Date(`${d.RatingDate.slice(0, 10)}T00:00:00Z`) : null;
    return [{ fhrsId: d.FHRSID, businessName: d.BusinessName.trim(), postcode: (d.PostCode ?? "").trim(), rating: d.RatingValue,
      address: [d.AddressLine1, d.AddressLine2, d.AddressLine3, d.AddressLine4, d.PostCode].map(s => (s ?? "").trim()).filter(Boolean).join(", "),
      ratingDate: date && !Number.isNaN(date.getTime()) ? date : null, businessType: d.BusinessType, businessTypeId: d.BusinessTypeID ?? null,
      localAuthority: d.LocalAuthorityName, phone: d.Phone?.trim() || null }];
  });
  return { records, totalPages: p.meta.totalPages };
}

export const fhrsBusinessUrl = (id: number) => `https://ratings.food.gov.uk/business/${id}`;
export function fhrsQueryUrl(authorityId: number, businessTypeId: number, pageNumber: number) {
  const q = new URLSearchParams({ localAuthorityId: String(authorityId), businessTypeId: String(businessTypeId), ratingKey: String(FHRS_MAX_RATING),
    ratingOperatorKey: "LessThanOrEqual", pageSize: "250", pageNumber: String(pageNumber), sortOptionKey: "rating" });
  return `${FHRS_API}/Establishments?${q}`;
}

/** Full fetch of one authority + business type (all pages). Throws on any failed page so a partial list never supersedes records. */
export async function fetchFhrs(authorityId: number, businessTypeId: number, deadline: number): Promise<FhrsRecord[]> {
  const out: FhrsRecord[] = [];
  for (let n = 1; n <= 8; n++) {
    if (deadline - Date.now() < 3000) throw new Error("FHRS deadline reached");
    const res = await fetch(fhrsQueryUrl(authorityId, businessTypeId, n), { headers: { "x-api-version": "2", accept: "application/json",
      "user-agent": "RotahrLeadIntelligence/2 (+https://rotahr.com)" }, signal: AbortSignal.timeout(Math.min(15000, deadline - Date.now())), cache: "no-store" });
    if (!res.ok) throw new Error(`FHRS API returned ${res.status}`);
    const { records, totalPages } = parseEstablishments(await res.json());
    out.push(...records);
    if (n >= totalPages) return out;
  }
  throw new Error("FHRS result exceeded 8 pages; not superseding.");
}

/** Lead seed. The discovery document deliberately omits the rating so it never reaches AI-written text. */
export function fhrsSeed(r: FhrsRecord, town: string): LeadSeed {
  const url = fhrsBusinessUrl(r.fhrsId);
  return { name: r.businessName, website: null, category: r.businessType || "hospitality", country: "uk", county: "", city: town,
    address: r.address, sourceUrl: url, sourceKind: "fhrs",
    documents: [{ url, kind: "search", fetchedAt: new Date().toISOString(), text: `${r.businessName}\n${r.address}\n${town}\nBusiness type: ${r.businessType}` }] };
}
