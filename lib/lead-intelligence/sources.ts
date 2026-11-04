/**
 * Free trigger sources (no paid calls): UK FHRS ratings and FSAI enforcement orders.
 * Records are persisted in their own tables, then promoted to leads with a trigger signal.
 * Nothing here contacts a business.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FHRS_BUSINESS_TYPES, fetchFhrs, fhrsSeed } from "./fhrs";
import { FSAI_INDEX_URL, findOrderPdfLinks, fsaiFingerprint, isHospitalityType, parseFsaiPdf, type FsaiRow } from "./fsai";
import { FSAI_MAX_AGE_DAYS, computeLeadScore, nameKey } from "./signals";
import { FHRS_UNITS, countyForIeTown } from "./towns";
import type { LeadSeed } from "./types";
import { fhrsSignal, fsaiSeed, fsaiSignal, ieCounty, type SignalInput } from "./source-signals";
export { fhrsSignal, fsaiSeed, fsaiSignal, ieCounty, type SignalInput };

const asJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const errorText = (e: unknown) => e instanceof Error ? e.message.slice(0, 300) : "Unknown failure";
export const FHRS_UNITS_PER_RUN = 3;
export const FHRS_PROMOTE_PER_RUN = 40;
/** Ratings older than this are kept for matching but not promoted on their own. */
export const FHRS_PROMOTE_MAX_AGE_DAYS = 3 * 365;
export const FSAI_INTERVAL_DAYS = 7;
const UA = "RotahrLeadIntelligence/2 (+https://rotahr.com)";

/** Idempotent on fingerprint; a re-import refreshes points/label/date but never moves a signal to another lead. */
export async function saveSignal(leadId: string, s: SignalInput) {
  await prisma.leadIntelligenceSignal.upsert({ where: { fingerprint: s.fingerprint },
    create: { leadId, type: s.type, label: s.label, points: s.points, sourceUrl: s.sourceUrl, detail: s.detail ?? "", eventDate: s.eventDate ?? null,
      fingerprint: s.fingerprint, ...(s.data === undefined ? {} : { data: asJson(s.data) }) },
    update: { label: s.label, points: s.points, detail: s.detail ?? "", eventDate: s.eventDate ?? null, ...(s.data === undefined ? {} : { data: asJson(s.data) }) } });
}
export async function recomputeLeadScore(leadId: string, now = new Date()) {
  const signals = await prisma.leadIntelligenceSignal.findMany({ where: { leadId } });
  const score = computeLeadScore(signals, now);
  await prisma.leadIntelligenceLead.update({ where: { id: leadId }, data: { leadScore: score.lead_score, grade: score.grade,
    signalSummary: asJson({ lead_score: score.lead_score, signals: score.signals, breakdown: score.breakdown }) } });
  return score;
}

/**
 * Cross-source matching for a lead found elsewhere (job advert, Maps): same normalised name in the same
 * UK town (FHRS) or Irish county (FSAI). Ambiguous matches (two same-name branches) are skipped.
 */
export async function attachKnownRecords(leadId: string, seed: Pick<LeadSeed, "name" | "country" | "city" | "county" | "address">) {
  const key = nameKey(seed.name); if (key.length < 5) return 0;
  let attached = 0;
  if (seed.country === "uk" && seed.city) {
    const records = await prisma.leadIntelligenceFhrs.findMany({ where: { nameKey: key, town: { equals: seed.city, mode: "insensitive" }, rating: { not: "superseded" } }, take: 5 });
    const pc = seed.address.match(/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i)?.[0].replace(/\s/g, "").toUpperCase();
    const match = pc ? records.filter(r => r.postcode.replace(/\s/g, "").toUpperCase() === pc) : records;
    if (match.length === 1 && (!match[0].leadId || match[0].leadId === leadId)) {
      await prisma.leadIntelligenceFhrs.update({ where: { id: match[0].id }, data: { leadId } });
      await saveSignal(leadId, fhrsSignal(match[0])); attached++;
    }
  }
  if (seed.country === "ie") {
    const county = ieCounty(seed.county) || countyForIeTown(seed.city) || seed.city;
    const orders = await prisma.leadIntelligenceFsaiOrder.findMany({ where: { nameKey: key, hospitality: true,
      dateServed: { gte: new Date(Date.now() - FSAI_MAX_AGE_DAYS * 86400000) } }, take: 10 });
    const inCounty = orders.filter(o => county && ieCounty(o.county).toLowerCase() === county.toLowerCase());
    const premises = new Set(inCounty.map(o => nameKey(o.address)));
    if (premises.size === 1) for (const o of inCounty) {
      if (o.leadId && o.leadId !== leadId) continue;
      await prisma.leadIntelligenceFsaiOrder.update({ where: { id: o.id }, data: { leadId } });
      await saveSignal(leadId, fsaiSignal(o)); attached++;
    }
  }
  if (attached) await recomputeLeadScore(leadId);
  return attached;
}

