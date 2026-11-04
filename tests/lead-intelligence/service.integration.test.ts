// DB integration tests for the Lead Intelligence service and cron route.
// Runs ONLY against a local throwaway Postgres (LI_TEST_DATABASE_URL on localhost, db name ending in _test).
// Providers are never contacted: globalThis.fetch is replaced by an offline fake, the API "keys" are
// placeholder strings, and fixture leads have no website so the crawler never opens a socket.
//
//   LI_TEST_DATABASE_URL=postgresql://user:pw@localhost:5432/rotahr_li_test \
//     npx tsx --test tests/lead-intelligence/service.integration.test.ts
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { buildPdf, fsaiPage } from "./pdf-fixture";
import { nameKey } from "../../lib/lead-intelligence/signals";

const url = process.env.LI_TEST_DATABASE_URL ?? "";
const parsed = (() => { try { return new URL(url); } catch { return null; } })();
const safeDb = !!parsed && ["localhost", "127.0.0.1"].includes(parsed.hostname) && /_test$/.test(parsed.pathname.slice(1));
const skip = safeDb ? false : "LI_TEST_DATABASE_URL must point at a local *_test database";

// ---- Offline provider fake ------------------------------------------------------------------
type Call = { host: string; path: string; body: any };
const calls: Call[] = [];
const blocked: string[] = [];
let onExtraction: ((business: any) => Promise<void>) | null = null;
// Free-source fakes (FHRS API, FSAI site). Tests replace these per case.
let fhrsData: Record<string, any[]> = {};
let fsaiPdfs: Record<string, Uint8Array> = {};
const fhrsEst = (id: number, name: string, rating: string, date: string, typeId = 1) => ({ FHRSID: id, BusinessName: name, BusinessType: "Restaurant/Cafe/Canteen",
  BusinessTypeID: typeId, AddressLine1: `${id} High Street`, AddressLine2: "London", AddressLine3: null, AddressLine4: null, PostCode: "W1 1AA",
  RatingValue: rating, RatingDate: `${date}T00:00:00`, LocalAuthorityName: "Westminster", Phone: null, SchemeType: "FHRS" });
