// Offline unit tests for Lead Engine v2: trigger signals, multi-signal lead score, grades,
// job-advert verification, FHRS parsing and FSAI PDF parsing. No network; PDFs are synthetic.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  FHRS_REASON, FORBIDDEN_DRAFT_TERMS, classifyRole, computeLeadScore, fhrsPoints, gradeFor, nameKey, parsePostedDate, type StoredSignal,
} from "../../lib/lead-intelligence/signals";
import { assertNoForbiddenTerms, generateDrafts } from "../../lib/lead-intelligence/scoring";
import { jobQueries, verifyAdverts } from "../../lib/lead-intelligence/providers";
import { fhrsQueryUrl, fhrsSeed, parseEstablishments } from "../../lib/lead-intelligence/fhrs";
import { findOrderPdfLinks, fsaiFingerprint, isHospitalityType, parseFsaiDate, parseFsaiPage, parseFsaiPdf } from "../../lib/lead-intelligence/fsai";
import { fhrsSignal, fsaiSeed, fsaiSignal, ieCounty } from "../../lib/lead-intelligence/source-signals";
import { FHRS_UNITS, IE_TOWNS, UK_TOWNS, countyForIeTown } from "../../lib/lead-intelligence/towns";
import type { Extraction, LeadSeed, SourceDocument } from "../../lib/lead-intelligence/types";
import { buildPdf, fsaiPage } from "./pdf-fixture";

