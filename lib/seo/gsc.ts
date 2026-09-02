/**
 * lib/seo/gsc.ts — Google Search Console client, zero dependencies.
 *
 * Search Console's API is free and unlimited for practical purposes, and it is
 * the only source of truth about what the site actually ranks for. Paid SEO
 * tools charge for a worse version of this data (their crawlers estimate; this
 * is measured).
 *
 * Auth is a service account. We sign the JWT with node's crypto rather than
 * pulling in googleapis (~40MB) for two endpoints.
 *
 * Setup (once, free):
 *  1. console.cloud.google.com → new project → enable "Google Search Console API"
 *  2. Create a service account → Keys → Add key → JSON
 *  3. Search Console → rotahr.com → Settings → Users and permissions →
 *     Add user = the service account email, permission "Full" (Restricted can
 *     read reports but cannot submit the sitemap)
 *  4. Env vars: GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY (paste the whole key, \n escaped),
 *     GSC_SITE_URL (e.g. "sc-domain:rotahr.com" for a domain property)
 *
 * Everything degrades gracefully: with no credentials the autopilot still runs
 * on Google Suggest alone, it just can't see rankings.
 */

import crypto from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
/**
 * Two scopes on purpose. Every reporting call keeps the read-only scope, and
 * only sitemap submission asks for write, so a mistake in the write path can
 * never touch the property through the read path. Tokens are cached per scope.
 */
const READ_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const WRITE_SCOPE = "https://www.googleapis.com/auth/webmasters";

