/**
 * Records what the browser's requests to Vercel Blob actually do during a
 * client upload (status code, or the network error), so a stuck upload can be
 * explained instead of sitting at 0%.
 *
 * Why patch fetch: @vercel/blob/client retries network errors and 5xx ~10 times
 * with exponential backoff (~17 min) and exposes no retry hook. Its browser
 * build captures `globalThis.fetch` when the module first evaluates, so this
 * patch must be installed BEFORE @vercel/blob/client is loaded — the tutorials
 * tab imports it dynamically after importing this file.
 *
 * Only requests to vercel.com/api/blob and our token route are observed, and
 * only while a listener is set; everything else passes straight through.
 */

export interface BlobProbeEvent {
  /** "token" (our route) | "put" | "mpu:create" | "mpu:upload" | "mpu:complete" */
  kind: string;
  part?: number;
  status?: number;
  error?: string;
  ms: number;
  at: string;
}

type Listener = (e: BlobProbeEvent) => void;

let listener: Listener | null = null;

export function setBlobProbe(fn: Listener | null) {
  listener = fn;
}

function headerOf(init: RequestInit | undefined, name: string): string | null {
  const h = init?.headers;
  if (!h) return null;
  if (h instanceof Headers) return h.get(name);
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name)?.[1] ?? null;
  const rec = h as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name);
  return key ? rec[key] : null;
}

declare global {
  interface Window {
    __rotahrBlobProbe?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__rotahrBlobProbe) {
  window.__rotahrBlobProbe = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const fn = listener;
    if (!fn) return original(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isBlob = url.startsWith("https://vercel.com/api/blob");
    const isToken = url.includes("/api/admin/tutorials/upload");
    if (!isBlob && !isToken) return original(input, init);

    const mpu = headerOf(init, "x-mpu-action");
    const partHeader = headerOf(init, "x-mpu-part-number");
    const kind = isToken ? "token" : mpu ? `mpu:${mpu}` : "put";
    const part = partHeader ? Number(partHeader) : undefined;
    const t0 = performance.now();
    const at = new Date().toISOString();
    try {
      const res = await original(input, init);
      fn({ kind, part, status: res.status, ms: Math.round(performance.now() - t0), at });
      return res;
    } catch (err) {
      const e = err as Error;
      fn({ kind, part, error: `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`, ms: Math.round(performance.now() - t0), at });
      throw err;
    }
  };
}
