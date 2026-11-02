import { CONTACT_KEYS, SIGNAL_KEYS, canonicalUrl, isFirstPartyRotahr, type Extraction, type LeadSeed, type SourceDocument } from "./types";

const compact = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const comparable = (s: string) => compact(s).normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, "");

const GENERIC_NAME_WORDS = new Set(["the", "and", "bar", "bars", "restaurant", "hotel", "cafe", "pub", "inn", "ltd", "limited", "co"]);
export function nameTokens(name: string): string[] {
  return (name.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[a-z0-9]{3,}/g) ?? [])
    .filter(n => !GENERIC_NAME_WORDS.has(n)).map(comparable);
}
/** City, county and non-numeric address parts. Postcodes alone are not used to confirm a venue. */
export function locationTokens(seed: LeadSeed): string[] {
  const parts = [seed.city, seed.county.replace(/^(co\.?|county)\s+/i, ""), ...seed.address.split(",")]
    .map(p => p.trim()).filter(p => p.length >= 4 && /[a-z]{4,}/i.test(p) && !/^\d/.test(p));
  return [...new Set(parts.map(comparable).filter(p => p.length >= 4))];
}
const hostOf = (raw: string | null) => { try { return raw ? new URL(raw).hostname.replace(/^www\./, "") : null; } catch { return null; } };
/**
 * A published contact must belong to this venue: either it is on the venue's own website,
 * or the venue name appears close to the quote (directory listings). Directory-owned emails are rejected.
 */
export function contactBelongs(doc: SourceDocument, quote: string, value: string, seed: LeadSeed, names: string[]): boolean {
  const docHost = hostOf(doc.url); const ownHost = hostOf(seed.website);
  if (docHost && ownHost && docHost === ownHost) return true;
  if (doc.kind === "maps") return true; // Maps records are a single business entity.
  const emailDomain = value.includes("@") ? value.split("@").pop()!.toLowerCase().replace(/^www\./, "") : null;
  if (emailDomain && docHost && (emailDomain === docHost || docHost.endsWith(`.${emailDomain}`))) return false;
  const text = compact(doc.text); const at = text.indexOf(compact(quote));
  if (at < 0) return false;
  const window = comparable(text.slice(Math.max(0, at - 400), at + compact(quote).length + 400));
  return names.length > 0 && names.every(n => window.includes(n));
}

/** Quotes must be present in supplied evidence. A model cannot invent a citation. */
export function validateEvidence(raw: Extraction, docs: SourceDocument[], seed: LeadSeed): Extraction {
  const out: Extraction = structuredClone(raw);
  const matching = (sourceUrl: string, quote: string) => docs.find(d =>
    !isFirstPartyRotahr(d.url) && canonicalUrl(d.url) === canonicalUrl(sourceUrl) &&
    compact(d.text).includes(compact(quote)));
  const names = nameTokens(seed.name);
  const locations = locationTokens(seed);
  const hasIdentity = docs.some(d => {
    if (isFirstPartyRotahr(d.url)) return false;
    const text = comparable(d.text);
    const nameMatch = names.length > 0 && names.every(n => text.includes(n));
    return nameMatch && locations.some(l => text.includes(l));
  });
  out.identityConfirmed = raw.identityConfirmed && hasIdentity;
  for (const key of SIGNAL_KEYS) {
    const s = out.signals[key];
    if (!s) continue;
    const doc = matching(s.sourceUrl, s.quote);
    if (!doc || !out.identityConfirmed) { out.signals[key] = null; continue; }
    // Event recency must come from a date visible in the evidence, not crawl time.
    if (s.eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(s.eventDate) || !doc.text.includes(s.eventDate))) s.eventDate = null;
  }
  for (const key of CONTACT_KEYS) {
    const c = out.contacts[key];
    if (!c) continue;
    const doc = matching(c.sourceUrl, c.quote);
    if (!doc || !out.identityConfirmed || !comparable(c.quote).includes(comparable(c.value)) || !contactBelongs(doc, c.quote, c.value, seed, names)) {
      out.contacts[key] = null; continue;
    }
    if (/Email$/.test(key) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.value)) out.contacts[key] = null;
    if (key === "phone" && !/^\+?[\d\s().-]{7,30}$/.test(c.value)) out.contacts[key] = null;
    if (["facebook", "instagram", "linkedin", "contactForm"].includes(key)) {
      const url = canonicalUrl(c.value);
      if (!url) { out.contacts[key] = null; continue; }
      const host = new URL(url).hostname.replace(/^www\./, "");
      const domain = key === "facebook" ? "facebook.com" : key === "instagram" ? "instagram.com" : key === "linkedin" ? "linkedin.com" : null;
      if (domain && host !== domain && !host.endsWith(`.${domain}`)) out.contacts[key] = null;
      else c.value = url;
    }
  }
  for (const key of ["locationsEstimate", "staffEstimate"] as const) {
    const e = out[key];
    if (e && (!out.identityConfirmed || !matching(e.sourceUrl, e.quote))) out[key] = null;
  }
  return out;
}

