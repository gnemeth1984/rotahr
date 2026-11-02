import { resolve4 } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";
import { canonicalUrl, isFirstPartyRotahr, type SourceDocument } from "./types";

const UA = "RotahrLeadIntelligence/1.0 (+https://rotahr.com; sales@rotahr.com)";
const MAX_BYTES = 400_000;
export function isPublicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
    a === 192 && (b === 168 || b === 0 || b === 88 && c === 99) ||
    a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
    a === 203 && b === 0 && c === 113);
}
export function allowedUrl(raw: string): URL {
  const valid = canonicalUrl(raw);
  if (!valid) throw new Error("Only public HTTP(S) URLs without credentials are allowed.");
  const u = new URL(valid);
  if ((u.port && !["80", "443"].includes(u.port)) || !u.hostname.includes(".") || isFirstPartyRotahr(raw)) throw new Error("Blocked URL host or port.");
  if (isIP(u.hostname) && !isPublicIPv4(u.hostname)) throw new Error("Private or unsupported address.");
  return u;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void;
/** Node may call lookup with {all:true} (autoSelectFamily); answer both shapes with the pre-validated IP only. */
export function pinnedLookup(ip: string) {
  return (_hostname: string, options: unknown, callback?: LookupCallback) => {
    const cb = (typeof options === "function" ? options : callback) as LookupCallback;
    const all = typeof options === "object" && options !== null && (options as { all?: boolean }).all;
    if (all) cb(null, [{ address: ip, family: 4 }]); else cb(null, ip, 4);
  };
}
export type Page = { url: string; status: number; type: string; html: string; truncated?: boolean };
/** Called for every hop, redirects included, BEFORE the request. Throw to refuse the hop. */
export type HopGuard = (u: URL) => void | Promise<void>;
export type FetchOptions = {
  /** Redirect hops allowed after the first request (default 3). */
  maxRedirects?: number;
  /** Body size cap (default 400 KB). */
  maxBytes?: number;
  /** Keep the first maxBytes instead of failing when a body is larger. */
  truncate?: boolean;
  accept?: string;
};
export class TooManyRedirectsError extends Error {}
/**
 * Reads a response body up to maxBytes. Over the cap it either rejects (pages) or keeps the first maxBytes and
 * reports truncated=true (robots.txt, RFC 9309 §2.5). The socket is destroyed as soon as the cap is reached.
 */
export function readBody(res: http.IncomingMessage, maxBytes: number, truncate: boolean): Promise<{ body: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []; let bytes = 0; let done = false;
    const finish = (truncated: boolean) => { if (!done) { done = true; resolve({ body: Buffer.concat(chunks).toString("utf8"), truncated }); } };
    res.on("data", (chunk: Buffer) => {
      if (done) return;
      if (bytes + chunk.length > maxBytes) {
        if (!truncate) { done = true; res.destroy(); reject(new Error("Page exceeds crawl size limit.")); return; }
        chunks.push(chunk.subarray(0, maxBytes - bytes)); bytes = maxBytes;
        finish(true); res.destroy(); return;
      }
      bytes += chunk.length; chunks.push(chunk);
    });
    res.on("error", e => { if (!done) { done = true; reject(e); } });
    res.on("end", () => finish(false));
  });
}
/** Resolve A records and pin the socket lookup; no DNS-rebinding/private redirects. */
export async function safeGet(raw: string, deadline: number, redirects = 0, guard?: HopGuard, opts: FetchOptions = {}): Promise<Page> {
  if (redirects > (opts.maxRedirects ?? 3)) throw new TooManyRedirectsError("Too many redirects.");
  const u = allowedUrl(raw);
  // Each hop (including redirect targets) is checked BEFORE any request is made.
  await guard?.(u);
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  const ms = Math.min(5000, deadline - Date.now());
  if (ms < 100) throw new Error("Crawl deadline reached.");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    isIP(u.hostname) ? Promise.resolve([u.hostname]) : resolve4(u.hostname),
    new Promise<never>((_,reject) => { timer = setTimeout(() => reject(new Error("DNS timeout.")), ms); }),
  ]).finally(() => clearTimeout(timer));
  if (!addresses.length || addresses.some(a => !isPublicIPv4(a))) throw new Error("Host resolves to a private/reserved address.");
  const ip = addresses[0];
  const result = await new Promise<Page & { location?: string }>((resolve,reject) => {
    const transport = u.protocol === "https:" ? https : http;
    const req = transport.get(u, {
      headers: { "User-Agent": UA, Accept: opts.accept ?? "text/html,text/plain,application/xhtml+xml", "Accept-Encoding": "identity" },
      // TLS validates the original host; only DNS resolution is overridden.
      lookup: pinnedLookup(ip),
      agent: false,
    }, res => {
      readBody(res, maxBytes, !!opts.truncate).then(({ body, truncated }) => resolve({
        url:u.toString(), status:res.statusCode ?? 0, type:String(res.headers["content-type"] || ""), html:body, location:res.headers.location, truncated,
      }), reject);
    });
    const timeout = setTimeout(() => req.destroy(new Error("Page timeout.")), ms);
    req.on("close", () => clearTimeout(timeout));
    req.on("error", reject);
  });
  if (result.status >= 300 && result.status < 400 && result.location) {
    return safeGet(new URL(result.location,u).toString(),deadline,redirects+1,guard,opts);
  }
  return result;
}

