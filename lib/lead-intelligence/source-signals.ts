/** Pure builders for trigger signals and seeds from the free sources (no database access). */
import { fhrsBusinessUrl, type FhrsRecord } from "./fhrs";
import type { FsaiOrderType } from "./fsai";
import { FHRS_REASON, FSAI_POINTS, fhrsPoints } from "./signals";
import { IE_TOWNS } from "./towns";
import type { LeadSeed } from "./types";

export type SignalInput = { type: string; label: string; points: number; sourceUrl: string; detail?: string; eventDate?: Date | null; data?: unknown; fingerprint: string };

export function fhrsSignal(r: Pick<FhrsRecord, "fhrsId" | "rating" | "ratingDate" | "businessType">): SignalInput {
  return { type: "fhrs_rating", label: `Food Hygiene Rating ${r.rating}`, points: fhrsPoints(r.rating), detail: r.rating, eventDate: r.ratingDate,
    sourceUrl: fhrsBusinessUrl(r.fhrsId), fingerprint: `fhrs:${r.fhrsId}`,
    data: { fhrsId: r.fhrsId, rating: r.rating, inspectionDate: r.ratingDate?.toISOString().slice(0, 10) ?? null, businessType: r.businessType, reason: FHRS_REASON } };
}
const ORDER_NAME: Record<FsaiOrderType, string> = { closure: "Closure", prohibition: "Prohibition", improvement: "Improvement" };
export function fsaiSignal(o: { fingerprint: string; orderType: string; dateServed: Date; county: string; businessType: string; orderUrl: string | null; sourceUrl: string; dateLifted: Date | null; premises: string }): SignalInput {
  const type = o.orderType as FsaiOrderType;
  const date = o.dateServed.toISOString().slice(0, 10);
  return { type: `fsai_${type}`, label: `FSAI ${ORDER_NAME[type]} Order (${date})`, points: FSAI_POINTS[type], detail: ORDER_NAME[type], eventDate: o.dateServed,
    sourceUrl: o.orderUrl ?? o.sourceUrl, fingerprint: `fsai:${o.fingerprint}`,
    data: { businessName: o.premises, county: o.county, orderType: ORDER_NAME[type], orderDate: date, dateLifted: o.dateLifted?.toISOString().slice(0, 10) ?? null, businessType: o.businessType } };
}

/** "Dublin 1" / "County Dublin" / "Dublin County" / "Co. Cork" -> "Dublin" / "Cork". */
export function ieCounty(raw: string): string {
  return raw.replace(/^(co\.?|county)\s+/i, "").replace(/\s+county$/i, "").replace(/\s+\d+[a-z]?$/i, "").trim();
}
export function fsaiSeed(o: { premises: string; address: string; county: string; businessType: string; orderUrl: string | null; sourceUrl: string }): LeadSeed {
  const county = ieCounty(o.county);
  const town = IE_TOWNS.find(t => new RegExp(`\\b${t.name.replace(/-/g, "[- ]")}\\b`, "i").test(o.address))?.name ?? county;
  const url = o.orderUrl ?? o.sourceUrl;
  return { name: o.premises, website: null, category: o.businessType || "hospitality", country: "ie", county: county ? `Co. ${county}` : "", city: town,
    address: [o.address, o.county].filter(Boolean).join(", "), sourceUrl: url, sourceKind: "fsai",
    // Order details are not copied into AI evidence; identity only.
    documents: [{ url, kind: "search", fetchedAt: new Date().toISOString(), text: `${o.premises}\n${o.address}\n${o.county}\nBusiness type: ${o.businessType}` }] };
}

