/**
 * SMTP recipient verification — does this mailbox actually exist?
 *
 * WHY THIS EXISTS, AND WHY MX CHECKING WASN'T ENOUGH
 * August's numbers: 74 requests, 9 hard bounces = 12.2%, where the tolerated
 * ceiling is about 2%. Every one of those 9 was a mailbox-level rejection:
 *
 *   info@lebowskis.co.uk   550-5.1.1 The email account ... does not exist
 *   clocktower@ihg.com     550 5.1.1 User Unknown
 *   info@pintshop.co.uk    550 5.1.0 Recipient not found
 *
 * All of those domains have valid MX records, so `mx-check.ts` would have
 * cleared all 9. The list is scraped `info@` guesses: the domain is real, the
 * mailbox is invented. Only asking the receiving server about the specific
 * address separates the two.
 *
 * Measured against that exact set: 8 of 9 known-bad classified `dead`, 0 of 5
 * known-delivering addresses wrongly condemned. The single miss is a catch-all
 * domain, which is a limit of the protocol rather than of this code.
 *
 * WHY IT CANNOT RUN DURING A REQUEST
 * This speaks SMTP on port 25, which Vercel blocks outbound. Verification is a
 * batch job run from a trusted machine; results are persisted on the lead and
 * the sender reads the stored verdict. Never call this from a route handler.
 *
 * HOW A VERDICT IS DECIDED (the safe direction is "unknown")
 *   dead      — 5xx on RCPT TO. The only verdict that blocks a send.
 *   ok        — 2xx on RCPT TO and a random address at the same domain is
 *               refused, so the accept means something.
 *   catch-all — 2xx for the address AND for a nonsense one. Proves nothing
 *               either way; still sendable, but not evidence of existence.
 *   no-mx     — the domain has no mail route at all.
 *   unknown   — greylisting, timeouts, blocked probes, DNS failure. NEVER
 *               treated as bad: a resolver hiccup must not delete a real
 *               prospect from the list.
 *
 * The probe never sends DATA, so no mail is delivered by verifying.
 */
import net from "node:net";
import dns from "node:dns/promises";

import { type EmailVerdict, isUndeliverable } from "./verdict";

export { isUndeliverable };
export type { EmailVerdict };

export interface VerifyResult {
  email: string;
  verdict: EmailVerdict;
  detail: string;
}

/**
 * Envelope sender for the probe. A real, deliverable address on our own domain:
 * some servers reject an empty or non-resolving MAIL FROM, which would show up
 * as a false `unknown` for every address at that host.
 */
const PROBE_FROM = process.env.VERIFY_PROBE_FROM || "postmaster@rotahr.com";
const PROBE_HELO = process.env.VERIFY_PROBE_HELO || "rotahr.com";
const TIMEOUT_MS = 12_000;

function domainOf(email: string): string {
  return (email.split("@")[1] ?? "").trim().toLowerCase();
}

async function mxHosts(domain: string): Promise<string[]> {
  const records = await dns.resolveMx(domain);
  return records
    .filter((r) => r.exchange && r.exchange !== ".")
    .sort((a, b) => a.priority - b.priority)
    .map((r) => r.exchange);
}

/**
 * One SMTP conversation, driven as a small script of expected reply codes.
 *
 * Replies are accumulated until a line whose 4th character is a space arrives,
 * which is how SMTP marks the final line of a multi-line reply — reading a
 * fixed number of bytes instead truncates mid-reply and misreads the code.
 */
