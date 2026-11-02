// Offline unit tests for Lead Intelligence scoring, evidence validation and drafts.
// Run: bun test tests/lead-intelligence
// Fixtures below are synthetic test documents, not live crawl results.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { contactBelongs, generateDrafts, locationTokens, nameTokens, scoreLead, validateEvidence } from "../../lib/lead-intelligence/scoring";
import { canonicalUrl, dedupeKey, isFirstPartyRotahr, normaliseCountry, type Extraction, type LeadSeed, type SourceDocument } from "../../lib/lead-intelligence/types";

const LISTING = "https://listowel.ie/listing/christys-the-well-bar";
const KERRY = "https://www.discoverkerry.com/listing/christys-bar-%7C-restaurant/69579101";
const now = new Date("2026-11-02T06:00:00Z");

export const christySeed: LeadSeed = {
  name: "Christy's Bar The Well", website: null, category: "pub", country: "ie", county: "Co. Kerry",
  city: "Listowel", address: "Church Street, Listowel, Co. Kerry", sourceUrl: LISTING, sourceKind: "manual",
};
export const christyDocs: SourceDocument[] = [
  { url: LISTING, kind: "search", fetchedAt: now.toISOString(), text:
    "Christy's The Well Bar, Listowel. Traditional bar serving food daily with live music at weekends. " +
    "We cater for private functions, parties and events. Contact Christy's The Well: email christywalsh2021@gmail.com phone +353 68 57922. " +
    "Facebook https://www.facebook.com/christythewell/ Instagram https://www.instagram.com/christysthewell/" },
  { url: KERRY, kind: "search", fetchedAt: now.toISOString(), text:
    "Christy's Bar | Restaurant, Listowel, Co. Kerry. Bar and restaurant with kitchen and bar teams, open for lunch and dinner." },
];
const sig = (url: string, quote: string, extra: Partial<{ value: boolean; confidence: "observed" | "inferred"; eventDate: string | null }> = {}) =>
  ({ value: true, confidence: "observed" as const, sourceUrl: url, quote, eventDate: null, ...extra });
export function christyExtraction(): Extraction {
  return {
    identityConfirmed: true,
    description: "Traditional bar and restaurant in Listowel.",
    signals: {
      hospitality: sig(LISTING, "Traditional bar serving food daily"),
      food: sig(LISTING, "serving food daily"),
      beverage: sig(LISTING, "Traditional bar"),
      shiftStaff: sig(KERRY, "kitchen and bar teams", { confidence: "inferred" }),
      departments: sig(KERRY, "kitchen and bar teams"),
      entertainment: sig(LISTING, "live music at weekends"),
      functions: sig(LISTING, "We cater for private functions"),
      events: sig(LISTING, "parties and events"),
      sevenDays: sig(LISTING, "serving food daily", { confidence: "inferred" }),
    },
    contacts: {
      generalEmail: { value: "christywalsh2021@gmail.com", sourceUrl: LISTING, quote: "email christywalsh2021@gmail.com" },
      phone: { value: "+353 68 57922", sourceUrl: LISTING, quote: "phone +353 68 57922" },
      facebook: { value: "https://www.facebook.com/christythewell/", sourceUrl: LISTING, quote: "Facebook https://www.facebook.com/christythewell/" },
      instagram: { value: "https://www.instagram.com/christysthewell/", sourceUrl: LISTING, quote: "Instagram https://www.instagram.com/christysthewell/" },
    },
    locationsEstimate: null, staffEstimate: null, notes: [],
  };
}

describe("Christy's Bar The Well scenario (synthetic fixture)", () => {
  const facts = validateEvidence(christyExtraction(), christyDocs, christySeed);
  const s = scoreLead(facts, now);
  test("identity and all cited evidence survive validation", () => {
    assert.equal(facts.identityConfirmed, true);
    assert.ok(facts.signals.functions && facts.contacts.generalEmail && facts.contacts.phone);
  });
  test("strong fit with unknown intent: intent does not reduce fit", () => {
    assert.equal(s.fit, 93); // shift staffing is inferred (15, not 20)
    assert.equal(s.intent, 0);
    assert.equal(s.intentStatus, "unknown");
    assert.notEqual(s.intentStatus, "Cold");
    assert.match(s.reasoning.join(" "), /does not reduce fit/);
  });
  test("complexity, reachability, priority and classification", () => {
    assert.equal(s.complexity, 8); // food2 beverage1 events1 entertainment1 functions1 departments1 sevenDays1
    assert.equal(s.reachability, 30 + 30 + 7 + 5); // no dated active-post evidence for socials
    assert.equal(s.priority, Math.round((93 * 0.5 + 0 * 0.3 + 72 * 0.2) * 10) / 10);
    assert.equal(s.classification, "A"); // fit >=80 but reachability <80, so not A+
  });
  test("drafts are within 120 words and use only validated facts", () => {
    const d = generateDrafts(christySeed, facts);
    const words = (t: string) => t.trim().split(/\s+/).length;
    assert.ok(words(d.emailBody) <= 120 && words(d.followupBody) <= 120);
    assert.match(d.emailBody, /private functions/);
    assert.match(d.emailBody, /HACCP/);
    assert.doesNotMatch(d.emailBody, /Christy and team/); // owner not evidenced -> no first-name greeting
  });
});

