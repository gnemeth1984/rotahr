/**
 * Pre-send MX validation for outreach leads.
 *
 * WHY THIS EXISTS
 * A 10-lead test batch produced 3 soft bounces reading "Unable to find MX of
 * domain" and 1 hard bounce. Those domains have no mail exchanger at all, so the
 * address cannot receive mail from anyone - no send was ever going to work. Every
 * attempt is a wasted slot against the daily cap and, worse, bounce rate is the
 * main input to sender reputation: dead addresses in the list actively degrade
 * delivery for the good ones. On a free Brevo account a bad bounce rate gets the
 * sender throttled or suspended.
 *
 * Checking DNS costs nothing and needs no third-party service, so there is no
 * reason to discover a dead domain by burning a send on it.
 *
 * WHAT COUNTS AS DEAD
 * Only "this domain has no route for mail at all" - an MX lookup with no usable
 * answer, and no A/AAAA fallback either. Per RFC 5321 a domain with an address
 * record but no MX can still legitimately accept mail, so those are kept.
 * A DNS resolution failure is NOT treated as dead: a resolver hiccup or rate
 * limit must never mark a real prospect unreachable. Unknown stays eligible.
 */

const DOH = "https://dns.google/resolve";

export type MxVerdict = "ok" | "no-mx" | "unknown";

export interface DomainCheck {
  domain: string;
  verdict: MxVerdict;
  detail: string;
}

/** DNS response codes we care about. 0 = NOERROR, 3 = NXDOMAIN. */
async function query(domain: string, type: "MX" | "A"): Promise<{ status: number; answers: number } | null> {
  try {
    const res = await fetch(`${DOH}?name=${encodeURIComponent(domain)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { Status?: number; Answer?: { data?: string; type?: number }[] };
    const wanted = type === "MX" ? 15 : 1;
    const answers = (json.Answer ?? []).filter((a) => a.type === wanted);
    // A null MX ("." per RFC 7505) is an explicit declaration that the domain
    // accepts no mail. Treat it as no MX rather than a valid record.
    const usable =
      type === "MX"
        ? answers.filter((a) => {
            const host = (a.data ?? "").trim().split(/\s+/).pop() ?? "";
            return host !== "" && host !== ".";
          })
        : answers;
    return { status: json.Status ?? 0, answers: usable.length };
  } catch {
    return null;
  }
}

export async function checkDomain(domain: string): Promise<DomainCheck> {
  const d = domain.trim().toLowerCase();
  if (!d || !d.includes(".")) return { domain: d, verdict: "no-mx", detail: "not a domain" };

  const mx = await query(d, "MX");
  if (mx === null) return { domain: d, verdict: "unknown", detail: "MX lookup failed" };

  if (mx.answers > 0) return { domain: d, verdict: "ok", detail: `${mx.answers} MX` };

  if (mx.status === 3) return { domain: d, verdict: "no-mx", detail: "NXDOMAIN" };

  // No MX. A domain with an address record may still accept mail (RFC 5321
  // implicit MX), so check before condemning it.
  const a = await query(d, "A");
  if (a === null) return { domain: d, verdict: "unknown", detail: "A lookup failed" };
  if (a.answers > 0) return { domain: d, verdict: "ok", detail: "no MX, A fallback" };

  return { domain: d, verdict: "no-mx", detail: "no MX, no A" };
}

/** Check many domains with bounded concurrency. */
export async function checkDomains(
  domains: string[],
  concurrency = 12,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, DomainCheck>> {
  const unique = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  const out = new Map<string, DomainCheck>();
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < unique.length) {
      const mine = unique[index++];
      const result = await checkDomain(mine);
      out.set(mine, result);
      done++;
      if (onProgress && done % 25 === 0) onProgress(done, unique.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  if (onProgress) onProgress(done, unique.length);
  return out;
}

export function domainOf(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}
