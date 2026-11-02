import { randomUUID } from "node:crypto";
import { Prisma, type LeadIntelligenceLead } from "@prisma/client";
import { prisma } from "@/lib/db";
import { crawlWebsite } from "./crawl";
import { BudgetError, ProviderBudget, discoverLeads, extractFacts, requireConfiguration, search } from "./providers";
import { generateDrafts, scoreLead, validateEvidence } from "./scoring";
import { CONTACT_KEYS, MODEL_VERSION, canonicalUrl, dedupeKey, normaliseCountry, type LeadSeed, type SourceDocument } from "./types";

const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const MAX_MODEL_CHARS = 42000;
const errorText = (e: unknown) => e instanceof Error ? e.message.slice(0,500) : "Unknown failure";
const normAddress = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
/**
 * Exact dedupe key first. Fallback on same country+name+city only when unambiguous:
 * equal normalised addresses, or exactly one same-name venue in that city with one side lacking an address.
 * Two same-name venues in one city (e.g. chain branches) are never merged on an empty address.
 */
async function findDuplicate(key: string, country: string, seed: LeadSeed) {
  const exact = await prisma.leadIntelligenceLead.findUnique({where:{dedupeKey:key}});
  if (exact || !seed.city) return exact;
  const candidates = await prisma.leadIntelligenceLead.findMany({where:{country,
    name:{equals:seed.name,mode:"insensitive"},city:{equals:seed.city,mode:"insensitive"}},take:20,orderBy:{createdAt:"asc"}});
  const address = normAddress(seed.address);
  const sameAddress = address ? candidates.find(c => normAddress(c.address)===address) : undefined;
  if (sameAddress) return sameAddress;
  if (candidates.length===1 && (!address || !normAddress(candidates[0].address))) return candidates[0];
  return null;
}
export async function saveSeed(seed: LeadSeed) {
  const country = normaliseCountry(seed.country);
  const internal = seed.sourceKind.startsWith("existing_") && /^internal:[a-z_]+:[\w-]+$/.test(seed.sourceUrl);
  if (!country || (!internal && !canonicalUrl(seed.sourceUrl))) throw new Error("Lead needs an Ireland/UK location and a public source URL.");
  const key = dedupeKey({...seed,country});
  const existing = await findDuplicate(key,country,seed);
  if (existing) {
    // Enrichment never resets contact/suppression state or approved human notes.
    if (!existing.website && seed.website) await prisma.leadIntelligenceLead.update({where:{id:existing.id},data:{website:seed.website}});
    return {id:existing.id,created:false};
  }
  try {
    const created = await prisma.leadIntelligenceLead.create({data:{
      dedupeKey:key,name:seed.name,website:seed.website,category:seed.category,country,
      county:seed.county,city:seed.city,address:seed.address,sourceUrl:seed.sourceUrl,sourceKind:seed.sourceKind,
      ...(seed.documents?.length ? {discoveryEvidence:asJson(seed.documents)} : {}),
    }});
    return {id:created.id,created:true};
  } catch(e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") {
      const existing = await prisma.leadIntelligenceLead.findUniqueOrThrow({where:{dedupeKey:key}});
      return {id:existing.id,created:false};
    }
    throw e;
  }
}