type Save = (seed: LeadSeed) => Promise<{ id: string; created: boolean }>;
async function syncState(source: string) {
  return prisma.leadIntelligenceSourceSync.upsert({ where: { source }, create: { source }, update: {} });
}

/** Rotates FHRS_UNITS_PER_RUN (town, authority) units per run, then promotes the worst recent ratings to leads. */
export async function importFhrs(saveSeed: Save, deadline: number) {
  const state = await syncState("fhrs");
  const stats = { units: [] as string[], fetched: 0, stored: 0, superseded: 0, promoted: 0, newLeads: 0, errors: [] as string[] };
  let cursor = state.cursor;
  for (let i = 0; i < FHRS_UNITS_PER_RUN && deadline - Date.now() > 20000; i++) {
    const unit = FHRS_UNITS[cursor % FHRS_UNITS.length]; cursor++;
    stats.units.push(`${unit.town} (${unit.authority})`);
    for (const typeId of FHRS_BUSINESS_TYPES) {
      try {
        const records = await fetchFhrs(unit.authorityId, typeId, deadline);
        stats.fetched += records.length;
        const existing = await prisma.leadIntelligenceFhrs.findMany({ where: { OR: [{ fhrsId: { in: records.map(r => r.fhrsId) } }, { localAuthority: unit.authority, businessTypeId: typeId }] } });
        const byId = new Map(existing.map(e => [e.fhrsId, e]));
        const fresh = records.filter(r => !byId.has(r.fhrsId));
        if (fresh.length) stats.stored += (await prisma.leadIntelligenceFhrs.createMany({ skipDuplicates: true, data: fresh.map(r => ({ ...r, nameKey: nameKey(r.businessName), town: unit.town, localAuthority: unit.authority, businessTypeId: typeId })) })).count;
        for (const r of records) {
          const e = byId.get(r.fhrsId);
          if (!e || (e.rating === r.rating && e.ratingDate?.getTime() === r.ratingDate?.getTime())) continue;
          await prisma.leadIntelligenceFhrs.update({ where: { id: e.id }, data: { rating: r.rating, ratingDate: r.ratingDate, businessName: r.businessName, address: r.address, fetchedAt: new Date() } });
          if (e.leadId) { await saveSignal(e.leadId, fhrsSignal(r)); await recomputeLeadScore(e.leadId); }
        }
        // A complete list no longer containing a venue means it was re-rated 4-5 (or closed): retire its signal.
        const seen = new Set(records.map(r => r.fhrsId));
        const gone = existing.filter(e => e.localAuthority === unit.authority && e.businessTypeId === typeId && !seen.has(e.fhrsId) && e.rating !== "superseded");
        if (gone.length) {
          await prisma.leadIntelligenceFhrs.updateMany({ where: { id: { in: gone.map(g => g.id) } }, data: { rating: "superseded", fetchedAt: new Date() } });
          await prisma.leadIntelligenceSignal.deleteMany({ where: { fingerprint: { in: gone.map(g => `fhrs:${g.fhrsId}`) } } });
          for (const g of gone) if (g.leadId) await recomputeLeadScore(g.leadId);
          stats.superseded += gone.length;
        }
      } catch (e) { stats.errors.push(`${unit.town}/${typeId}: ${errorText(e)}`); }
    }
  }
  const candidates = await prisma.leadIntelligenceFhrs.findMany({ where: { leadId: null, rating: { in: ["0", "1", "2", "3"] },
    ratingDate: { gte: new Date(Date.now() - FHRS_PROMOTE_MAX_AGE_DAYS * 86400000) } }, orderBy: [{ rating: "asc" }, { ratingDate: "desc" }], take: FHRS_PROMOTE_PER_RUN });
  for (const r of candidates) {
    if (deadline - Date.now() < 5000) { stats.errors.push("Notice: deadline reached while promoting FHRS records."); break; }
    try {
      const saved = await saveSeed(fhrsSeed(r, r.town));
      await prisma.leadIntelligenceFhrs.update({ where: { id: r.id }, data: { leadId: saved.id } });
      await saveSignal(saved.id, fhrsSignal(r)); await recomputeLeadScore(saved.id);
      stats.promoted++; if (saved.created) stats.newLeads++;
    } catch (e) { stats.errors.push(`Promote ${r.businessName}: ${errorText(e)}`); }
  }
  await prisma.leadIntelligenceSourceSync.update({ where: { source: "fhrs" }, data: { cursor: cursor % FHRS_UNITS.length, lastRunAt: new Date(),
    lastStatus: stats.errors.some(e => !e.startsWith("Notice")) ? "partial" : "completed", details: asJson(stats) } });
  return stats;
}

async function fetchText(url: string, deadline: number) {
  const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(Math.min(20000, deadline - Date.now())), cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`${new URL(url).pathname} returned ${res.status}`);
  return res;
}