export function gscConfigured(): boolean {
  return !!(process.env.GSC_CLIENT_EMAIL && process.env.GSC_PRIVATE_KEY && process.env.GSC_SITE_URL);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const cachedTokens = new Map<string, { token: string; expiresAt: number }>();

/** Exported for the diagnostic route, which needs to separate a credentials
 *  failure from a Search Console permission failure. */
export async function gscAccessToken(): Promise<string> {
  return accessToken();
}

async function accessToken(scope: string = READ_SCOPE): Promise<string> {
  const cached = cachedTokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const email = process.env.GSC_CLIENT_EMAIL!;
  // Vercel env vars keep newlines as literal "\n" — restore them or the sign fails.
  const key = process.env.GSC_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = b64url(
    crypto.createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key)
  );
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    throw new Error(`GSC token request failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedTokens.set(scope, {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  });
  return json.access_token;
}

export type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

/**
 * Raw Search Analytics query.
 *
 * @param dimensions e.g. ["query"], ["page"], ["page","query"]
 * @param days       lookback window (Search Console data lags ~2 days)
 */
export async function searchAnalytics(
  dimensions: string[],
  days = 28,
  rowLimit = 1000
): Promise<GscRow[]> {
  if (!gscConfigured()) return [];

  const site = process.env.GSC_SITE_URL!;
  const token = await accessToken();

  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2); // trailing days are always incomplete
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      site
    )}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: iso(start),
        endDate: iso(end),
        dimensions,
        rowLimit,
        dataState: "final",
      }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    throw new Error(`GSC query failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

/** Queries the site is already visible for, keyed by query string. */
export async function queryPerformance(days = 28) {
  const rows = await searchAnalytics(["query"], days, 2000);
  return rows.map((r) => ({
    keyword: r.keys[0].toLowerCase(),
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/** Per-page performance, used to spot decaying and striking-distance articles. */
export async function pagePerformance(days = 28) {
  const rows = await searchAnalytics(["page"], days, 1000);
  return rows.map((r) => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/**
 * Day-by-day site totals — the series behind the trend chart.
 *
 * Search Console keeps 16 months, so the first run can backfill real history
 * instead of the dashboard staying empty for weeks. `dataState: "final"` plus
 * the 2-day lag in searchAnalytics() means every row returned is settled and
 * won't change underneath us.
 */
export async function dailyPerformance(days = 90) {
  const rows = await searchAnalytics(["date"], days, Math.max(days + 5, 100));
  return rows.map((r) => ({
    date: r.keys[0], // "YYYY-MM-DD"
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/**
 * Queries sitting at position 4-20: ranking, but below the clicks. Rewriting an
 * existing article to properly answer one of these is the highest-return work
 * available, and it's the thing DIY SEO almost always skips.
 */
export async function strikingDistance(days = 28, minImpressions = 20) {
  const rows = await searchAnalytics(["query", "page"], days, 2000);
  return rows
    .filter((r) => r.impressions >= minImpressions && r.position >= 4 && r.position <= 20)
    .map((r) => ({
      keyword: r.keys[0].toLowerCase(),
      page: r.keys[1],
      clicks: r.clicks,
      impressions: r.impressions,
      position: r.position,
    }))
    .sort((a, b) => b.impressions - a.impressions);
}

/* ------------------------------------------------------------------ sitemaps */

const SITEMAP_API = "https://www.googleapis.com/webmasters/v3";

/** The one sitemap we own. app/sitemap.ts generates it, revalidating hourly. */
export const SITEMAP_URL = "https://rotahr.com/sitemap.xml";

export type GscSitemap = {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean;
  warnings: number;
  errors: number;
  /** Per content type: how many URLs Google read out of the file. */
  submitted: { type: string; submitted: number; indexed: number }[];
};

type RawSitemap = {
  path?: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  isPending?: boolean;
  warnings?: string | number;
  errors?: string | number;
  contents?: { type?: string; submitted?: string | number; indexed?: string | number }[];
};

const num = (v: string | number | undefined) => Number(v ?? 0) || 0;

function normalise(raw: RawSitemap): GscSitemap {
  return {
    path: raw.path ?? "",
    lastSubmitted: raw.lastSubmitted ?? null,
    lastDownloaded: raw.lastDownloaded ?? null,
    isPending: Boolean(raw.isPending),
    warnings: num(raw.warnings),
    errors: num(raw.errors),
    submitted: (raw.contents ?? []).map((c) => ({
      type: c.type ?? "web",
      submitted: num(c.submitted),
      // Google stopped populating "indexed" for sitemaps years ago; it is
      // almost always 0 and means nothing. Kept so the shape matches the API.
      indexed: num(c.indexed),
    })),
  };
}

/**
 * Every sitemap Search Console knows about for the property, with the bit that
 * actually matters: lastDownloaded. If that date is recent, Google has already
 * re-read the file and there is nothing to submit.
 */
export async function listSitemaps(): Promise<GscSitemap[]> {
  if (!gscConfigured()) return [];

  const site = process.env.GSC_SITE_URL!;
  const token = await accessToken(); // read-only is enough to list
  const res = await fetch(`${SITEMAP_API}/sites/${encodeURIComponent(site)}/sitemaps`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`GSC sitemap list failed (${res.status}): ${await res.text()}`);
  }

  const json = (await res.json()) as { sitemap?: RawSitemap[] };
  return (json.sitemap ?? []).map(normalise);
}

/**
 * (Re)submit the sitemap. This is a nudge, not a prerequisite: once a sitemap
 * is registered Google re-fetches it on its own schedule, so new pages get
 * picked up whether or not this ever runs. Submitting just shortens the wait,
 * and re-submitting an already-registered sitemap is a no-op plus a fresh
 * crawl hint. Needs the service account to hold "Full" (not "Restricted")
 * permission on the property.
 *
 * Returns 200 with an empty body on success.
 */
export async function submitSitemap(feedpath: string = SITEMAP_URL): Promise<void> {
  if (!gscConfigured()) throw new Error("Search Console is not configured");

  const site = process.env.GSC_SITE_URL!;
  const token = await accessToken(WRITE_SCOPE);
  const res = await fetch(
    `${SITEMAP_API}/sites/${encodeURIComponent(site)}/sitemaps/${encodeURIComponent(feedpath)}`,
    { method: "PUT", headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );

  if (!res.ok) {
    const body = await res.text();
    // 403 here is nearly always the permission level, not the credentials —
    // say so, because the fix is one dropdown in Search Console.
    if (res.status === 403) {
      throw new Error(
        `GSC rejected the submit (403). The service account (${process.env.GSC_CLIENT_EMAIL}) needs "Full" permission on ${site}, not "Restricted". ${body}`
      );
    }
    throw new Error(`GSC sitemap submit failed (${res.status}): ${body}`);
  }
}