describe("evidence validation rejects unsupported claims", () => {
  test("fabricated quote is dropped", () => {
    const x = christyExtraction();
    x.signals.recruitment = sig(LISTING, "We are hiring chefs now");
    assert.equal(validateEvidence(x, christyDocs, christySeed).signals.recruitment, null);
  });
  test("quote attributed to the wrong URL is dropped", () => {
    const x = christyExtraction();
    x.signals.functions = sig(KERRY, "We cater for private functions");
    assert.equal(validateEvidence(x, christyDocs, christySeed).signals.functions, null);
  });
  test("Rotahr-owned page cannot be prospect evidence", () => {
    const docs = [{ url: "https://rotahr.com/venues/christys", kind: "search" as const, fetchedAt: now.toISOString(), text: "Christy's Bar The Well Listowel We are hiring chefs" }];
    const x = christyExtraction(); x.signals = { recruitment: sig("https://rotahr.com/venues/christys", "We are hiring chefs") };
    const v = validateEvidence(x, docs, christySeed);
    assert.equal(v.identityConfirmed, false);
    assert.equal(v.signals.recruitment, null);
  });
  test("same-name venue in another town fails identity", () => {
    const docs = [{ url: "https://example-galway.ie/the-well", kind: "search" as const, fetchedAt: now.toISOString(), text: "Christy's Bar The Well, Salthill, Galway. Food served daily." }];
    const x = christyExtraction(); x.signals = { hospitality: sig("https://example-galway.ie/the-well", "Food served daily") };
    const v = validateEvidence(x, docs, christySeed);
    assert.equal(v.identityConfirmed, false);
    assert.equal(scoreLead(v, now).fit, null);
    assert.equal(scoreLead(v, now).classification, "UNQUALIFIED");
  });
  test("contact value must appear inside its quote", () => {
    const x = christyExtraction();
    x.contacts.managerEmail = { value: "manager@christys.ie", sourceUrl: LISTING, quote: "email christywalsh2021@gmail.com" };
    assert.equal(validateEvidence(x, christyDocs, christySeed).contacts.managerEmail, null);
  });
  test("directory-owned email on a directory page is rejected", () => {
    const docs: SourceDocument[] = [{ ...christyDocs[0], text: christyDocs[0].text + " Listing enquiries: info@listowel.ie" }];
    const x = christyExtraction();
    x.contacts.generalEmail = { value: "info@listowel.ie", sourceUrl: LISTING, quote: "Listing enquiries: info@listowel.ie" };
    assert.equal(validateEvidence(x, docs, christySeed).contacts.generalEmail, null);
  });
  test("a contact far from the venue name on a directory page is rejected", () => {
    const filler = " Other listings in the area include many shops and services.".repeat(20);
    const doc: SourceDocument = { url: LISTING, kind: "search", fetchedAt: now.toISOString(), text: `Christy's The Well Bar, Listowel.${filler} Call Listowel Tourism on 068 22590` };
    assert.equal(contactBelongs(doc, "Call Listowel Tourism on 068 22590", "068 22590", christySeed, nameTokens(christySeed.name)), false);
  });
  test("social URLs must be on the right platform", () => {
    const docs: SourceDocument[] = [{ ...christyDocs[0], text: christyDocs[0].text + " Facebook https://evil.example/christythewell" }];
    const x = christyExtraction();
    x.contacts.facebook = { value: "https://evil.example/christythewell", sourceUrl: LISTING, quote: "Facebook https://evil.example/christythewell" };
    assert.equal(validateEvidence(x, docs, christySeed).contacts.facebook, null);
  });
  test("eventDate must be visible in the cited document", () => {
    const x = christyExtraction();
    x.signals.investment = sig(LISTING, "We cater for private functions", { eventDate: "2026-10-01" });
    assert.equal(validateEvidence(x, christyDocs, christySeed).signals.investment?.eventDate, null);
  });
});