/** Weekly: FSAI drops lifted orders from its lists (prohibition after 1 month), so records are persisted on first sight. */
export async function importFsai(saveSeed: Save, deadline: number, force = false) {
  const state = await syncState("fsai");
  const stats = { skipped: false, pdfs: {} as Record<string, number>, stored: 0, hospitality: 0, promoted: 0, newLeads: 0, skippedPages: 0, errors: [] as string[] };
  if (!force && state.lastRunAt && Date.now() - state.lastRunAt.getTime() < (FSAI_INTERVAL_DAYS - 0.5) * 86400000) return { ...stats, skipped: true };
  try {
    const links = findOrderPdfLinks(await (await fetchText(FSAI_INDEX_URL, deadline)).text());
    for (const type of ["closure", "prohibition", "improvement"] as const) {
      const url = links[type];
      if (!url) { stats.errors.push(`No ${type} PDF link found on the FSAI page.`); continue; }
      try {
        const res = await fetchText(url, deadline);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > 20 * 1024 * 1024) throw new Error("PDF larger than 20 MB");
        const { rows, skippedPages } = await parseFsaiPdf(buf, type);
        stats.pdfs[type] = rows.length; stats.skippedPages += skippedPages;
        if (skippedPages) stats.errors.push(`${type}: ${skippedPages} page(s) had an unrecognised layout and were skipped.`);
        stats.stored += await upsertOrders(rows, url);
      } catch (e) { stats.errors.push(`${type}: ${errorText(e)}`); }
    }
  } catch (e) { stats.errors.push(`FSAI index: ${errorText(e)}`); }
  const candidates = await prisma.leadIntelligenceFsaiOrder.findMany({ where: { hospitality: true, leadId: null,
    dateServed: { gte: new Date(Date.now() - FSAI_MAX_AGE_DAYS * 86400000) } }, orderBy: { dateServed: "desc" }, take: 60 });
  stats.hospitality = candidates.length;
  for (const o of candidates) {
    if (deadline - Date.now() < 5000) { stats.errors.push("Notice: deadline reached while promoting FSAI orders."); break; }
    try {
      const saved = await saveSeed(fsaiSeed(o));
      await prisma.leadIntelligenceFsaiOrder.update({ where: { id: o.id }, data: { leadId: saved.id } });
      await saveSignal(saved.id, fsaiSignal(o)); await recomputeLeadScore(saved.id);
      stats.promoted++; if (saved.created) stats.newLeads++;
    } catch (e) { stats.errors.push(`Promote ${o.premises}: ${errorText(e)}`); }
  }
  await prisma.leadIntelligenceSourceSync.update({ where: { source: "fsai" }, data: { lastRunAt: new Date(),
    lastStatus: stats.errors.some(e => !e.startsWith("Notice")) ? "partial" : "completed", details: asJson(stats) } });
  return stats;
}
async function upsertOrders(rows: FsaiRow[], sourceUrl: string) {
  let created = 0;
  for (const r of rows) {
    const fingerprint = fsaiFingerprint(r);
    const existing = await prisma.leadIntelligenceFsaiOrder.findUnique({ where: { fingerprint } });
    if (existing) {
      await prisma.leadIntelligenceFsaiOrder.update({ where: { id: existing.id }, data: { lastSeenAt: new Date(), dateLifted: r.dateLifted ?? existing.dateLifted, orderUrl: r.orderUrl ?? existing.orderUrl } });
      continue;
    }
    await prisma.leadIntelligenceFsaiOrder.create({ data: { fingerprint, orderType: r.orderType, premises: r.premises, nameKey: nameKey(r.premises), address: r.address,
      county: r.county, businessType: r.businessType, dateServed: r.dateServed, dateLifted: r.dateLifted, orderUrl: r.orderUrl, sourceUrl,
      hospitality: isHospitalityType(r.businessType) } });
    created++;
  }
  return created;
}

/** Free-source run used by the sources cron and the admin button. No paid provider is touched. */
export async function runSourceImports(saveSeed: Save, opts: { forceFsai?: boolean; deadline?: number } = {}) {
  const deadline = opts.deadline ?? Date.now() + 240000;
  // Single worker: take a lease on the "lock" row; a lease older than 10 minutes is a dead worker.
  await prisma.leadIntelligenceSourceSync.upsert({ where: { source: "lock" }, create: { source: "lock" }, update: {} });
  const lease = await prisma.leadIntelligenceSourceSync.updateMany({ where: { source: "lock",
    OR: [{ lastStatus: { not: "running" } }, { lastRunAt: { lt: new Date(Date.now() - 10 * 60000) } }, { lastRunAt: null }] },
    data: { lastStatus: "running", lastRunAt: new Date() } });
  if (!lease.count) return { skipped: true as const, reason: "Another source import is running." };
  try {
    const fsai = await importFsai(saveSeed, Math.min(deadline, Date.now() + 100000), opts.forceFsai);
    const fhrs = await importFhrs(saveSeed, deadline);
    return { skipped: false as const, fsai, fhrs };
  } finally {
    await prisma.leadIntelligenceSourceSync.update({ where: { source: "lock" }, data: { lastStatus: "idle" } });
  }
}