function storedDocs(raw: Prisma.JsonValue | null): SourceDocument[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is Prisma.JsonObject => typeof d==="object" && d!==null && !Array.isArray(d))
    .filter(d => typeof d.url==="string" && typeof d.text==="string" && typeof d.fetchedAt==="string")
    .map(d => ({url:String(d.url),text:String(d.text),fetchedAt:String(d.fetchedAt),kind:d.kind==="maps"?"maps":"search"}));
}
export async function analyseLead(lead: LeadIntelligenceLead, budget: ProviderBudget, runId: string) {
  const seed:LeadSeed = {name:lead.name,website:lead.website,category:lead.category,country:lead.country,county:lead.county,city:lead.city,address:lead.address,sourceUrl:lead.sourceUrl,sourceKind:lead.sourceKind};
  let docs = storedDocs(lead.discoveryEvidence);
  const warnings:string[] = [];
  try { docs.push(...await search(`"${lead.name.replace(/"/g,"")}" ${lead.city || lead.address} ${lead.country==="ie"?"Ireland":"United Kingdom"} contact food events careers recruitment`,lead.country,budget)); }
  catch(e) { warnings.push(errorText(e)); }
  if (lead.website) {
    try {
      const crawl = await crawlWebsite(lead.website,Math.min(budget.deadline,Date.now()+22000));
      docs.push(...crawl.documents); warnings.push(...crawl.warnings);
    } catch(e) { warnings.push(errorText(e)); }
  }
  // Model input is capped; prioritize direct website evidence, then public snippets.
  docs = docs.sort((a,b) => Number(b.kind==="website")-Number(a.kind==="website"));
  const seen = new Set<string>(); let chars = 0; const capped:SourceDocument[] = [];
  for (const d of docs) {
    const key = canonicalUrl(d.url);
    if (!key || seen.has(key) || chars >= MAX_MODEL_CHARS || capped.length >= 10) continue;
    seen.add(key);
    const text = d.text.slice(0, Math.min(12000, MAX_MODEL_CHARS - chars));
    chars += text.length; capped.push({...d,text});
  }
  docs = capped;
  if (!docs.length) throw new Error("No public evidence available; previous analysis preserved.");
  const raw = await extractFacts(seed,docs,budget);
  const facts = validateEvidence(raw,docs,seed);
  if (!facts.identityConfirmed) throw new Error("Venue identity/location could not be confirmed; previous analysis preserved.");
  const scores = scoreLead(facts);
  // No outreach copy for a venue whose hospitality fit is not established.
  const drafts = scores.fit === null ? null : generateDrafts(seed,facts);
  const contacts = Object.fromEntries(CONTACT_KEYS.map(k => [k,facts.contacts[k]?.value ?? null]));
  const saved = await prisma.$transaction(async tx => {
    // A contact-state change made by a human during analysis must survive it.
    const current = await tx.leadIntelligenceLead.findUniqueOrThrow({where:{id:lead.id}});
    if (["suppressed","converted","not_interested"].includes(current.status)) return false;
    await tx.leadIntelligenceAnalysis.create({data:{leadId:lead.id,runId,modelVersion:MODEL_VERSION,
      facts:asJson(facts),scores:asJson(scores),sources:asJson(docs.map(d => ({...d,text:d.text.slice(0,14000)}))),
      reasoning:asJson([...scores.reasoning,...warnings]),...(drafts ?? {})}});
    await tx.leadIntelligenceLead.update({where:{id:lead.id},data:{...contacts,
      fitScore:scores.fit,intentScore:scores.intent,intentStatus:scores.intentStatus,complexityScore:scores.complexity,
      reachabilityScore:scores.reachability,priorityScore:scores.priority,classification:scores.classification,
      bestContactMethod:scores.bestContactMethod,decisionMaker:scores.decisionMaker,contactReason:scores.contactReason,
      status:current.status==="new" && scores.fit!==null ? "qualified" : current.status,
      analysedAt:new Date(),nextAnalysisAt:new Date(Date.now()+7*86400000),lastError:null,
    }});
    return true;
  });
  return {id:lead.id,name:lead.name,saved,drafted:saved && drafts !== null,...scores};
}

async function importExistingSeeds(limit: number): Promise<LeadSeed[]> {
  // Read existing platform lead tables only. Never tenant guest CRM or sender writes.
  const [callCount,venueCount,outreachCount] = await Promise.all([
    prisma.callLead.count(),prisma.venueCandidate.count(),prisma.outreachLead.count(),
  ]);
  const day = Math.floor(Date.now()/86400000);
  const offset = (count:number) => count ? (day*limit)%count : 0;
  const [calls,venues,outreach] = await Promise.all([
    prisma.callLead.findMany({orderBy:{id:"asc"},skip:offset(callCount),take:limit}),
    prisma.venueCandidate.findMany({orderBy:{id:"asc"},skip:offset(venueCount),take:limit}),
    prisma.outreachLead.findMany({orderBy:{id:"asc"},skip:offset(outreachCount),take:limit}),
  ]);
  return [
    ...calls.filter(r => !["not_interested","signed"].includes(r.status)).map(r => ({name:r.name,website:null,category:r.category,country:r.country,county:r.region,city:r.city,address:r.address,sourceUrl:`https://www.openstreetmap.org/${r.osmType}/${r.osmId}`,sourceKind:"existing_call"})),
    ...venues.filter(r => r.status!=="skipped").map(r => ({name:r.name,website:r.websiteFound,category:r.amenity,country:r.country,county:"",city:r.city??"",address:[r.housenumber,r.street,r.city].filter(Boolean).join(", "),sourceUrl:`https://www.openstreetmap.org/${r.osmRef}`,sourceKind:"existing_venue"})),
    // Existing email strings are NOT copied as verified public contact evidence.
    ...outreach.filter(r => !["unsubscribed","bounced","replied"].includes(r.status)).map(r => ({name:r.name,website:null,category:r.segment,country:r.country,county:r.region,city:r.city,address:"",sourceUrl:`internal:outreach:${r.id}`,sourceKind:"existing_outreach"})),
  ].filter(r => normaliseCountry(r.country) && !!r.city);
}

