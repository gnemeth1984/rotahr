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
  from?: string;
  replyTo?: string;
  /** Label used in server logs to identify the sending feature. */
  context: string;
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

  try {
    const { data, error } = await resend.emails.send({
      from: args.from ?? DEFAULT_FROM,
      to: args.to,
      replyTo: args.replyTo ?? REPLY_TO,
      subject: args.subject,
      html: args.html,
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