describe("intent scoring", () => {
  const base = (): Extraction => ({ ...christyExtraction(), contacts: {} });
  test("undated observed signal is discounted 50%", () => {
    const x = base(); x.signals.recruitment = sig(LISTING, "hiring");
    assert.equal(scoreLead(x, now).intentBreakdown.recruitment, 13);
  });
  test("recent dated signal counts fully; >1 year counts 25%", () => {
    const x = base();
    x.signals.recruitment = sig(LISTING, "hiring", { eventDate: "2026-10-20" });
    x.signals.investment = sig(KERRY, "refurbished", { eventDate: "2024-01-01" });
    const s = scoreLead(x, now);
    assert.equal(s.intentBreakdown.recruitment, 25);
    assert.equal(s.intentBreakdown.investment, 5);
  });
  test("inferred buying signals score nothing", () => {
    const x = base(); x.signals.expansion = sig(LISTING, "growing", { confidence: "inferred" });
    assert.equal(scoreLead(x, now).intent, 0);
  });
  test("one quote cannot score twice; expansion and new opening do not double count", () => {
    const x = base();
    x.signals.recruitment = sig(LISTING, "now hiring for our new venue", { eventDate: "2026-10-30" });
    x.signals.managementHiring = sig(LISTING, "now hiring for our new venue", { eventDate: "2026-10-30" });
    x.signals.expansion = sig(KERRY, "second venue", { eventDate: "2026-10-30" });
    x.signals.newOpening = sig(KERRY, "opening soon", { eventDate: "2026-10-30" });
    const s = scoreLead(x, now);
    assert.equal(s.intentBreakdown.managementHiring, 0);
    assert.equal(s.intentBreakdown.newOpening, 0);
    assert.equal(s.intent, 50);
    assert.equal(s.intentStatus, "Warm");
  });
  test("scores never exceed their ranges", () => {
    const x = base();
    for (const k of ["recruitment", "expansion", "investment", "newOpening", "managementHiring", "multiLocations", "facebookActive", "instagramActive"] as const)
      x.signals[k] = sig(LISTING, `quote ${k}`, { eventDate: "2026-10-30" });
    x.contacts = { generalEmail: { value: "a@b.ie", sourceUrl: LISTING, quote: "a@b.ie" }, phone: { value: "+353 1 234 5678", sourceUrl: LISTING, quote: "+353 1 234 5678" },
      facebook: { value: "https://facebook.com/x", sourceUrl: LISTING, quote: "x" }, instagram: { value: "https://instagram.com/x", sourceUrl: LISTING, quote: "x" },
      linkedin: { value: "https://linkedin.com/company/x", sourceUrl: LISTING, quote: "x" }, contactForm: { value: "https://x.ie/contact", sourceUrl: LISTING, quote: "x" } };
    const s = scoreLead(x, now);
    assert.ok(s.fit! <= 100 && s.intent <= 100 && s.reachability <= 100 && s.complexity! <= 10 && s.priority <= 100);
    assert.equal(s.classification, "A+");
  });
});

describe("classification thresholds", () => {
  const withSignals = (keys: (keyof Extraction["signals"])[]): Extraction => ({
    identityConfirmed: true, description: "", contacts: {}, locationsEstimate: null, staffEstimate: null, notes: [],
    signals: Object.fromEntries(keys.map(k => [k, sig(LISTING, String(k))])),
  });
  test("B at fit >=50, C below 50", () => {
    assert.equal(scoreLead(withSignals(["hospitality", "shiftStaff", "beverage", "departments"]), now).fit, 42);
    assert.equal(scoreLead(withSignals(["hospitality", "shiftStaff", "beverage", "departments"]), now).classification, "C");
    const b = scoreLead(withSignals(["hospitality", "shiftStaff", "events", "beverage", "departments"]), now);
    assert.equal(b.fit, 53); assert.equal(b.classification, "B");
  });
  test("no hospitality evidence -> UNQUALIFIED, not C", () => {
    const s = scoreLead(withSignals(["food"]), now);
    assert.equal(s.fit, null); assert.equal(s.classification, "UNQUALIFIED"); assert.equal(s.complexity, null);
  });
});

describe("drafts and helpers", () => {
  test("very long business names drop the optional sentence instead of exceeding 120 words", () => {
    const long = { ...christySeed, name: Array.from({ length: 30 }, (_, i) => `Word${i}`).join(" ") };
    const facts = validateEvidence(christyExtraction(), christyDocs, christySeed);
    const d = generateDrafts(long, facts);
    assert.ok(d.emailBody.trim().split(/\s+/).length <= 120);
  });
  test("tokens, URLs, countries and dedupe keys", () => {
    assert.deepEqual(nameTokens("Christy's Bar The Well"), ["christy", "well"]);
    assert.deepEqual(nameTokens("Café Nóra"), ["cafe", "nora"].filter(t => t !== "cafe"));
    assert.ok(locationTokens(christySeed).includes("listowel"));
    assert.equal(canonicalUrl("https://x.ie/a/?utm_source=z#top"), "https://x.ie/a");
    assert.equal(canonicalUrl("https://user:pw@x.ie"), null);
    assert.equal(canonicalUrl("javascript:alert(1)"), null);
    assert.equal(isFirstPartyRotahr("https://app.rotahr.com/x"), true);
    assert.equal(isFirstPartyRotahr("https://notrotahr.com"), false);
    assert.equal(normaliseCountry("Northern Ireland"), "uk");
    assert.equal(normaliseCountry("France"), null);
    assert.notEqual(dedupeKey({ ...christySeed, address: "Main St, Tralee" }), dedupeKey(christySeed));
  });
});