const realFetch = globalThis.fetch;
const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { "content-type": "application/json" } });

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const raw = init?.body ?? (input instanceof Request ? await input.text() : "");
  const body = typeof raw === "string" && raw ? JSON.parse(raw) : {};
  if (u.hostname === "google.serper.dev") {
    calls.push({ host: u.hostname, path: u.pathname, body });
    const q: string = body.q;
    if (u.pathname === "/maps") {
      const m = q.match(/ in (.+) (Ireland|United Kingdom)$/)!;
      const [city, country] = [m[1], m[2]];
      const tail = country === "Ireland" ? "Ireland" : "United Kingdom";
      return json({ places: [
        { title: `Harbour Kitchen ${city}`, address: `1 Quay Street, ${city}, ${tail}`, category: "Restaurant", cid: `${city}-1` },
        { title: `Oak Room ${city}`, address: `22 Main Street, ${city}, ${tail}`, category: "Hotel", cid: `${city}-2` },
        { title: `Elsewhere Bar`, address: `5 Rue de Paris, Paris, France`, category: "Bar", cid: `${city}-3` },
      ] });
    }
    if (body.tbs === "qdr:m") {
      // Job-board searches (Google results only). One named venue advert in the Irish chef search, plus an agency aggregate.
      const town = q.match(/job (.+) Ireland$/)?.[1];
      if (!town || !q.includes('"Head Chef"')) return json({ organic: [] });
      return json({ organic: [
        { title: "Head Chef - The Anchor Bistro", link: "https://www.irishjobs.ie/job/anchor-1", snippet: `The Anchor Bistro, ${town} is hiring a Head Chef to lead our kitchen.`, date: "3 days ago" },
        { title: `Sous Chef jobs in ${town}`, link: "https://ie.indeed.com/q-sous-chef", snippet: `25 Sous Chef jobs in ${town} from Hays Recruitment and others.` },
      ] });
    }
    const [, name, city] = q.match(/^"([^"]+)" (\S+)/) ?? [];
    if (name) {
      return json({ organic: [{ title: `${name} | Contact`, link: `https://example.org/${encodeURIComponent(name)}`,
        snippet: `${name}, ${city}. ${name} restaurant serving food daily with a busy bar and weekend events. Call ${name} on 066 712 3456.` }] });
    }
    return json({ organic: [{ title: "Hospitality listings", link: "https://example.org/listings", snippet: "Restaurants and cafes." }] });
  }
  if (u.hostname === "api.openai.com") {
    calls.push({ host: u.hostname, path: u.pathname, body });
    const system: string = body.messages[0].content;
    const user = JSON.parse(body.messages[1].content);
    let content: unknown;
    if (system.startsWith("Extract hospitality job adverts")) {
      content = { adverts: user.documents.flatMap((d: any) => {
        const m = d.text.match(/(The Anchor Bistro, \S+ is hiring a Head Chef)/);
        return [
          ...(m ? [{ venueName: "The Anchor Bistro", town: "", role: "Head Chef", sourceUrl: d.url, quote: m[1] }] : []),
          ...(/Hays Recruitment/.test(d.text) ? [{ venueName: "Hays Recruitment", town: "", role: "Sous Chef", sourceUrl: d.url, quote: "from Hays Recruitment" }] : []),
        ];
      }) };
    }
    else {
      const business = user.business; await onExtraction?.(business);
      const doc = user.documents.find((d: any) => d.url.startsWith("https://example.org/") && d.text.includes(business.name));
      const quote = `${business.name} restaurant serving food daily`;
      content = { identityConfirmed: true, description: "Restaurant.", notes: [], locationsEstimate: null, staffEstimate: null,
        signals: doc ? {
          hospitality: { value: true, confidence: "observed", sourceUrl: doc.url, quote, eventDate: null },
          food: { value: true, confidence: "observed", sourceUrl: doc.url, quote, eventDate: null },
        } : {},
        contacts: doc ? { phone: { value: "066 712 3456", sourceUrl: doc.url, quote: `Call ${business.name} on 066 712 3456` } } : {} };
    }
    return json({ id: "fake", object: "chat.completion", created: 0, model: "gpt-4o-mini",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: JSON.stringify(content) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } });
  }
  if (u.hostname === "api.ratings.food.gov.uk") {
    calls.push({ host: u.hostname, path: u.pathname, body: {} });
    assert.equal(u.searchParams.get("ratingKey"), "3"); assert.equal(u.searchParams.get("ratingOperatorKey"), "LessThanOrEqual");
    const list = fhrsData[`${u.searchParams.get("localAuthorityId")}:${u.searchParams.get("businessTypeId")}`] ?? [];
    return json({ establishments: list, meta: { totalPages: 1, pageNumber: 1 } });
  }
  if (u.hostname === "www.fsai.ie") {
    calls.push({ host: u.hostname, path: u.pathname, body: {} });
    if (u.pathname === "/enforcement-and-legislation/enforcement") return new Response(`<html><a href="/getmedia/a1/Closure-Orders-Served_30.pdf">Closure</a>
      <a href="/getmedia/b2/Enforcement-Orders-Prohibition.pdf">Prohibition</a><a href="/getmedia/c3/Enforcement-Orders-Improvement.pdf">Improvement</a></html>`, { status: 200, headers: { "content-type": "text/html" } });
    const type = /closure/i.test(u.pathname) ? "closure" : /prohibition/i.test(u.pathname) ? "prohibition" : "improvement";
    return new Response(Buffer.from(fsaiPdfs[type] ?? buildPdf([fsaiPage([])])), { status: 200, headers: { "content-type": "application/pdf" } });
  }
  if (u.hostname === "dns.google") {
    calls.push({ host: u.hostname, path: u.pathname, body: {} });
    const name = u.searchParams.get("name");
    return json(name === "nomail.ie" ? { Status: 3 } : { Status: 0, Answer: [{ type: 15, data: "10 mx.example.org." }] });
  }
  if (u.hostname === "api.brevo.com") {
    calls.push({ host: u.hostname, path: u.pathname, body });
    if (body.to?.[0]?.email === "reject@venue.ie") return new Response(JSON.stringify({ message: "email is not valid" }), { status: 400 });
    return json({ messageId: `<fake-${calls.length}@brevo>` });
  }
  blocked.push(u.href);
  throw new Error(`Offline test: network access to ${u.hostname} blocked`);
}
const count = (host: string) => calls.filter(c => c.host === host).length;

// ---- Setup ----------------------------------------------------------------------------------
let prisma: typeof import("../../lib/db").prisma;
let service: typeof import("../../lib/lead-intelligence/service");
let providers: typeof import("../../lib/lead-intelligence/providers");
let sources: typeof import("../../lib/lead-intelligence/sources");
let seedCounts: number[] = [];
const env = { LEAD_INTELLIGENCE_ENABLED: "true", SERPER_API_KEY: "offline-placeholder", OPENAI_API_KEY: "offline-placeholder", CRON_SECRET: "offline-cron-secret" };
const tableCounts = () => Promise.all([prisma.outreachLead.count(), prisma.callLead.count(), prisma.venueCandidate.count()]);
async function reset() {
  await prisma.leadIntelligenceAnalysis.deleteMany(); await prisma.leadIntelligenceRun.deleteMany();
  await prisma.leadIntelligenceSignal.deleteMany(); await prisma.leadIntelligenceFhrs.deleteMany(); await prisma.leadIntelligenceFsaiOrder.deleteMany();
  await prisma.leadIntelligenceSourceSync.deleteMany(); await prisma.leadIntelligenceLead.deleteMany();
  calls.length = 0; blocked.length = 0; onExtraction = null; fhrsData = {}; fsaiPdfs = {};
  for (const k of ["LEAD_INTELLIGENCE_DAILY_QUERY_CAP", "LEAD_INTELLIGENCE_DAILY_MODEL_CAP"]) delete process.env[k];
  Object.assign(process.env, env);
}
const seed = (over: Partial<import("../../lib/lead-intelligence/types").LeadSeed> = {}) => ({
  name: "Christy's Bar", website: null, category: "Pub", country: "ie", county: "Co. Kerry", city: "Listowel",
  address: "1 Church Street, Listowel", sourceUrl: "https://example.org/christys", sourceKind: "maps", ...over });

