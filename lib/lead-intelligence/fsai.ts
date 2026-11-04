/**
 * FSAI enforcement-order lists (Closure / Improvement / Prohibition). Free public PDFs, no paid calls.
 * The PDFs are tables whose cells wrap over several lines, so text is grouped by position:
 * a record starts at a DD/MM/YYYY in the first column, and every item below it (until the next
 * record) is appended to the column whose left edge it sits under.
 */
import { nameKey } from "./signals";

export const FSAI_INDEX_URL = "https://www.fsai.ie/enforcement-and-legislation/enforcement";
export type FsaiOrderType = "closure" | "improvement" | "prohibition";
export type PdfItem = { s: string; x: number; y: number };
export type PdfLink = { url: string; rect: [number, number, number, number] };
export type FsaiRow = {
  orderType: FsaiOrderType; premises: string; address: string; county: string;
  businessType: string; dateServed: Date; dateLifted: Date | null; orderUrl: string | null;
};

// "Served On" is parsed only to keep columns aligned; the person/company served is never stored.
const LABELS = ["Date Served", "Date Lifted", "Date For Compliance", "Date Of Compliance", "Premises", "Address", "County",
  "Served On", "Business Type", "Issuing Agency", "Legislation", "Product Withdrawn", "Enforcement Order"] as const;
type Label = typeof LABELS[number];
const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
export function parseFsaiDate(raw: string): Date | null {
  const m = raw.trim().match(DATE); if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  return d.getUTCDate() === Number(m[1]) && d.getUTCMonth() === Number(m[2]) - 1 ? d : null;
}

/** Finds PDF links for each order type on the FSAI enforcement page; getmedia GUIDs change on refresh. */
export function findOrderPdfLinks(html: string, base = FSAI_INDEX_URL): Partial<Record<FsaiOrderType, string>> {
  const out: Partial<Record<FsaiOrderType, string>> = {};
  for (const m of html.matchAll(/href="([^"]+\.pdf)"/gi)) {
    let url: URL; try { url = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (url.hostname !== "www.fsai.ie" && url.hostname !== "fsai.ie") continue;
    const file = decodeURIComponent(url.pathname.split("/").pop() ?? "").toLowerCase();
    const type: FsaiOrderType | null = /closure/.test(file) ? "closure" : /improvement/.test(file) ? "improvement" : /prohibition/.test(file) ? "prohibition" : null;
    if (type && !out[type]) out[type] = url.toString();
  }
  return out;
}

/** Column layout from the header: label order from the header text, x from each header item. */
function headerColumns(items: PdfItem[]) {
  const anchor = items.find(i => /^Date Served/.test(i.s.trim()));
  if (!anchor) return null;
  const header = items.filter(i => i.y <= anchor.y + 3 && i.y >= anchor.y - 16);
  const byX = new Map<number, PdfItem[]>();
  for (const i of header) { const k = [...byX.keys()].find(x => Math.abs(x - i.x) <= 3) ?? i.x; byX.set(k, [...(byX.get(k) ?? []), i]); }
  const groups = [...byX.entries()].sort((a, b) => a[0] - b[0]).map(([x, its]) => {
    const text = its.sort((a, b) => b.y - a.y).map(i => i.s.trim()).join(" ").replace(/\s+/g, " ");
    const labels: Label[] = []; let rest = text;
    while (rest) {
      const hit = LABELS.find(l => rest.startsWith(l));
      if (hit) { labels.push(hit); rest = rest.slice(hit.length).trim(); continue; }
      // A label wrapped across header items ("Date For Compliance Date Of" + "Compliance").
      const partial = LABELS.find(l => l.startsWith(rest));
      if (partial) labels.push(partial);
      break;
    }
    return { x, labels };
  });
  // Merge the trailing fragment of a wrapped label into the previous group.
  const merged: { x: number; labels: Label[] }[] = [];
  for (const g of groups) {
    const prev = merged[merged.length - 1];
    if (prev && g.labels.length === 1 && prev.labels.includes(g.labels[0])) continue;
    if (g.labels.length) merged.push(g);
  }
  return { y: Math.min(...header.map(i => i.y)), groups: merged };
}
const cluster = (xs: number[]) => {
  const out: number[] = [];
  for (const x of [...xs].sort((a, b) => a - b)) if (!out.length || x - out[out.length - 1] > 4) out.push(x);
  return out;
};

/** Parses one page's positioned text into rows. Returns null when the layout cannot be mapped safely. */
export type FsaiHeader = NonNullable<ReturnType<typeof headerColumns>>;
/**
 * Parses one page's positioned text into rows. Continuation pages have no header row, so the previous
 * page's column layout is passed in. rows is null when the layout cannot be mapped safely.
 */