/** Our robots.txt product token (RFC 9309 §2.2.1). Must match the UA string's product. */
export const ROBOTS_PRODUCT_TOKEN = "RotahrLeadIntelligence";
/** RFC 9309 §2.5: crawlers must parse at least the first 500 KiB. */
export const ROBOTS_MAX_BYTES = 500 * 1024;
const UNRESERVED = /^[A-Za-z0-9\-._~]$/;
/**
 * RFC 9309 §2.2.2 path normalisation: percent-encoded unreserved characters are decoded, other escapes are
 * upper-cased, and non-ASCII/space/control characters are UTF-8 percent-encoded. Applied to rules and URLs alike.
 */
export function normaliseRobotsPath(p: string): string {
  const decoded = p.replace(/%([0-9a-fA-F]{2})/g, (_, h: string) => {
    const c = String.fromCharCode(parseInt(h, 16));
    return UNRESERVED.test(c) ? c : `%${h.toUpperCase()}`;
  });
  return decoded.replace(/[^\x21-\x7E]/gu, c => { try { return encodeURIComponent(c); } catch { return ""; } });
}
/**
 * RFC 9309 matching. Groups naming our product token (case-insensitive, version ignored) are merged and used;
 * otherwise merged `*` groups; no matching group means everything is allowed. Most specific (longest) rule wins,
 * Allow wins an exact tie, `*` is a wildcard and a trailing `$` anchors the end. /robots.txt is always allowed.
 */
export function robotsAllows(text: string, path: string): boolean {
  const target = normaliseRobotsPath(path || "/");
  if (target === "/robots.txt") return true;
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let current: Group = { agents: [], rules: [] };
  for (const line of text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/)) {
    const content = line.split("#")[0];
    const colon = content.indexOf(":");
    if (colon < 0) continue;
    const key = content.slice(0, colon).trim().toLowerCase();
    const value = content.slice(colon + 1).trim();
    if (key === "user-agent") {
      // A user-agent line after rules starts a new group; consecutive user-agent lines share one group.
      if (current.rules.length) { groups.push(current); current = { agents: [], rules: [] }; }
      current.agents.push(value === "*" ? "*" : value.split(/[\/\s]/)[0].toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current.agents.length && value) {
      current.rules.push({ allow: key === "allow", path: normaliseRobotsPath(value) });
    }
  }
  groups.push(current);
  const token = ROBOTS_PRODUCT_TOKEN.toLowerCase();
  const specific = groups.filter(g => g.agents.includes(token));
  const active = specific.length ? specific : groups.filter(g => g.agents.includes("*"));
  let winner = { allow: true, length: -1 };
  for (const g of active) for (const rule of g.rules) {
    const anchored = rule.path.endsWith("$");
    const body = anchored ? rule.path.slice(0, -1) : rule.path;
    const pattern = body.split("*").map(part => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
    if (new RegExp(`^${pattern}${anchored ? "$" : ""}`).test(target)) {
      const length = rule.path.length;
      if (length > winner.length || (length === winner.length && rule.allow)) winner = { allow: rule.allow, length };
    }
  }
  return winner.allow;
}

export type RobotsPolicy =
  | { kind: "rules"; text: string; truncated: boolean }
  | { kind: "allow_all"; reason: string }
  | { kind: "unreachable"; reason: string };
/**
 * RFC 9309 §2.3.1 status handling for the final robots.txt response:
 * 2xx parse rules; 4xx "unavailable" means crawling is allowed; 5xx means "unreachable", so disallow everything.
 * 429 is treated as unreachable on purpose: rate limiting is the site asking us to back off.
 * A 3xx with no usable Location is treated as unreachable (conservative; the RFC does not define it).
 */
export function robotsPolicyFromStatus(status: number, text: string, truncated = false): RobotsPolicy {
  if (status >= 200 && status < 300) return { kind: "rules", text, truncated };
  if (status === 429) return { kind: "unreachable", reason: "HTTP 429 rate limited" };
  if (status >= 400 && status < 500) return { kind: "allow_all", reason: `HTTP ${status}: robots.txt unavailable` };
  return { kind: "unreachable", reason: `HTTP ${status || "no status"}` };
}
/**
 * Fetches /robots.txt for one authority (scheme+host+port). Up to five redirects are followed, across hosts too
 * (RFC 9309 §2.3.1.2), and every hop still passes the SSRF checks in safeGet. More than five redirects means
 * "unavailable"; network, DNS, timeout or SSRF failures mean "unreachable". Bodies beyond 500 KiB are truncated.
 */
export async function fetchRobots(origin: string, deadline: number, fetcher: Fetcher = safeGet): Promise<RobotsPolicy> {
  try {
    const r = await fetcher(`${origin}/robots.txt`, deadline, 0, undefined,
      { maxRedirects: 5, maxBytes: ROBOTS_MAX_BYTES, truncate: true, accept: "text/plain,*/*;q=0.5" });
    return robotsPolicyFromStatus(r.status, r.html, r.truncated);
  } catch (e) {
    if (e instanceof TooManyRedirectsError) return { kind: "allow_all", reason: "more than five redirects: robots.txt unavailable" };
    return { kind: "unreachable", reason: e instanceof Error ? e.message : "fetch failed" };
  }
}

export function decodeHtml(s: string): string {
  return s.replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&nbsp;/gi," ").replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n) => String.fromCodePoint(Math.min(Number(n),0x10ffff)));
}
export function parsePage(html: string, base: string) {
  const links = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(m => {
    try { return {url:new URL(decodeHtml(m[1]),base).toString(),text:decodeHtml(m[2].replace(/<[^>]+>/g," ")).trim()}; }
    catch { return null; }
  }).filter((x): x is {url:string;text:string} => x!==null);
  const text = decodeHtml(html.replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi," ").replace(/<[^>]+>/g," ")).replace(/\s+/g," ").trim().slice(0,14000);
  const published = links.filter(l => /^(mailto:|tel:)|facebook\.com|instagram\.com|linkedin\.com/i.test(l.url));
  const hasContactForm = /<form\b/i.test(html) && /<(textarea)\b|name=["'](?:message|enquiry|inquiry)["']/i.test(html);
  return {text:`${text}\nPublished links: ${published.map(l => `${l.text} ${l.url}`).join("; ")}${hasContactForm ? `\nContact form URL: ${base}` : ""}`,links};
}

