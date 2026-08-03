/**
 * lib/seo/indexnow.ts — tell search engines about a new URL immediately.
 *
 * Google retired its sitemap ping endpoint in 2023, so "ping Google" advice you
 * find online is dead. What still works, and is free:
 *
 *  - IndexNow (Bing, Yandex, Seznam, Naver share one endpoint). Instant.
 *  - Google: discovery via the sitemap in Search Console. Nothing to call, but
 *    a sitemap whose lastModified actually changes gets recrawled faster, which
 *    is why the publish path touches updatedAt.
 *
 * The key is any 8-128 char hex string, hosted at /<key>.txt on the domain (see
 * app/[key]/route.ts equivalent — we serve it from app/indexnow/route.ts and a
 * static public file). No signup, no account.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";
const HOST = "rotahr.com";

export function indexNowKey(): string | null {
  return process.env.INDEXNOW_KEY || null;
}

/**
 * Submit up to 10,000 URLs. Returns a short status string for the run log —
 * never throws, because failing to ping is not a reason to fail a publish.
 */
export async function submitToIndexNow(urls: string[]): Promise<string> {
  const key = indexNowKey();
  if (!key) return "skipped: no INDEXNOW_KEY";
  if (urls.length === 0) return "skipped: no urls";

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `https://${HOST}/${key}.txt`,
        urlList: urls,
      }),
    });
    // 200 = accepted, 202 = accepted but key still validating. Both are fine.
    return `indexnow ${res.status} for ${urls.length} url(s)`;
  } catch (err) {
    return `indexnow failed: ${String(err)}`;
  }
}