function smtpConversation(
  host: string,
  email: string
): Promise<{ verdict: EmailVerdict; detail: string }> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port: 25 });
    socket.setTimeout(TIMEOUT_MS);

    let buffer = "";
    let stage: "banner" | "ehlo" | "mail" | "rcpt" | "catchall" | "done" = "banner";
    let settled = false;
    /**
     * The reply to the real address, kept aside before the catch-all probe runs.
     *
     * Without this the recorded detail was whichever reply came last, so a
     * correctly-accepted address was filed as `ok` with the random probe's
     * "550 User Unknown" next to it — a verdict and an explanation that flatly
     * contradict each other, which is worse than no explanation.
     */
    let rcptReply = "";
    const randomLocal = `zz-no-such-user-${Math.random().toString(36).slice(2, 10)}`;

    const finish = (verdict: EmailVerdict, detail: string) => {
      if (settled) return;
      settled = true;
      try {
        socket.write("QUIT\r\n");
        socket.end();
      } catch {
        /* closing is best-effort */
      }
      resolve({ verdict, detail: detail.replace(/\s+/g, " ").slice(0, 160) });
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.trimEnd().split("\n");
      const last = lines[lines.length - 1] ?? "";
      // Not the final line of a multi-line reply yet.
      if (last.length < 4 || last[3] !== " ") return;

      const reply = buffer.trim();
      const code = reply.slice(0, 3);
      buffer = "";

      switch (stage) {
        case "banner":
          if (!code.startsWith("220")) return finish("unknown", `banner ${reply}`);
          stage = "ehlo";
          socket.write(`EHLO ${PROBE_HELO}\r\n`);
          return;

        case "ehlo":
          if (!code.startsWith("250")) return finish("unknown", `EHLO refused ${reply}`);
          stage = "mail";
          socket.write(`MAIL FROM:<${PROBE_FROM}>\r\n`);
          return;

        case "mail":
          if (!code.startsWith("250")) return finish("unknown", `MAIL FROM refused ${reply}`);
          stage = "rcpt";
          socket.write(`RCPT TO:<${email}>\r\n`);
          return;

        case "rcpt":
          if (code.startsWith("25")) {
            // Accepted — but ask about an address that cannot exist before
            // believing it.
            rcptReply = reply;
            stage = "catchall";
            socket.write(`RCPT TO:<${randomLocal}@${domainOf(email)}>\r\n`);
            return;
          }
          if (code.startsWith("55")) return finish("dead", reply);
          // 4xx is temporary (greylisting, rate limit) — not evidence of absence.
          return finish("unknown", reply);

        case "catchall":
          if (code.startsWith("25")) return finish("catch-all", `accepts any address (${reply})`);
          // A 4xx to the control probe (rate limit, greylisting) is not a
          // rejection, so catch-all stays unproven — but the real address was
          // accepted, which is what the verdict is about.
          if (code.startsWith("4")) {
            return finish("ok", `${rcptReply} [catch-all check inconclusive: ${reply.slice(0, 40)}]`);
          }
          return finish("ok", rcptReply || reply);

        default:
          return;
      }
    });

    socket.on("timeout", () => finish("unknown", `timeout after ${TIMEOUT_MS}ms`));
    socket.on("error", (err) => finish("unknown", err.message));
    socket.on("close", () => finish("unknown", "connection closed early"));
  });
}

export async function verifyEmail(email: string): Promise<VerifyResult> {
  const address = email.trim().toLowerCase();
  const domain = domainOf(address);
  if (!address.includes("@") || !domain.includes(".")) {
    return { email: address, verdict: "dead", detail: "not an email address" };
  }

  let hosts: string[] = [];
  try {
    hosts = await mxHosts(domain);
  } catch (e) {
    const code = (e as { code?: string }).code;
    // Only a resolver failure is inconclusive. ENOTFOUND/ENODATA mean "no MX",
    // which is not the same as "no mail" — see the A fallback below.
    if (code !== "ENOTFOUND" && code !== "ENODATA") {
      return { email: address, verdict: "unknown", detail: `DNS ${code ?? "error"}` };
    }
  }

  /**
   * No MX is not the end of the enquiry. RFC 5321 §5.1 says a domain with an
   * address record and no MX still accepts mail at that host (implicit MX), and
   * plenty of real venues are set up that way: hotelindigo.com, folium.co.uk and
   * cafeopus.co.uk all have A records and no MX. Because `no-mx` blocks sending,
   * skipping this check condemned 5 reachable prospects out of the first 20
   * tested.
   */
  if (!hosts.length) {
    try {
      const a = await dns.resolve4(domain);
      if (a.length) hosts = [domain];
    } catch {
      /* fall through to no-mx */
    }
  }
  if (!hosts.length) return { email: address, verdict: "no-mx", detail: "no MX and no A record" };

  // Try the next MX only while the answer is inconclusive: a 5xx from the
  // primary is authoritative and asking a backup invites a different answer.
  let last: { verdict: EmailVerdict; detail: string } = { verdict: "unknown", detail: "not attempted" };
  for (const host of hosts.slice(0, 2)) {
    last = await smtpConversation(host, address);
    if (last.verdict !== "unknown") break;
  }
  return { email: address, verdict: last.verdict, detail: `${last.detail}` };
}

/**
 * Verify many addresses with low concurrency and a per-domain gap.
 *
 * Concurrency is deliberately small: hammering a mail host with parallel probes
 * from one IP is exactly the pattern that earns a rate-limit, and a rate-limited
 * host answers 4xx, which turns good addresses into `unknown` and wastes the run.
 */
export async function verifyEmails(
  emails: string[],
  opts: { concurrency?: number; onResult?: (r: VerifyResult, done: number, total: number) => void } = {}
): Promise<VerifyResult[]> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const out: VerifyResult[] = [];
  let index = 0;
  let done = 0;

  async function worker() {
    while (index < unique.length) {
      const email = unique[index++];
      let result: VerifyResult;
      try {
        result = await verifyEmail(email);
      } catch (e) {
        result = { email, verdict: "unknown", detail: e instanceof Error ? e.message : "failed" };
      }
      out.push(result);
      done++;
      opts.onResult?.(result, done, unique.length);
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  return out;
}