export function scoreLead(f: Extraction, now = new Date()) {
  const has = (k: keyof Extraction["signals"]) => f.signals[k]?.value === true;
  const observed = (k: keyof Extraction["signals"]) => has(k) && f.signals[k]?.confidence === "observed";
  const complexityBreakdown = {
    food: has("food") ? 2 : 0,
    beverage: has("beverage") ? 1 : 0,
    events: has("events") ? 1 : 0,
    entertainment: has("entertainment") ? 1 : 0,
    functions: has("functions") ? 1 : 0,
    departments: has("departments") ? 1 : 0,
    sevenDays: has("sevenDays") ? 1 : 0,
    multipleLocations: has("multiLocations") ? 2 : 0,
  };
  const complexity = Object.values(complexityBreakdown).reduce((a,b) => a+b, 0);
  const fitBreakdown = {
    hospitality: has("hospitality") ? 20 : 0,
    foodService: has("food") ? 20 : 0,
    staffing: has("shiftStaff") ? (observed("shiftStaff") ? 20 : 15) : 0,
    haccpRelevance: has("food") ? 15 : 0,
    serviceVariety: has("functions") && has("events") ? 15 : has("events") || has("functions") || has("entertainment") ? 10 : 0,
    complexity,
  };
  const fit = f.identityConfirmed && has("hospitality") ? Object.values(fitBreakdown).reduce((a,b) => a+b,0) : null;
  const intentWeights = { recruitment: 25, expansion: 25, investment: 20, newOpening: 20, managementHiring: 10 } as const;
  const intentBreakdown: Record<string, number> = {};
  const used = new Set<string>();
  for (const [key, weight] of Object.entries(intentWeights)) {
    const s = f.signals[key as keyof typeof intentWeights];
    let points = 0;
    if (s?.value && s.confidence === "observed") {
      const age = s.eventDate ? (now.getTime() - new Date(s.eventDate).getTime()) / 86400000 : null;
      const factor = age === null ? 0.5 : age >= -30 && age <= 90 ? 1 : age > 90 && age <= 365 ? 0.5 : age > 365 ? 0.25 : 0;
      const fingerprint = `${canonicalUrl(s.sourceUrl)}:${compact(s.quote)}`;
      if (!used.has(fingerprint)) { points = Math.round(weight * factor); used.add(fingerprint); }
      // The same new venue is not both expansion AND new-opening points.
      if (key === "newOpening" && intentBreakdown.expansion > 0) points = 0;
    }
    intentBreakdown[key] = points;
  }
  const intent = Object.values(intentBreakdown).reduce((a,b) => a+b,0);
  const intentStatus = intent === 0 ? "unknown" : intent <= 25 ? "Cold" : intent <= 50 ? "Warm" : intent <= 75 ? "Interested" : "Hot";
  const email = f.contacts.managerEmail || f.contacts.generalEmail || f.contacts.reservationsEmail;
  const reachabilityBreakdown = {
    email: email ? 30 : 0,
    phone: f.contacts.phone ? 30 : 0,
    facebook: f.contacts.facebook ? (observed("facebookActive") ? 15 : 7) : 0,
    instagram: f.contacts.instagram ? (observed("instagramActive") ? 10 : 5) : 0,
    linkedin: f.contacts.linkedin ? 5 : 0,
    contactForm: f.contacts.contactForm ? 10 : 0,
  };
  const reachability = Object.values(reachabilityBreakdown).reduce((a,b) => a+b,0);
  const priority = Math.round(((fit ?? 0)*0.5 + intent*0.3 + reachability*0.2)*10)/10;
  const classification = fit === null ? "UNQUALIFIED" : fit >= 80 && reachability >= 80 ? "A+" : fit >= 70 ? "A" : fit >= 50 ? "B" : "C";
  const fitCategory = fit === null ? "Unknown" : fit >= 80 ? "Strong Fit" : fit >= 60 ? "Good Fit" : fit >= 40 ? "Possible Fit" : "Poor Fit";
  const decisionMaker = has("multiLocations") ? "Group management / Operations manager" : has("ownerManaged") ? "Owner / Manager" : "General manager (estimated)";
  const bestContactMethod = f.contacts.managerEmail ? "email" : f.contacts.phone ? "phone" : email ? "email" : f.contacts.facebook ? "facebook" : f.contacts.instagram ? "instagram" : f.contacts.contactForm ? "website_form" : null;
  const contactReason = bestContactMethod === "phone" ? "A public business phone is available; ask who manages staff rotas. Response likelihood is an estimate, not measured data."
    : bestContactMethod === "email" ? "A published email is available. Inbox monitoring and deliverability are not verified."
    : bestContactMethod ? "A public contact channel is available; monitoring and response likelihood remain unknown." : "No public contact method verified.";
  const reasoning = [
    fit === null ? "Insufficient identity/hospitality evidence: unqualified, not a proven poor prospect." : `${fitCategory}: hospitality, food handling and staffing needs are scored separately from purchase timing.`,
    has("food") ? "HACCP relevance is inferred from food preparation, not a claim about their current compliance practices." : "Food preparation was not established.",
    intent === 0 ? "Buying intent unknown: no verified positive intent signal. This does not reduce fit." : "Buying intent reflects observed signals, discounted when event dates are unknown or old.",
    "Priority uses 50% fit, 30% observed intent and 20% reachability. Unknown intent contributes zero ranking points but is not labelled unwilling to buy.",
    "Staff/location estimates and decision-maker recommendations are not verified headcounts or roles.",
  ];
  return { fit, fitCategory, intent, intentStatus, complexity: fit === null ? null : complexity, reachability, priority, classification, decisionMaker, bestContactMethod, contactReason, fitBreakdown, intentBreakdown, complexityBreakdown, reachabilityBreakdown, reasoning };
}