export type Fetcher = (url: string, deadline: number, redirects: number, guard?: HopGuard, opts?: FetchOptions) => Promise<Page>;
/** `fetcher` is injectable for offline tests; production always uses the pinned, SSRF-checked safeGet. */
export async function crawlWebsite(raw: string, deadline: number, fetcher: Fetcher = safeGet): Promise<{documents:SourceDocument[];warnings:string[]}> {
  const documents: SourceDocument[] = []; const warnings: string[] = [];
  const home = allowedUrl(raw);
  const site = (h: string) => h.replace(/^www\./,"");
  const sameSite: HopGuard = u => { if (site(u.hostname) !== site(home.hostname)) throw new Error("Cross-domain redirect skipped."); };
  // robots.txt is per authority (RFC 9309 §2.3): www and apex, or http and https, each get their own file.
  const robotsCache = new Map<string, Promise<RobotsPolicy>>();
  const robotsFor = (u: URL) => {
    if (!robotsCache.has(u.origin)) robotsCache.set(u.origin, fetchRobots(u.origin, deadline, fetcher));
    return robotsCache.get(u.origin)!;
  };
  const first = await robotsFor(home);
  if (first.kind === "unreachable") throw new Error(`robots.txt unreachable (${first.reason}); crawl skipped per RFC 9309.`);
  if (first.kind === "rules" && first.truncated) warnings.push(`${home.origin}/robots.txt exceeds 500 KiB; only the first 500 KiB was applied.`);
  const politeHop: HopGuard = async u => {
    sameSite(u);
    const policy = await robotsFor(u);
    if (policy.kind === "unreachable") throw new Error(`robots.txt for ${u.host} unreachable (${policy.reason}); page skipped.`);
    if (policy.kind === "rules" && !robotsAllows(policy.text, u.pathname + u.search)) throw new Error("Blocked by robots.txt.");
  };
  const queue = [home.toString()]; const seen = new Set<string>();
  while (queue.length && documents.length < 4 && Date.now() < deadline - 500) {
    const url = queue.shift()!;
    if (seen.has(url)) continue; seen.add(url);
    try {
      const page = await fetcher(url,deadline,0,politeHop);
      if (page.status !== 200 || !/html|text\/plain/.test(page.type)) throw new Error(`Unreadable page (${page.status}).`);
      const parsed = parsePage(page.html,page.url);
      documents.push({url:page.url,text:parsed.text,kind:"website",fetchedAt:new Date().toISOString()});
      if (documents.length === 1) {
        for (const term of ["contact","about","career|jobs|recruit|vacanc"]) {
          const link = parsed.links.find(l => { try { return site(new URL(l.url).hostname) === site(home.hostname) && new RegExp(term,"i").test(l.url+" "+l.text); } catch { return false; } });
          if (link && !queue.includes(link.url) && !seen.has(link.url)) queue.push(link.url);
        }
      }
    } catch(e) { warnings.push(`${url}: ${e instanceof Error ? e.message : "Crawl failed"}`); }
  }
  return {documents,warnings};
}