const now = new Date("2026-11-05T06:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const sig = (type: string, label: string, points: number, date: Date | null, observed = now): StoredSignal =>
  ({ type, label, points, eventDate: date, observedAt: observed, sourceUrl: "https://example.org/s", detail: "" });

describe("lead score and grades", () => {
  test("the user's example: Head Chef advert + FHRS 2 = 110, A+", () => {
    const s = computeLeadScore([sig("hiring_chef", "Hiring Head Chef", 40, daysAgo(3)), sig("fhrs_rating", "Food Hygiene Rating 2", 70, daysAgo(200))], now);
    assert.deepEqual({ lead_score: s.lead_score, signals: s.signals }, { lead_score: 110, signals: ["Food Hygiene Rating 2", "Hiring Head Chef"] });
    assert.equal(s.grade, "A+");
  });
  test("only the strongest active signal per group counts; groups add up", () => {
    const s = computeLeadScore([
      sig("hiring_chef", "Hiring Head Chef", 40, daysAgo(5)), sig("hiring_chef", "Hiring Sous Chef", 40, daysAgo(10)),
      sig("hiring_management", "Hiring General Manager", 35, daysAgo(1)), sig("hiring_compliance", "Hiring HACCP", 50, daysAgo(2)),
      sig("multi_site", "Multi-site operator", 20, null),
    ], now);
    assert.equal(s.lead_score, 40 + 35 + 50 + 20);
    assert.equal(s.signals.filter(l => l.includes("Chef")).length, 1);
  });
  test("FSAI orders: strongest wins (closure 100 > prohibition 90 > improvement 75); expire after 180 days", () => {
    assert.equal(computeLeadScore([sig("fsai_prohibition", "P", 90, daysAgo(30)), sig("fsai_closure", "C", 100, daysAgo(40))], now).lead_score, 100);
    assert.equal(computeLeadScore([sig("fsai_improvement", "I", 75, daysAgo(10))], now).lead_score, 75);
    assert.equal(computeLeadScore([sig("fsai_closure", "C", 100, daysAgo(181))], now).lead_score, 0);
  });
  test("job adverts stop counting after 60 days; undated adverts use when they were observed", () => {
    assert.equal(computeLeadScore([sig("hiring_chef", "Hiring Head Chef", 40, daysAgo(61))], now).lead_score, 0);
    assert.equal(computeLeadScore([sig("hiring_chef", "Hiring Head Chef", 40, null, daysAgo(10))], now).lead_score, 40);
  });
  test("hygiene: the latest inspection wins even when an older one scored more", () => {
    const s = computeLeadScore([sig("fhrs_rating", "Food Hygiene Rating 1", 70, daysAgo(400)), sig("fhrs_rating", "Food Hygiene Rating 4", 10, daysAgo(20))], now);
    assert.equal(s.lead_score, 10); assert.deepEqual(s.signals, ["Food Hygiene Rating 4"]);
  });
  test("unknown signal types are ignored", () => {
    assert.equal(computeLeadScore([sig("social_post", "x", 99, daysAgo(1))], now).lead_score, 0);
  });
  test("FHRS points by rating", () => {
    assert.deepEqual(["0", "1", "2", "3", "4", "5", "Exempt", "AwaitingInspection"].map(fhrsPoints), [70, 70, 70, 40, 10, 0, 0, 0]);
  });
  test("grade bands: A+ >=90, A 70-89, B 40-69, C 20-39, D <20", () => {
    assert.deepEqual([90, 89, 70, 69, 40, 39, 20, 19, 0].map(gradeFor), ["A+", "A", "A", "B", "B", "C", "C", "D", "D"]);
  });
});

describe("roles and dates", () => {
  test("classifyRole maps advert titles to the three groups", () => {
    assert.deepEqual(classifyRole("Executive Chef - 5* hotel"), { group: "hiring_chef", role: "Executive Chef" });
    assert.deepEqual(classifyRole("Sous chef (full time)"), { group: "hiring_chef", role: "Sous Chef" });
    assert.deepEqual(classifyRole("Chef de Cuisine"), { group: "hiring_chef", role: "Head Chef" });
    assert.deepEqual(classifyRole("Duty Manager"), { group: "hiring_management", role: "Duty Manager" });
    assert.deepEqual(classifyRole("Food Safety & Quality Manager"), { group: "hiring_compliance", role: "Food Safety" });
    assert.deepEqual(classifyRole("HACCP Coordinator"), { group: "hiring_compliance", role: "HACCP" });
    assert.equal(classifyRole("Commis Chef"), null);
    assert.equal(classifyRole("Bar staff"), null);
  });
  test("parsePostedDate handles Serper's relative and absolute dates", () => {
    assert.equal(parsePostedDate("3 days ago", now)?.toISOString(), daysAgo(3).toISOString());
    assert.equal(parsePostedDate("2 weeks ago", now)?.toISOString(), daysAgo(14).toISOString());
    assert.equal(parsePostedDate("Oct 28, 2026", now)?.toISOString().slice(0, 10), "2026-10-28");
    assert.equal(parsePostedDate("2026-10-01", now)?.toISOString().slice(0, 10), "2026-10-01");
    assert.equal(parsePostedDate("yesterday", now)?.toISOString(), daysAgo(1).toISOString());
    assert.equal(parsePostedDate("next week", now), null);
    assert.equal(parsePostedDate("2027-01-01", now), null, "future dates are rejected");
    assert.equal(parsePostedDate(undefined, now), null);
  });
  test("nameKey strips punctuation, 'the' and 'ltd' for cross-source matching", () => {
    assert.equal(nameKey("The Anchor Inn Ltd."), nameKey("Anchor Inn"));
    assert.equal(nameKey("Café & Bar"), "cafeandbar");
  });
});

describe("job-board discovery", () => {
  test("four job searches per day, rotating towns, within the unchanged budget", () => {
    for (const day of [0, 1, 2, 3, 77]) {
      const qs = jobQueries(day);
      assert.equal(qs.length, 4);
      assert.ok(qs.some(q => q.country === "ie") && qs.some(q => q.country === "uk"));
      assert.match(qs[0].query, /"Head Chef" OR "Executive Chef" OR "Sous Chef" OR "Kitchen Manager"/);
      assert.ok(qs[0].query.includes(IE_TOWNS[day % IE_TOWNS.length].name));
    }
    assert.ok(jobQueries(1).some(q => q.group === "hiring_compliance" && q.town === null));
    assert.notEqual(jobQueries(0)[0].town, jobQueries(1)[0].town);
  });
  const q = { query: "x", country: "ie" as const, town: "Galway", group: "hiring_chef" as const };
  const doc = (url: string, text: string, date?: string): { doc: SourceDocument; q: typeof q } => ({ doc: { url, text, kind: "search", fetchedAt: now.toISOString(), date }, q });
  const docs = [
    doc("https://www.irishjobs.ie/job/1", "Head Chef - The Anchor Bistro\nThe Anchor Bistro, Galway is hiring a Head Chef to lead our kitchen.", "3 days ago"),
    doc("https://ie.indeed.com/q-sous-chef", "Sous Chef jobs in Galway\n25 Sous Chef jobs in Galway from Hays Recruitment and others."),
    doc("https://www.irishjobs.ie/job/2", "Bar Staff - Quay Bar\nQuay Bar Galway needs bar staff."),
  ];
  test("verifyAdverts accepts only quoted, named hospitality employers with an in-scope role", () => {
    const raw = { adverts: [
      { venueName: "The Anchor Bistro", town: "", role: "Head Chef", sourceUrl: "https://www.irishjobs.ie/job/1", quote: "The Anchor Bistro, Galway is hiring a Head Chef" },
      { venueName: "Hays Recruitment", town: "Galway", role: "Sous Chef", sourceUrl: "https://ie.indeed.com/q-sous-chef", quote: "from Hays Recruitment" },
      { venueName: "Invented Hotel", town: "Galway", role: "Head Chef", sourceUrl: "https://www.irishjobs.ie/job/1", quote: "Invented Hotel is hiring" },
      { venueName: "Quay Bar", town: "Galway", role: "Bar Staff", sourceUrl: "https://www.irishjobs.ie/job/2", quote: "Quay Bar Galway needs bar staff" },
      { venueName: "The Anchor Bistro", town: "", role: "Head Chef", sourceUrl: "https://elsewhere.example/job", quote: "The Anchor Bistro, Galway is hiring a Head Chef" },
    ] };
    const out = verifyAdverts(raw, docs, now);
    assert.equal(out.length, 1);
    const a = out[0];
    assert.equal(a.seed.name, "The Anchor Bistro"); assert.equal(a.role, "Head Chef"); assert.equal(a.group, "hiring_chef");
    assert.equal(a.seed.city, "Galway"); assert.equal(a.seed.county, "Co. Galway"); assert.equal(a.seed.sourceKind, "job_advert");
    assert.equal(a.advertUrl, "https://www.irishjobs.ie/job/1"); assert.equal(a.datePosted?.toISOString(), daysAgo(3).toISOString());
  });
  test("verifyAdverts rejects malformed model output", () => {
    assert.throws(() => verifyAdverts({ adverts: "nope" }, docs, now));
  });
});

describe("towns", () => {
  test("IE list includes the user's towns and every county town", () => {
    for (const t of ["Dublin", "Cork", "Galway", "Limerick", "Killarney", "Tralee", "Listowel", "Ennis", "Athlone", "Sligo", "Letterkenny", "Naas", "Lifford", "Carrick-on-Shannon"])
      assert.ok(IE_TOWNS.some(x => x.name === t), t);
    assert.equal(countyForIeTown("tralee"), "Kerry");
  });
  test("FHRS units cover only FHRS-scheme nations (no Scotland)", () => {
    assert.ok(FHRS_UNITS.length >= 40);
    const scottish = UK_TOWNS.filter(t => t.nation === "scotland").map(t => t.name);
    assert.ok(scottish.length >= 3 && FHRS_UNITS.every(u => !scottish.includes(u.town)));
    assert.equal(new Set(FHRS_UNITS.map(u => u.authorityId)).size, FHRS_UNITS.length);
  });
});

describe("FHRS", () => {
  const est = (over: Record<string, unknown>) => ({ FHRSID: 1, BusinessName: "Oak Room", BusinessType: "Restaurant/Cafe/Canteen", BusinessTypeID: 1,
    AddressLine1: "22 Main Street", AddressLine2: "Brighton", AddressLine3: null, AddressLine4: "", PostCode: "BN1 1AA", RatingValue: "2",
    RatingDate: "2026-06-01T00:00:00", LocalAuthorityName: "Brighton and Hove", Phone: "", SchemeType: "FHRS", ...over });
  test("parseEstablishments keeps numeric FHRS ratings and skips FHIS/Exempt", () => {
    const { records, totalPages } = parseEstablishments({ establishments: [est({}), est({ FHRSID: 2, RatingValue: "Exempt" }),
      est({ FHRSID: 3, SchemeType: "FHIS", RatingValue: "Pass" }), est({ FHRSID: 4, RatingValue: 0 }), { junk: true }], meta: { totalPages: 2, pageNumber: 1 } });
    assert.equal(totalPages, 2);
    assert.deepEqual(records.map(r => [r.fhrsId, r.rating]), [[1, "2"], [4, "0"]]);
    assert.equal(records[0].address, "22 Main Street, Brighton, BN1 1AA");
    assert.equal(records[0].ratingDate?.toISOString().slice(0, 10), "2026-06-01");
    assert.equal(records[0].phone, null);
  });
  test("query URL asks for ratings <= 3 for one authority and business type", () => {
    const u = new URL(fhrsQueryUrl(286, 7843, 2));
    assert.equal(u.hostname, "api.ratings.food.gov.uk");
    assert.deepEqual(Object.fromEntries(u.searchParams), { localAuthorityId: "286", businessTypeId: "7843", ratingKey: "3", ratingOperatorKey: "LessThanOrEqual", pageSize: "250", pageNumber: "2", sortOptionKey: "rating" });
  });
  test("seed and signal: the seed never carries the rating; the signal carries points and the reason", () => {
    const r = parseEstablishments({ establishments: [est({})], meta: { totalPages: 1, pageNumber: 1 } }).records[0];
    const seed = fhrsSeed(r, "Brighton");
    assert.equal(seed.sourceUrl, "https://ratings.food.gov.uk/business/1");
    assert.doesNotMatch(seed.documents!.map(d => d.text).join(" "), /rating|hygiene|\b2\b/i);
    const s = fhrsSignal(r);
    assert.deepEqual([s.type, s.label, s.points, s.fingerprint], ["fhrs_rating", "Food Hygiene Rating 2", 70, "fhrs:1"]);
    assert.equal((s.data as { reason: string }).reason, FHRS_REASON);
  });
});

describe("FSAI enforcement orders", () => {
  test("finds the three order PDFs on the index page", () => {
    const html = `<a href="/getmedia/abc/Closure-Orders-Served_30.pdf">Closure</a><a href="/getmedia/def/Enforcement-Orders-Prohibition.pdf">P</a>
      <a href="https://www.fsai.ie/getmedia/ghi/Enforcement-Orders-Improvement.pdf">I</a><a href="https://evil.example/Closure.pdf">x</a><a href="/getmedia/x/Prosecutions.pdf">p</a>`;
    assert.deepEqual(findOrderPdfLinks(html), {
      closure: "https://www.fsai.ie/getmedia/abc/Closure-Orders-Served_30.pdf",
      prohibition: "https://www.fsai.ie/getmedia/def/Enforcement-Orders-Prohibition.pdf",
      improvement: "https://www.fsai.ie/getmedia/ghi/Enforcement-Orders-Improvement.pdf" });
  });
  test("dates are DD/MM/YYYY and validated", () => {
    assert.equal(parseFsaiDate("29/10/2026")?.toISOString().slice(0, 10), "2026-10-29");
    assert.equal(parseFsaiDate("31/02/2026"), null);
  });
  test("hospitality business types only", () => {
    assert.ok(isHospitalityType("Restaurant/Café") && isHospitalityType("Hotel") && isHospitalityType("Pub"));
    assert.ok(!isHospitalityType("Retailer - Other") && !isHospitalityType("Manufacturer") && !isHospitalityType("Distributor"));
  });
  const orders = [
    { served: daysAgo(10), premises: ["Harbour", "Kitchen"], address: ["1 Quay Street", "Galway"], county: "Galway", servedOn: ["Harbour", "Kitchen", "Limited"],
      businessType: ["Restaurant/", "Café"], orderUrl: "https://www.fsai.ie/fsai/media/fsai/enforcement%20reports/orders/CO-001-10-2026_R.pdf" },
    { served: daysAgo(20), lifted: daysAgo(15), premises: ["Corner Shop"], address: ["5 Main Street"], county: "Dublin 8", servedOn: ["A Person"], businessType: ["Retailer -", "Other"] },
  ];
  test("parses a synthetic PDF in the live layout, never keeps Served On, and carries the header to continuation pages", async () => {
    const pdf = buildPdf([fsaiPage(orders), fsaiPage([{ ...orders[0], served: daysAgo(30), premises: ["Oak Room Hotel"], orderUrl: undefined }], false)]);
    const { rows, skippedPages } = await parseFsaiPdf(pdf, "closure");
    assert.equal(skippedPages, 0);
    assert.equal(rows.length, 3);
    assert.deepEqual({ ...rows[0], dateServed: rows[0].dateServed.toISOString().slice(0, 10) }, { orderType: "closure", premises: "Harbour Kitchen", address: "1 Quay Street Galway",
      county: "Galway", businessType: "Restaurant/Café", dateServed: daysAgo(10).toISOString().slice(0, 10), dateLifted: null, orderUrl: orders[0].orderUrl });
    assert.equal(rows[1].dateLifted?.toISOString().slice(0, 10), daysAgo(15).toISOString().slice(0, 10));
    assert.equal(rows[2].premises, "Oak Room Hotel"); assert.equal(rows[2].orderUrl, null);
    assert.doesNotMatch(JSON.stringify(rows), /A Person|Limited/, "Served On is never part of a parsed row");
  });
  test("a dated page with no recognisable header is reported as skipped, not guessed", () => {
    const page = { texts: [{ s: "29/10/2026", x: 32, y: 400 }, { s: "Somewhere", x: 169, y: 400 }] };
    assert.equal(parseFsaiPage(page.texts.map(t => ({ s: t.s, x: t.x, y: t.y })), "closure").rows, null);
  });
  test("fingerprint is stable across 'Ltd' variants; seed carries identity only; signal is +100", () => {
    const a = fsaiFingerprint({ orderType: "prohibition", premises: "Live Health Ltd", address: "Unit 1", dateServed: daysAgo(3) });
    assert.equal(a, fsaiFingerprint({ orderType: "prohibition", premises: "Live Health", address: "Unit 1", dateServed: daysAgo(3) }));
    const o = { premises: "Harbour Kitchen", address: "1 Quay Street, Galway", county: "Galway", businessType: "Restaurant/Café",
      orderUrl: "https://www.fsai.ie/x.pdf", sourceUrl: "https://www.fsai.ie/getmedia/a/Closure.pdf", orderType: "closure", dateServed: daysAgo(10), dateLifted: null, fingerprint: "f" };
    const seed = fsaiSeed(o);
    assert.deepEqual([seed.country, seed.city, seed.county, seed.sourceKind], ["ie", "Galway", "Co. Galway", "fsai"]);
    assert.doesNotMatch(JSON.stringify(seed.documents), /closure|order|enforcement/i);
    const s = fsaiSignal(o);
    assert.deepEqual([s.type, s.points], ["fsai_closure", 100]);
    assert.equal(ieCounty("Dublin 8"), "Dublin"); assert.equal(ieCounty("County Cork"), "Cork"); assert.equal(ieCounty("Co. Kerry"), "Kerry");
  });
  const real = "/tmp/fsai/Closure-Orders-Served_30_3513000575918615039.pdf";
  test("real FSAI closure PDF (only when a local copy exists)", { skip: !existsSync(real) && "no local FSAI PDF" }, async () => {
    const { rows, skippedPages } = await parseFsaiPdf(new Uint8Array(readFileSync(real)), "closure");
    assert.equal(skippedPages, 0); assert.ok(rows.length >= 50);
    assert.ok(rows.every(r => r.premises && r.county && r.dateServed));
  });
});

describe("drafts never cite hygiene or enforcement", () => {
  const seed: LeadSeed = { name: "The Anchor Bistro", website: null, category: "restaurant", country: "ie", county: "Co. Galway", city: "Galway", address: "", sourceUrl: "https://example.org/a", sourceKind: "job_advert" };
  const facts = { identityConfirmed: true, description: "", notes: [], locationsEstimate: null, staffEstimate: null, contacts: {},
    signals: { food: { value: true, confidence: "observed", sourceUrl: "https://example.org/a", quote: "food", eventDate: null } } } as unknown as Extraction;
  test("hiring may be mentioned, within 120 words", () => {
    const d = generateDrafts(seed, facts, { role: "Head Chef" });
    assert.match(d.emailBody, /noticed you're hiring a Head Chef/);
    assert.ok(d.emailBody.split(/\s+/).length <= 120);
    for (const v of Object.values(d)) assert.doesNotMatch(v, FORBIDDEN_DRAFT_TERMS);
    assert.match(generateDrafts(seed, facts, { role: "HACCP" }).emailBody, /hiring for a food safety role/);
  });
  test("forbidden wording is rejected, but a venue name containing such a word is not", () => {
    assert.throws(() => assertNoForbiddenTerms({ emailBody: "We saw your food hygiene rating" }, "X"), /hygiene\/enforcement/);
    assert.throws(() => assertNoForbiddenTerms({ emailBody: "After the FSAI closure order" }, "X"));
    assert.doesNotThrow(() => assertNoForbiddenTerms({ emailBody: "Hi Inspection Bar team" }, "Inspection Bar"));
    const d = generateDrafts({ ...seed, name: "The Inspection Rooms" }, facts);
    assert.match(d.emailBody, /Inspection Rooms/);
  });
});