describe("Lead Intelligence service (local DB)", { skip, concurrency: false }, () => {
  before(async () => {
    process.env.DATABASE_URL = url;
    Object.assign(process.env, env);
    globalThis.fetch = fakeFetch as typeof fetch;
    ({ prisma } = await import("../../lib/db"));
    service = await import("../../lib/lead-intelligence/service");
    providers = await import("../../lib/lead-intelligence/providers");
    sources = await import("../../lib/lead-intelligence/sources");
    seedCounts = await tableCounts();
  });
  beforeEach(reset);
  after(async () => {
    if (!prisma) return;
    try { assert.deepEqual(await tableCounts(), seedCounts, "OutreachLead/CallLead/VenueCandidate must never be written"); }
    finally { await reset(); await prisma.$disconnect(); globalThis.fetch = realFetch; }
  });

  describe("saveSeed dedupe", () => {
    test("same dedupe key is not duplicated and enrichment only fills a missing website", async () => {
      const a = await service.saveSeed(seed());
      const b = await service.saveSeed(seed({ website: "https://christys.ie" }));
      assert.equal(a.created, true); assert.equal(b.created, false); assert.equal(b.id, a.id);
      assert.equal((await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id: a.id } })).website, "https://christys.ie");
      await service.saveSeed(seed({ website: "https://other.example" }));
      assert.equal((await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id: a.id } })).website, "https://christys.ie");
    });
    test("an address-less seed merges with the single same-name venue in that city", async () => {
      const a = await service.saveSeed(seed());
      const b = await service.saveSeed(seed({ address: "", sourceKind: "existing_outreach", sourceUrl: "internal:outreach:abc123" }));
      assert.equal(b.created, false); assert.equal(b.id, a.id);
    });
    test("an address-less seed is NOT merged when two same-name venues exist in the city", async () => {
      await service.saveSeed(seed({ name: "Harbour Kitchen", city: "Cork", address: "1 Quay Street, Cork" }));
      await service.saveSeed(seed({ name: "Harbour Kitchen", city: "Cork", address: "9 Grand Parade, Cork" }));
      const c = await service.saveSeed(seed({ name: "Harbour Kitchen", city: "Cork", address: "" }));
      assert.equal(c.created, true);
      assert.equal(await prisma.leadIntelligenceLead.count({ where: { name: "Harbour Kitchen" } }), 3);
    });
    test("a different address in the same city is a distinct venue", async () => {
      const a = await service.saveSeed(seed());
      const b = await service.saveSeed(seed({ address: "40 William Street, Listowel" }));
      assert.equal(b.created, true); assert.notEqual(b.id, a.id);
    });
    test("concurrent saves of one seed resolve to one row (P2002 path)", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, () => service.saveSeed(seed())));
      assert.equal(new Set(results.map(r => r.id)).size, 1);
      assert.equal(results.filter(r => r.created).length, 1);
      assert.equal(await prisma.leadIntelligenceLead.count(), 1);
    });
    test("non-IE/UK and non-public sources are rejected", async () => {
      await assert.rejects(service.saveSeed(seed({ country: "fr" })));
      await assert.rejects(service.saveSeed(seed({ sourceUrl: "internal:outreach:1", sourceKind: "maps" })));
    });
  });

  describe("runIntelligence", () => {
    test("daily cron run discovers, analyses, persists spend, and is idempotent for the UTC day", async () => {
      const first = await service.runIntelligence("cron");
      assert.equal(first.skipped, false);
      const run = first.run!;
      assert.equal(run.status, "completed", JSON.stringify(run.errors));
      assert.equal(run.activeLock, null);
      assert.equal(run.runKey, `daily:${new Date().toISOString().slice(0, 10)}`);
      assert.equal(run.discovered, 3, "1 job-advert venue + 2 Maps venues; the France result is rejected");
      assert.equal(run.analysed, 3); assert.equal(run.drafts, 3);
      assert.equal(run.queries, count("google.serper.dev")); assert.equal(run.modelCalls, count("api.openai.com"));
      assert.equal(calls.filter(c => c.host === "google.serper.dev" && c.body.tbs === "qdr:m").length, 4, "4 job-board searches");
      assert.equal(calls.filter(c => c.path === "/maps").length, 1, "1 Maps search");
      assert.ok(run.queries <= 10 && run.modelCalls <= 6);
      // The advert became a scored lead with a dated hiring signal; the agency was rejected.
      const anchor = await prisma.leadIntelligenceLead.findFirstOrThrow({ where: { name: "The Anchor Bistro" }, include: { triggerSignals: true, analyses: true } });
      assert.equal(await prisma.leadIntelligenceLead.count({ where: { name: { contains: "Hays" } } }), 0);
      assert.equal(anchor.leadScore, 40); assert.equal(anchor.grade, "B"); assert.equal(anchor.sourceKind, "job_advert");
      assert.deepEqual((anchor.signalSummary as any).signals, ["Hiring Head Chef"]);
      assert.equal(anchor.triggerSignals[0].type, "hiring_chef"); assert.equal(anchor.triggerSignals[0].sourceUrl, "https://www.irishjobs.ie/job/anchor-1");
      assert.ok(anchor.triggerSignals[0].eventDate && anchor.triggerSignals[0].eventDate < new Date());
      assert.match(anchor.analyses[0].emailBody!, /noticed you're hiring a Head Chef/);
      assert.deepEqual(blocked, []);
      assert.ok((run.errors as string[]).some(e => /Notice: 1 .* skipped/.test(e)));
      const leads = await prisma.leadIntelligenceLead.findMany();
      // Highest trigger score is analysed first.
      const order = (await prisma.leadIntelligenceAnalysis.findMany({ orderBy: { createdAt: "asc" }, include: { lead: true } })).map(a => a.lead.name);
      assert.equal(order[0], "The Anchor Bistro");
      for (const l of leads) {
        assert.equal(l.status, "qualified"); assert.equal(l.intentStatus, "unknown"); assert.equal(l.intentScore, 0);
        assert.equal(l.phone, "066 712 3456"); assert.equal(l.generalEmail, null, "contacts are never invented");
        assert.ok(l.nextAnalysisAt! > new Date(Date.now() + 6 * 86400000));
      }
      const analyses = await prisma.leadIntelligenceAnalysis.findMany();
      assert.equal(analyses.length, 3);
      for (const a of analyses) assert.ok(a.emailBody && a.emailBody.split(/\s+/).length <= 120);

      const before = calls.length;
      const second = await service.runIntelligence("cron");
      assert.equal(second.skipped, true); assert.match(String(second.reason), /already completed/);
      assert.equal(calls.length, before, "no provider calls on an idempotent skip");
      assert.equal(await prisma.leadIntelligenceRun.count(), 1);
    });

    test("an active worker lease blocks overlapping runs without provider calls", async () => {
      await prisma.leadIntelligenceRun.create({ data: { runKey: "manual:held", trigger: "manual", activeLock: "lead-intelligence" } });
      const manual = await service.runIntelligence("manual");
      assert.equal(manual.skipped, true); assert.match(String(manual.reason), /Another intelligence worker/);
      const cron = await service.runIntelligence("cron");
      assert.equal(cron.skipped, true);
      assert.equal(calls.length, 0);
      const held = await prisma.leadIntelligenceRun.findUniqueOrThrow({ where: { runKey: "manual:held" } });
      assert.equal(held.status, "running"); assert.equal(held.activeLock, "lead-intelligence");
    });

    test("an expired lease (>10 min) is released as failed and a new run proceeds", async () => {
      await prisma.leadIntelligenceRun.create({ data: { runKey: "manual:stale", trigger: "manual", activeLock: "lead-intelligence", startedAt: new Date(Date.now() - 11 * 60000) } });
      const r = await service.runIntelligence("manual");
      assert.equal(r.skipped, false);
      const stale = await prisma.leadIntelligenceRun.findUniqueOrThrow({ where: { runKey: "manual:stale" } });
      assert.equal(stale.status, "failed"); assert.equal(stale.activeLock, null);
      assert.match(JSON.stringify(stale.errors), /lease expired/);
    });

    test("a failed daily run is retried on the same runKey, carrying prior spend", async () => {
      const key = `daily:${new Date().toISOString().slice(0, 10)}`;
      await prisma.leadIntelligenceRun.create({ data: { runKey: key, trigger: "cron", status: "failed", queries: 4, modelCalls: 2 } });
      const r = await service.runIntelligence("cron");
      assert.equal(r.skipped, false);
      assert.equal(await prisma.leadIntelligenceRun.count(), 1);
      assert.equal(r.run!.queries, 4 + count("google.serper.dev"));
      assert.equal(r.run!.modelCalls, 2 + count("api.openai.com"));
    });

    test("daily caps include every run today; an exhausted cap makes zero paid calls", async () => {
      await prisma.leadIntelligenceRun.create({ data: { runKey: "manual:earlier", trigger: "manual", status: "completed", queries: 30, modelCalls: 18 } });
      const r = await service.runIntelligence("manual");
      assert.equal(calls.length, 0);
      assert.equal(r.run!.status, "completed", "budget stops are notices, not failures");
      assert.ok((r.run!.errors as string[]).some(e => /Daily provider cap reached/.test(e)));
    });

    test("a partially used daily cap limits this run to the remainder", async () => {
      process.env.LEAD_INTELLIGENCE_DAILY_QUERY_CAP = "10"; process.env.LEAD_INTELLIGENCE_DAILY_MODEL_CAP = "6";
      await prisma.leadIntelligenceRun.create({ data: { runKey: "manual:earlier", trigger: "manual", status: "completed", queries: 7, modelCalls: 4 } });
      const r = await service.runIntelligence("manual");
      assert.ok(count("google.serper.dev") <= 3, `queries ${count("google.serper.dev")}`);
      assert.ok(count("api.openai.com") <= 2, `model calls ${count("api.openai.com")}`);
      assert.equal(r.run!.queries, count("google.serper.dev"));
      const total = await prisma.leadIntelligenceRun.aggregate({ _sum: { queries: true, modelCalls: true } });
      assert.ok(total._sum.queries! <= 10 && total._sum.modelCalls! <= 6);
    });

    test("runs refuse to start when disabled or unconfigured", async () => {
      process.env.LEAD_INTELLIGENCE_ENABLED = "false";
      await assert.rejects(service.runIntelligence("manual"), /disabled/);
      process.env.LEAD_INTELLIGENCE_ENABLED = "true"; delete process.env.OPENAI_API_KEY;
      await assert.rejects(service.runIntelligence("manual"), /required/);
      assert.equal(await prisma.leadIntelligenceRun.count(), 0); assert.equal(calls.length, 0);
    });
  });

  describe("analyseLead", () => {
    test("a human status change during analysis wins; the result is discarded", async () => {
      const { id } = await service.saveSeed(seed());
      const run = await prisma.leadIntelligenceRun.create({ data: { runKey: "manual:t", trigger: "manual" } });
      onExtraction = async () => { await prisma.leadIntelligenceLead.update({ where: { id }, data: { status: "suppressed" } }); };
      const lead = await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } });
      const r = await service.analyseLead(lead, new providers.ProviderBudget(Date.now() + 60000), run.id);
      assert.equal(r.saved, false); assert.equal(r.drafted, false);
      const after = await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } });
      assert.equal(after.status, "suppressed"); assert.equal(after.fitScore, null); assert.equal(after.phone, null);
      assert.equal(await prisma.leadIntelligenceAnalysis.count(), 0);
    });
    test("manual re-analysis of a contacted lead keeps its status", async () => {
      const { id } = await service.saveSeed(seed());
      await prisma.leadIntelligenceLead.update({ where: { id }, data: { status: "contacted" } });
      const r = await service.runIntelligence("manual", id);
      assert.equal(r.run!.analysed, 1);
      assert.equal((await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } })).status, "contacted");
    });
    test("manual analysis of a suppressed lead is refused", async () => {
      const { id } = await service.saveSeed(seed());
      await prisma.leadIntelligenceLead.update({ where: { id }, data: { status: "suppressed" } });
      await assert.rejects(service.runIntelligence("manual", id), /not found or suppressed/);
      assert.equal(calls.length, 0);
    });
  });

  describe("Send now (fake Brevo, fake DNS)", () => {
    const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    let send: typeof import("../../lib/lead-intelligence/send");
    const mk = async (over: Record<string, unknown> = {}, name = "Christy's Bar") => {
      const { id } = await service.saveSeed(seed({ name, sourceUrl: `https://example.org/${encodeURIComponent(name)}` }));
      await prisma.leadIntelligenceLead.update({ where: { id }, data: { managerEmail: "manager@venue.ie", phone: "066 712 3456", ...over } });
      return id;
    };
    const input = (leadId: string, over: Record<string, unknown> = {}) => ({ leadId, kind: "cold" as const, to: "manager@venue.ie", subject: "Rotas at Christy's", body: "Hi Mary,\n\nQuick question about your rotas.\n\nKind regards,\nGabor", ...over });
    before(async () => { send = await import("../../lib/lead-intelligence/send"); });
    beforeEach(async () => {
      process.env.BREVO_API_KEY = "offline-placeholder";
      await prisma.emailSuppression.deleteMany({ where: { email: { endsWith: "@venue.ie" } } });
      await prisma.outreachDailyCount.deleteMany({ where: { date: today() } });
    });
    after(async () => {
      delete process.env.BREVO_API_KEY;
      await prisma.emailSuppression.deleteMany({ where: { email: { endsWith: "@venue.ie" } } });
      await prisma.outreachDailyCount.deleteMany({ where: { date: today() } });
    });

    test("sends once with demo + tutorial links, unsubscribe headers, counts toward the cap and logs to the lead", async () => {
      const id = await mk();
      const r = await send.sendLeadEmail(input(id));
      assert.equal(r.ok, true); assert.equal(r.sentToday, 1);
      const brevo = calls.filter(c => c.host === "api.brevo.com");
      assert.equal(brevo.length, 1);
      const p = brevo[0].body;
      assert.equal(p.to[0].email, "manager@venue.ie");
      assert.match(p.textContent, /rotahr\.com\/try\?utm_source=lead-intelligence/);
      assert.match(p.textContent, /rotahr\.com\/tutorials\?utm_source=lead-intelligence/);
      assert.match(p.htmlContent, /Unsubscribe<\/a>/);
      assert.match(p.headers["List-Unsubscribe"], /api\/unsubscribe\?email=manager%40venue\.ie/);
      assert.deepEqual(p.tags, ["lead-intelligence", "cold", "ie"]);
      const lead = await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } });
      assert.equal(lead.status, "contacted"); assert.ok(lead.contactedAt);
      assert.match(lead.notes ?? "", /Cold email sent to manager@venue\.ie: "Rotas at Christy's" \(Brevo <fake-/);
      assert.equal((await prisma.outreachDailyCount.findUniqueOrThrow({ where: { date: today() } })).count, 1);
    });
    test("second cold email needs force; follow-up does not", async () => {
      const id = await mk();
      await send.sendLeadEmail(input(id));
      await assert.rejects(send.sendLeadEmail(input(id)), (e: any) => e.code === "already_contacted" && e.status === 409);
      assert.equal((await send.sendLeadEmail(input(id, { force: true }))).ok, true);
      assert.equal((await send.sendLeadEmail(input(id, { kind: "followup" }))).ok, true);
      assert.equal(calls.filter(c => c.host === "api.brevo.com").length, 3);
    });
    test("refuses suppressed addresses, closed leads, bad and dead domains without calling Brevo", async () => {
      const id = await mk();
      await prisma.emailSuppression.create({ data: { email: "manager@venue.ie", source: "unsubscribe_link" } });
      await assert.rejects(send.sendLeadEmail(input(id)), (e: any) => e.code === "suppressed");
      await assert.rejects(send.sendLeadEmail(input(id, { to: "not-an-email" })), (e: any) => e.code === "bad_address");
      await assert.rejects(send.sendLeadEmail(input(id, { to: "x@venue.example" })), (e: any) => e.code === "bad_address");
      await assert.rejects(send.sendLeadEmail(input(id, { to: "x@nomail.ie" })), (e: any) => e.code === "no_mx");
      const closed = await mk({ status: "not_interested" }, "Oak Room");
      assert.notEqual(closed, id);
      await assert.rejects(send.sendLeadEmail(input(closed, { to: "other@venue.ie" })), (e: any) => e.code === "closed");
      assert.equal(calls.filter(c => c.host === "api.brevo.com").length, 0);
      assert.equal((await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } })).contactedAt, null);
    });
    test("shared daily cap blocks the send; missing key reports not configured", async () => {
      const id = await mk();
      await prisma.outreachDailyCount.create({ data: { date: today(), count: send.sendConfiguration().dailyLimit } });
      await assert.rejects(send.sendLeadEmail(input(id)), (e: any) => e.code === "daily_cap" && e.status === 429);
      delete process.env.BREVO_API_KEY;
      assert.equal(send.sendConfiguration().configured, false);
      await assert.rejects(send.sendLeadEmail(input(id)), (e: any) => e.code === "not_configured");
      assert.equal(calls.filter(c => c.host === "api.brevo.com").length, 0);
    });
    test("a Brevo hard rejection suppresses the address and leaves the lead uncontacted", async () => {
      const id = await mk();
      await assert.rejects(send.sendLeadEmail(input(id, { to: "reject@venue.ie" })), (e: any) => e.code === "send_failed");
      assert.equal(await prisma.emailSuppression.count({ where: { email: "reject@venue.ie", revokedAt: null } }), 1);
      assert.equal((await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } })).status, "new");
    });
    test("Log call marks contacted and appends the outcome", async () => {
      const id = await mk();
      const lead = await send.logLeadCall(id, "Spoke to Mary, send demo link");
      assert.equal(lead.status, "contacted");
      assert.match(lead.notes ?? "", /Phone call to 066 712 3456: Spoke to Mary, send demo link/);
    });
  });

  describe("free sources (fake FHRS API, fake FSAI site)", () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    const deadline = () => Date.now() + 120000;
    const paid = () => count("google.serper.dev") + count("api.openai.com");

    test("FHRS: stores records, promotes recent 0-3 ratings with a scored signal, and advances the cursor", async () => {
      fhrsData["120:1"] = [fhrsEst(5001, "Grill House", "1", ymd(daysAgo(40))), fhrsEst(5002, "Corner Cafe", "3", ymd(daysAgo(90))),
        fhrsEst(5003, "Old Tavern", "2", ymd(daysAgo(4 * 365)))];
      const stats = await sources.importFhrs(service.saveSeed, deadline());
      assert.deepEqual(stats.errors, []);
      assert.equal(stats.units.length, 3); assert.equal(count("api.ratings.food.gov.uk"), 12, "3 units x 4 business types");
      assert.equal(stats.stored, 3); assert.equal(stats.promoted, 2, "a rating older than 3 years is stored but not promoted");
      const grill = await prisma.leadIntelligenceLead.findFirstOrThrow({ where: { name: "Grill House" }, include: { triggerSignals: true } });
      assert.deepEqual([grill.country, grill.city, grill.sourceKind, grill.leadScore, grill.grade], ["uk", "London", "fhrs", 70, "A"]);
      assert.deepEqual((grill.signalSummary as any).signals, ["Food Hygiene Rating 1"]);
      assert.equal(grill.triggerSignals[0].sourceUrl, "https://ratings.food.gov.uk/business/5001");
      assert.doesNotMatch((grill.discoveryEvidence as any[]).map(d => d.text).join(" "), /rating|hygiene/i, "AI evidence carries identity only");
      const cafe = await prisma.leadIntelligenceLead.findFirstOrThrow({ where: { name: "Corner Cafe" } });
      assert.deepEqual([cafe.leadScore, cafe.grade], [40, "B"]);
      assert.equal(await prisma.leadIntelligenceLead.count({ where: { name: "Old Tavern" } }), 0);
      const rec = await prisma.leadIntelligenceFhrs.findUniqueOrThrow({ where: { fhrsId: 5001 } });
      assert.deepEqual([rec.localAuthority, rec.businessTypeId, rec.town, rec.leadId], ["Westminster", 1, "London", grill.id]);
      const state = await prisma.leadIntelligenceSourceSync.findUniqueOrThrow({ where: { source: "fhrs" } });
      assert.equal(state.cursor, 3); assert.equal(state.lastStatus, "completed");
      assert.equal(paid(), 0); assert.deepEqual(blocked, []);
    });

    test("FHRS: a venue that drops off its authority list is superseded and its signal retired", async () => {
      fhrsData["120:1"] = [fhrsEst(5001, "Grill House", "1", ymd(daysAgo(40))), fhrsEst(5002, "Corner Cafe", "3", ymd(daysAgo(90)))];
      await sources.importFhrs(service.saveSeed, deadline());
      await prisma.leadIntelligenceSourceSync.update({ where: { source: "fhrs" }, data: { cursor: 0 } });
      fhrsData["120:1"] = [fhrsEst(5002, "Corner Cafe", "2", ymd(daysAgo(5)))];
      const stats = await sources.importFhrs(service.saveSeed, deadline());
      assert.equal(stats.superseded, 1);
      assert.equal((await prisma.leadIntelligenceFhrs.findUniqueOrThrow({ where: { fhrsId: 5001 } })).rating, "superseded");
      const grill = await prisma.leadIntelligenceLead.findFirstOrThrow({ where: { name: "Grill House" }, include: { triggerSignals: true } });
      assert.equal(grill.triggerSignals.length, 0); assert.deepEqual([grill.leadScore, grill.grade], [0, "D"]);
      const cafe = await prisma.leadIntelligenceLead.findFirstOrThrow({ where: { name: "Corner Cafe" } });
      assert.deepEqual([cafe.leadScore, cafe.grade], [70, "A"], "a re-inspection refreshes the existing signal");
      assert.equal(await prisma.leadIntelligenceSignal.count({ where: { fingerprint: "fhrs:5002" } }), 1);
    });

    test("FSAI: stores every order, promotes hospitality only, never stores Served On, and is gated weekly", async () => {
      fsaiPdfs.closure = buildPdf([fsaiPage([
        { served: daysAgo(10), premises: ["Harbour", "Kitchen"], address: ["1 Quay Street", "Galway"], county: "Galway", servedOn: ["Harbour Kitchen", "Limited"],
          businessType: ["Restaurant/", "Café"], orderUrl: "https://www.fsai.ie/orders/CO-001.pdf" },
        { served: daysAgo(20), premises: ["Corner Shop"], address: ["5 Main Street"], county: "Dublin 8", servedOn: ["A Person"], businessType: ["Retailer -", "Other"] },
      ])]);
      const stats = await sources.importFsai(service.saveSeed, deadline());
      assert.equal(stats.skipped, false); assert.deepEqual(stats.errors, []);
      assert.equal(stats.stored, 2); assert.equal(stats.promoted, 1);
      const orders = await prisma.leadIntelligenceFsaiOrder.findMany({ orderBy: { dateServed: "desc" } });
      assert.deepEqual(orders.map(o => [o.premises, o.hospitality]), [["Harbour Kitchen", true], ["Corner Shop", false]]);
      assert.doesNotMatch(JSON.stringify(orders), /A Person|Limited/, "Served On is never stored");
      const lead = await prisma.leadIntelligenceLead.findFirstOrThrow({ where: { name: "Harbour Kitchen" }, include: { triggerSignals: true } });
      assert.deepEqual([lead.country, lead.city, lead.county, lead.sourceKind, lead.leadScore, lead.grade], ["ie", "Galway", "Co. Galway", "fsai", 100, "A+"]);
      assert.equal(lead.triggerSignals[0].type, "fsai_closure"); assert.equal(lead.triggerSignals[0].sourceUrl, "https://www.fsai.ie/orders/CO-001.pdf");
      assert.doesNotMatch(JSON.stringify(lead.discoveryEvidence) + JSON.stringify(lead.triggerSignals), /A Person|Limited/);
      assert.doesNotMatch((lead.discoveryEvidence as any[]).map(d => d.text).join(" "), /closure|order|enforcement/i);
      assert.equal(await prisma.leadIntelligenceLead.count({ where: { name: "Corner Shop" } }), 0);
      const fsaiCalls = count("www.fsai.ie");
      assert.equal(fsaiCalls, 4, "index + 3 PDFs");
      assert.equal((await sources.importFsai(service.saveSeed, deadline())).skipped, true);
      assert.equal(count("www.fsai.ie"), fsaiCalls, "weekly gate makes no request");
      const forced = await sources.importFsai(service.saveSeed, deadline(), true);
      assert.equal(forced.skipped, false); assert.equal(forced.stored, 0, "orders are idempotent on fingerprint");
      assert.equal(await prisma.leadIntelligenceLead.count({ where: { name: "Harbour Kitchen" } }), 1);
      assert.equal(paid(), 0); assert.deepEqual(blocked, []);
    });

    const order = (premises: string, address: string, served = daysAgo(15)) => prisma.leadIntelligenceFsaiOrder.create({ data: {
      fingerprint: `closure:${premises}:${address}`, orderType: "closure", premises, nameKey: nameKey(premises), address, county: "Galway",
      businessType: "Restaurant/Café", dateServed: served, sourceUrl: "https://www.fsai.ie/getmedia/a1/Closure.pdf", hospitality: true } });
    const advert = (name: string, country: "ie" | "uk", city: string, county: string, address: string) => ({
      seed: { name, website: null, category: "Restaurant", country, county, city, address, sourceUrl: "https://www.irishjobs.ie/job/x", sourceKind: "job_advert" },
      role: "Head Chef", group: "hiring_chef" as const, advertUrl: "https://www.irishjobs.ie/job/x", datePosted: daysAgo(3), title: "Head Chef" });

    test("a job-advert lead gains a matching FSAI order or FHRS record and scores both", async () => {
      await order("Harbour Kitchen", "1 Quay Street Galway");
      const ie = await service.saveJobAdvert(advert("Harbour Kitchen", "ie", "Galway", "", ""));
      const a = await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id: ie.id } });
      assert.deepEqual([a.leadScore, a.grade], [140, "A+"]);
      assert.deepEqual((a.signalSummary as any).signals, ["FSAI Closure Order (" + ymd(daysAgo(15)) + ")", "Hiring Head Chef"]);
      assert.equal((await prisma.leadIntelligenceFsaiOrder.findFirstOrThrow()).leadId, ie.id);

      await prisma.leadIntelligenceFhrs.create({ data: { fhrsId: 7001, businessName: "Oak Room", nameKey: "oakroom", address: "1 High Street, London, W1 1AA",
        postcode: "W1 1AA", town: "London", localAuthority: "Westminster", rating: "2", ratingDate: daysAgo(100), businessType: "Restaurant/Cafe/Canteen", businessTypeId: 1 } });
      const uk = await service.saveJobAdvert(advert("Oak Room", "uk", "London", "", "1 High Street, London W1 1AA"));
      const b = await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id: uk.id } });
      assert.deepEqual([b.leadScore, b.grade], [110, "A+"]);
      assert.equal((await prisma.leadIntelligenceFhrs.findUniqueOrThrow({ where: { fhrsId: 7001 } })).leadId, uk.id);
    });

    test("an ambiguous name (two premises in the county) or an old order is not attached", async () => {
      await order("Harbour Kitchen", "1 Quay Street Galway"); await order("Harbour Kitchen", "9 Shop Street Galway");
      await order("Anchor Grill", "2 Dock Road Galway", daysAgo(200));
      const a = await service.saveJobAdvert(advert("Harbour Kitchen", "ie", "Galway", "Co. Galway", ""));
      const b = await service.saveJobAdvert(advert("Anchor Grill", "ie", "Galway", "Co. Galway", ""));
      for (const id of [a.id, b.id]) {
        const l = await prisma.leadIntelligenceLead.findUniqueOrThrow({ where: { id } });
        assert.deepEqual([l.leadScore, l.grade], [40, "B"]);
      }
      assert.equal(await prisma.leadIntelligenceFsaiOrder.count({ where: { leadId: { not: null } } }), 0);
    });

    test("runSourceImports holds a single lease; a stale lease (>10 min) is taken over and released", async () => {
      await prisma.leadIntelligenceSourceSync.create({ data: { source: "lock", lastStatus: "running", lastRunAt: new Date() } });
      const held = await sources.runSourceImports(service.saveSeed);
      assert.equal(held.skipped, true); assert.equal(calls.length, 0);
      await prisma.leadIntelligenceSourceSync.update({ where: { source: "lock" }, data: { lastRunAt: new Date(Date.now() - 11 * 60000) } });
      const run = await sources.runSourceImports(service.saveSeed);
      assert.equal(run.skipped, false);
      assert.equal((await prisma.leadIntelligenceSourceSync.findUniqueOrThrow({ where: { source: "lock" } })).lastStatus, "idle");
      assert.ok(count("www.fsai.ie") > 0 && count("api.ratings.food.gov.uk") > 0); assert.equal(paid(), 0);
    });

    test("sources cron route: 401 without auth, skipped when disabled, runs without paid keys", async () => {
      const { GET } = await import("../../app/api/cron/lead-intelligence-sources/route");
      const req = (auth?: string) => new NextRequest("http://localhost/api/cron/lead-intelligence-sources", { headers: auth ? { authorization: auth } : {} });
      assert.equal((await GET(req())).status, 401);
      assert.equal((await GET(req("Bearer wrong"))).status, 401);
      process.env.LEAD_INTELLIGENCE_ENABLED = "false";
      const off = await GET(req(`Bearer ${env.CRON_SECRET}`));
      assert.equal(off.status, 200); assert.equal((await off.json()).skipped, true); assert.equal(calls.length, 0);
      process.env.LEAD_INTELLIGENCE_ENABLED = "true"; delete process.env.SERPER_API_KEY; delete process.env.OPENAI_API_KEY;
      const on = await GET(req(`Bearer ${env.CRON_SECRET}`));
      assert.equal(on.status, 200); const body = await on.json();
      assert.equal(body.skipped, false); assert.equal(body.fsai.skipped, false); assert.equal(body.fhrs.units.length, 3);
      assert.equal(paid(), 0); assert.deepEqual(blocked, []);
    });
  });

  describe("cron route", () => {
    const req = (auth?: string) => new NextRequest("http://localhost/api/cron/lead-intelligence", { headers: auth ? { authorization: auth } : {} });
    test("401 without or with a wrong secret, skipped when disabled, no run row or provider calls", async () => {
      const { GET } = await import("../../app/api/cron/lead-intelligence/route");
      assert.equal((await GET(req())).status, 401);
      assert.equal((await GET(req("Bearer wrong"))).status, 401);
      delete process.env.CRON_SECRET;
      assert.equal((await GET(req("Bearer "))).status, 401, "missing CRON_SECRET fails closed");
      process.env.CRON_SECRET = env.CRON_SECRET; process.env.LEAD_INTELLIGENCE_ENABLED = "false";
      const res = await GET(req(`Bearer ${env.CRON_SECRET}`));
      assert.equal(res.status, 200); assert.equal((await res.json()).skipped, true);
      process.env.LEAD_INTELLIGENCE_ENABLED = "true"; delete process.env.SERPER_API_KEY;
      assert.equal((await GET(req(`Bearer ${env.CRON_SECRET}`))).status, 503);
      assert.equal(await prisma.leadIntelligenceRun.count(), 0); assert.equal(calls.length, 0);
    });
  });
});
