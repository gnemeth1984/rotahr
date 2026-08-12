import { Resend } from "resend";

/**
 * Central Resend wrapper.
 *
 * WHY THIS EXISTS
 * The Resend SDK does NOT throw on failure — it resolves with
 * `{ data: null, error: {...} }`. Verified against SDK 6.12.4:
 * an invalid send returned a 422 validation_error object and threw nothing.
 *
 * Every previous call site did a bare `await resend.emails.send(...)` and
 * ignored the result, so a rejected send (rate limit, quota, revoked key,
 * unverified sender) looked identical to a successful one. Password reset
 * returned `{ ok: true }` and told the user "check your email" when nothing
 * had been sent.
 *
 * Use `sendEmail` for mail where failure must be visible to the caller, and
 * `sendEmailQuiet` for fire-and-forget notifications that must never break
 * the surrounding request.
 */

// sales@rotahr.com is provisioned and accepting mail (verified by SMTP RCPT
// probe), so replies now reach the business inbox rather than a personal one.
// It is the only live mailbox on the domain - privacy@/legal@/hello@ resolve to
// it as well, so do not reintroduce those as distinct reply addresses.
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? "sales@rotahr.com";

// The From address must be a mailbox that actually exists. rotahr.com has
// exactly one - sales@ - so every outbound message sends from it. A From
// address nobody can reach (noreply@, no-reply@) silently swallows the
// bounce reports and out-of-office replies that receiving servers send back
// to it, and some filters score an unreachable From as suspicious.
const DEFAULT_FROM = process.env.EMAIL_FROM ?? "Rotahr <sales@rotahr.com>";

export interface SendResult {
  ok: boolean;
  id: string | null;
  error: string | null;
}

export interface SendArgs {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text alternative. Worth setting on one-to-one mail: a text/plain
   *  part improves both accessibility and spam scoring. */
  text?: string;
  from?: string;
  replyTo?: string;
  /** Extra RFC 5322 headers. Used to set In-Reply-To / References so a reply
   *  threads into the recipient's existing conversation instead of starting a
   *  new one. */
  headers?: Record<string, string>;
  /** Label used in server logs to identify the sending feature. */
  context: string;
}

/**
 * Addresses that provably cannot receive mail, dropped before Resend sees them.
 *
 * The demo seed gives every fake staff member a working-looking address on a
 * made-up domain — sarah.connolly@rotahr.demo, luke.flanagan@bloombistro.demo,
 * dan.kearns@cornercafe.demo, mark.doyle@harringtongroup.demo. `.demo` is not a
 * real TLD, so all of them hard-bounce, and the daily shift-reminder cron was
 * mailing every one of them: 25 bounces on 11 Aug, 14 on 10 Aug, every single
 * day, from the same domain that sends real listing invites and password
 * resets. Bounce rate is what mailbox providers use to decide whether the
 * domain is trustworthy, so demo data was quietly spending the reputation the
 * real outreach depends on.
 *
 * The check lives here, in the one function every feature sends through, rather
 * than in the cron that happened to be caught. isDemoEmail() in lib/demo/reset
 * only matches @rotahr.demo and would still have missed three of the four demo
 * businesses; this matches the whole shape of the problem instead.
 */
export function isUnroutableAddress(email: string): boolean {
  const addr = email.trim().toLowerCase();
  const domain = addr.split("@")[1];
  if (!domain) return true;
  // Reserved by RFC 2606 / RFC 6761 for documentation and testing — no MX, ever.
  const RESERVED = ["demo", "test", "example", "invalid", "localhost", "local", "internal"];
  const tld = domain.split(".").pop() ?? "";
  if (RESERVED.includes(tld)) return true;
  return ["example.com", "example.org", "example.net"].includes(domain);
}

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_placeholder") return null;
  return new Resend(key);
}

/**
 * Send an email and report the true outcome.
 * Never throws — inspect the returned `ok` / `error`.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    const error = "RESEND_API_KEY is not configured";
    console.error(`[email:${args.context}] ${error}`);
    return { ok: false, id: null, error };
  }

  /**
   * Filter unroutable recipients before the API call, not after.
   *
   * A send to a mix of real and demo addresses still counts every demo bounce
   * against the domain, so they are removed from the list rather than the send
   * being abandoned — one real recipient in a batch should still get their mail.
   */
  const recipients = (Array.isArray(args.to) ? args.to : [args.to]).filter(Boolean);
  const deliverable = recipients.filter((r) => !isUnroutableAddress(r));
  const dropped = recipients.length - deliverable.length;
  if (dropped > 0) {
    console.warn(
      `[email:${args.context}] skipped ${dropped} unroutable recipient(s): ` +
        recipients.filter((r) => isUnroutableAddress(r)).join(", ")
    );
  }
  if (deliverable.length === 0) {
    // Reported as ok: for demo data this is the correct outcome, and a caller
    // that treats it as failure would log noise or retry forever.
    return { ok: true, id: null, error: null };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: args.from ?? DEFAULT_FROM,
      to: deliverable,
      replyTo: args.replyTo ?? REPLY_TO,
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(args.headers ? { headers: args.headers } : {}),
    });

    if (error) {
      // error.message is the human-readable reason from the Resend API.
      const msg = (error as { message?: string }).message ?? JSON.stringify(error);
      console.error(`[email:${args.context}] send rejected:`, msg);
      return { ok: false, id: null, error: msg };
    }

    return { ok: true, id: data?.id ?? null, error: null };
  } catch (e: unknown) {
    // Network-level failure — the SDK can still throw on transport errors.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[email:${args.context}] send threw:`, msg);
    return { ok: false, id: null, error: msg };
  }
}

/**
 * Fire-and-forget send for non-critical notifications.
 * Logs failures but always resolves, so a mail outage can't break a request.
 */
export async function sendEmailQuiet(args: SendArgs): Promise<SendResult> {
  const res = await sendEmail(args);
  if (!res.ok) {
    console.warn(`[email:${args.context}] non-critical send failed, continuing`);
  }
  return res;
}