export function parseFsaiPage(items: PdfItem[], orderType: FsaiOrderType, links: PdfLink[] = [], previous: FsaiHeader | null = null): { rows: FsaiRow[] | null; header: FsaiHeader | null } {
  const own = headerColumns(items);
  const head = own && own.groups.length ? own : previous ? { ...previous, y: Math.max(...items.map(i => i.y), 0) + 10 } : null;
  if (!head) return { rows: items.some(i => DATE.test(i.s.trim())) ? null : [], header: null };
  const rows = parseRows(items, orderType, links, head);
  return { rows, header: own && own.groups.length ? own : previous };
}
function parseRows(items: PdfItem[], orderType: FsaiOrderType, links: PdfLink[], head: FsaiHeader): FsaiRow[] | null {
  const body = items.filter(i => i.y < head.y - 4 && i.y > 55 && i.s.trim() && !/^(Page :|Date Report Refreshed|\* ?$|Orders served before|September 2017 are not published|(Prohibition|Closure|Improvement) Orders|A copy of each order|month will be available)/.test(i.s.trim()));
  const firstX = head.groups[0].x;
  const starts = body.filter(i => DATE.test(i.s.trim()) && Math.abs(i.x - firstX) <= 15).sort((a, b) => b.y - a.y);
  if (!starts.length) return [];
  // Each header group owns the data columns between its x and the next group's x.
  const xs = cluster(body.map(i => i.x));
  const colOf = new Map<number, Label>();
  for (let g = 0; g < head.groups.length; g++) {
    const lo = head.groups[g].x - 6, hi = g + 1 < head.groups.length ? head.groups[g + 1].x - 6 : Infinity;
    const inGroup = xs.filter(x => x >= lo && x < hi);
    const labels = head.groups[g].labels;
    if (labels.length === 1) { for (const x of inGroup) colOf.set(x, labels[0]); continue; }
    // A merged header ("Served On Business Type Issuing Agency Legislation") needs one data column per label.
    if (inGroup.length !== labels.length) return null;
    inGroup.forEach((x, i) => colOf.set(x, labels[i]));
  }
  const columnFor = (x: number) => { const c = xs.filter(v => v <= x + 4).pop(); return c === undefined ? undefined : colOf.get(c); };
  const rows: FsaiRow[] = [];
  for (let r = 0; r < starts.length; r++) {
    const top = starts[r].y + 3, bottom = r + 1 < starts.length ? starts[r + 1].y + 3 : -Infinity;
    const cells: Partial<Record<Label, string[]>> = {};
    for (const i of body.filter(i => i.y <= top && i.y > bottom).sort((a, b) => b.y - a.y || a.x - b.x)) {
      const col = columnFor(i.x); if (!col) continue;
      (cells[col] ??= []).push(i.s.trim());
    }
    const text = (l: Label) => (cells[l] ?? []).join(" ").replace(/\s+/g, " ").replace(/\s*\/\s+/g, "/").replace(/ - /g, " - ").trim();
    const dateServed = parseFsaiDate(text("Date Served"));
    const premises = text("Premises").replace(/\s*\((all|the) areas[^)]*\)?/i, "").trim();
    if (!dateServed || !premises) continue;
    const link = links.find(l => starts[r].y >= l.rect[1] - 6 && starts[r].y <= l.rect[3] + 6);
    const orderUrl = link && /^https:\/\/(www\.)?fsai\.ie\//.test(link.url) ? link.url : null;
    rows.push({ orderType, premises, address: text("Address"), county: text("County"),
      businessType: text("Business Type").replace(/\/\s*/g, "/"), dateServed,
      dateLifted: parseFsaiDate(text("Date Lifted") || text("Date Of Compliance")), orderUrl });
  }
  return rows;
}

/** Venues Rotahr sells to. Retailers, manufacturers and distributors are tracked but never promoted. */
export function isHospitalityType(type: string): boolean {
  const t = type.toLowerCase();
  if (/retail|manufactur|distribut|wholesal|producer|packer|importer|supplement|butcher|supermarket|primary|residential|private dwelling|delicatessen|pharmacy|health food|vessel|processing|poultry/.test(t)) return false;
  return /restaurant|caf[eé]|take ?away|hotel|pub|bar|b&b|guest|caterer|catering|canteen|service sector|mobile|food stall/.test(t);
}
export function fsaiFingerprint(row: Pick<FsaiRow, "orderType" | "premises" | "dateServed" | "address">) {
  return `${row.orderType}:${nameKey(row.premises)}:${nameKey(row.address).slice(0, 40)}:${row.dateServed.toISOString().slice(0, 10)}`;
}

/** Extracts positioned text with unpdf (pure-JS pdf.js build, works on serverless). */
export async function parseFsaiPdf(buffer: Uint8Array, orderType: FsaiOrderType): Promise<{ rows: FsaiRow[]; skippedPages: number }> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(buffer);
  const rows: FsaiRow[] = []; let skippedPages = 0; let header: FsaiHeader | null = null;
  for (let n = 1; n <= Math.min(pdf.numPages, 60); n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const raw of content.items as unknown[]) {
      const i = raw as { str?: string; transform?: number[] };
      if (typeof i.str === "string" && i.str.trim() && Array.isArray(i.transform)) items.push({ s: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) });
    }
    const annotations = await page.getAnnotations() as { url?: string; rect?: number[] }[];
    const links = annotations.filter(a => typeof a.url === "string" && Array.isArray(a.rect)).map(a => ({ url: a.url!, rect: a.rect!.map(Math.round) as PdfLink["rect"] }));
    const parsed = parseFsaiPage(items, orderType, links, header);
    header = parsed.header;
    if (parsed.rows === null) skippedPages++; else rows.push(...parsed.rows);
  }
  return { rows, skippedPages };
}