/** Draft wording is composed from validated facts, never unverified model prose. */
export function generateDrafts(seed: LeadSeed, f: Extraction) {
  const has = (k: keyof Extraction["signals"]) => f.signals[k]?.value === true;
  const observation = has("functions") ? "you cater for private functions" : has("entertainment") ? "you host live entertainment" : has("food") ? "you serve food" : "your hospitality business";
  const greeting = f.contacts.ownerName ? `Hi ${f.contacts.ownerName.value.split(" ")[0]} and team,` : `Hi ${seed.name} team,`;
  const intro = observation === "your hospitality business" ? `I came across ${seed.name}${seed.city ? ` in ${seed.city}` : ""}.` : `I came across ${seed.name}${seed.city ? ` in ${seed.city}` : ""} and noticed ${observation}.`;
  const angle = has("events") || has("functions") ? "Coordinating staff cover around events can add work for whoever manages the rota." : "Keeping shift cover and staff updates organised can mean extra work for hospitality managers.";
  let emailBody = `${greeting}\n\n${intro}\n\n${angle}\n\nRotahr brings staff scheduling, team communication${has("food") ? " and HACCP records" : ""} into one place.\n\nWould you be open to a quick look to see whether it could suit your team?\n\nKind regards,\nGabor\nFounder, Rotahr`;
  const followupBody = `${greeting}\n\nJust following up on my note about ${seed.name}. If managing rotas${has("events") || has("functions") ? " around functions and events" : " and staff updates"} is something you would like to simplify, I would be happy to show you Rotahr.\n\nIf it is not a priority, no problem.\n\nKind regards,\nGabor\nFounder, Rotahr`;
  const phoneOpener = `Hi, it's Gabor from Rotahr. We help hospitality venues manage staff rotas and team communication${has("functions") ? ", including cover for functions and events" : ""}. Who would be the best person to speak to about that at ${seed.name}?`;
  const count = (s: string) => s.trim().split(/\s+/).length;
  // Long business names can push the email over 120 words; drop the optional angle sentence first.
  if (count(emailBody) > 120) emailBody = emailBody.replace(`${angle}\n\n`, "");
  if (count(emailBody) > 120 || count(followupBody) > 120) throw new Error("Draft exceeds 120-word limit; review business name length.");
  return { emailSubject: `Staff rotas at ${seed.name}`, emailBody, followupSubject: `Following up: ${seed.name}`, followupBody, phoneOpener };
}