export async function runIntelligence(trigger: "cron" | "manual", leadId?: string) {
  const config = requireConfiguration();
  const now = new Date();
  const runKey = trigger==="cron" ? `daily:${now.toISOString().slice(0,10)}` : `manual:${randomUUID()}`;
  // Clean up leases left by function termination, never a live <=10min worker.
  await prisma.leadIntelligenceRun.updateMany({where:{activeLock:"lead-intelligence",startedAt:{lt:new Date(Date.now()-10*60000)}},data:{activeLock:null,status:"failed",completedAt:new Date(),errors:["Worker lease expired; safe to retry."]}});
  const previous = await prisma.leadIntelligenceRun.findUnique({where:{runKey}});
  if (previous?.status==="completed" || previous?.status==="partial") return {skipped:true,reason:"Daily run already completed",run:previous};
  if (previous?.activeLock) return {skipped:true,reason:"Another intelligence worker is active"};
  let run;
  try {
    run = previous ? await prisma.leadIntelligenceRun.update({where:{id:previous.id},data:{activeLock:"lead-intelligence",status:"running",startedAt:now,completedAt:null}})
      : await prisma.leadIntelligenceRun.create({data:{runKey,trigger,activeLock:"lead-intelligence"}});
  } catch(e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") return {skipped:true,reason:"Another intelligence worker is active"};
    throw e;
  }
  // Paid-call caps are per run AND per UTC day across every run (cron, retries, manual).
  const dayStart = new Date(now); dayStart.setUTCHours(0,0,0,0);
  const spent = await prisma.leadIntelligenceRun.aggregate({where:{startedAt:{gte:dayStart},id:{not:run.id}},_sum:{queries:true,modelCalls:true}});
  const priorQueries = run.queries; const priorModel = run.modelCalls;
  const budget = new ProviderBudget(Date.now()+240000,
    Math.max(0,Math.min(config.queryLimit,config.dailyQueryCap-(spent._sum.queries??0)-priorQueries)),
    Math.max(0,Math.min(config.modelCallLimit,config.dailyModelCap-(spent._sum.modelCalls??0)-priorModel)));
  const runId = run.id;
  budget.onSpend = async () => { await prisma.leadIntelligenceRun.update({where:{id:runId},data:{queries:priorQueries+budget.queries,modelCalls:priorModel+budget.modelCalls}}); };
  const usage = () => ({queries:priorQueries+budget.queries,modelCalls:priorModel+budget.modelCalls});
  const errors:string[] = []; let failures = 0; let discovered=previous?.discovered??0; let analysed=previous?.analysed??0; let drafts=previous?.drafts??0;
  if (budget.queryLimit===0 || budget.modelLimit===0) errors.push("Daily provider cap reached; no paid calls made in this run.");
  try {
    if (!leadId) {
      const outcome = await discoverLeads(budget); errors.push(...outcome.warnings); failures += outcome.failures;
      const existing = await importExistingSeeds(5);
      const candidates = [...outcome.leads,...existing].slice(0,config.discoveryLimit);
      for (const seed of candidates) {
        if (budget.deadline-Date.now()<30000) {errors.push("Notice: time budget reached while saving discoveries."); break;}
        try { if ((await saveSeed(seed)).created) discovered++; }
        catch(e) { failures++; errors.push(`Save ${seed.name}: ${errorText(e)}`); }
      }
      await prisma.leadIntelligenceRun.update({where:{id:run.id},data:{discovered,...usage(),errors:asJson(errors)}});
    }
    const leads = await prisma.leadIntelligenceLead.findMany({where:{
      ...(leadId?{id:leadId}:{nextAnalysisAt:{lte:new Date()}}),
      status:{notIn:["suppressed","not_interested","converted"]},
    },orderBy:[{analysedAt:{sort:"asc",nulls:"first"}},{nextAnalysisAt:"asc"},{createdAt:"asc"}],take:leadId?1:config.analysisLimit});
    if (leadId && !leads.length) throw new Error("Lead not found or suppressed.");
    for (const lead of leads) {
      if (budget.deadline-Date.now()<30000) {errors.push("Time budget reached; remaining leads stay queued."); break;}
      if (budget.modelCalls>=budget.modelLimit) {errors.push("AI call budget reached; remaining leads stay queued."); break;}
      try { const r = await analyseLead(lead,budget,run.id); if (r.saved) analysed++; else errors.push(`${lead.name}: status changed during analysis; result discarded.`); if (r.drafted) drafts++; }
      catch(e) {
        if (e instanceof BudgetError) { errors.push(`Notice: ${lead.name} left queued (${e.message})`); break; }
        failures++; errors.push(`${lead.name}: ${errorText(e)}`);
        await prisma.leadIntelligenceLead.update({where:{id:lead.id},data:{lastError:errorText(e),nextAnalysisAt:new Date(Date.now()+86400000)}});
      }
      await prisma.leadIntelligenceRun.update({where:{id:run.id},data:{discovered,analysed,drafts,...usage(),errors:asJson(errors)}});
    }
    // Notices (skipped Maps results, budget stops) are recorded but do not fail the run.
    const status = failures ? (discovered || analysed ? "partial" : "failed") : "completed";
    const result = await prisma.leadIntelligenceRun.update({where:{id:run.id},data:{status,activeLock:null,completedAt:new Date(),discovered,analysed,drafts,...usage(),errors:asJson(errors)}});
    return {skipped:false,run:result};
  } catch(e) {
    errors.push(errorText(e));
    await prisma.leadIntelligenceRun.update({where:{id:run.id},data:{status:"failed",activeLock:null,completedAt:new Date(),discovered,analysed,drafts,...usage(),errors:asJson(errors)}});
    throw e;
  }
}