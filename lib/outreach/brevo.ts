import { unsubscribeUrl } from "@/lib/email/suppression";

/**
 * Brevo transactional-email client for cold outreach only.
 *
 * Deliberately separate from `lib/email/send.ts` (Resend), which handles
 * transactional mail to customers — booking confirmations, time-off decisions.
 * Cold outreach and customer mail must not share a sending reputation: a spam
 * complaint from a stranger should never push a paying customer's booking
 * confirmation into their junk folder.
 */

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

const FROM_EMAIL = process.env.OUTREACH_FROM_EMAIL || "sales@rotahr.com";
const FROM_NAME = process.env.OUTREACH_FROM_NAME || "Gabor at Rotahr";
const UNSUB_MAILBOX = process.env.UNSUB_MAILBOX || "privacy@rotahr.com";

export type SendResult =
  | { ok: true; messageId: string | null }
  | { ok: false; error: string; status?: number; hardBounce: boolean };

/** Brevo rejections that mean "never retry this address". */
function isPermanentRejection(status: number, message: string): boolean {
  if (status === 400 && /invalid.*email|not valid|blacklist|blocked|unsubscribed/i.test(message)) {
    return true;
  }
  return false;
}

export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY);
}

export function outreachFromEmail(): string {
  return FROM_EMAIL;
}

export type DomainAuthStatus = {
  domain: string;
  authenticated: boolean;
  /** Missing DNS records, ready to paste into the DNS provider. */
  missing: { host: string; type: string; value: string }[];
  error?: string;
};

/**
 * Checks whether the sending domain is actually authenticated at Brevo.
 *
 * This matters more than it looks. Brevo will happily accept and send mail
 * "from" a domain it has never verified, so the send reports success while the
 * message arrives with no DKIM signature and an SPF record that does not list
 * Brevo. Mailbox providers junk exactly that, and the domain being burned here
 * is the same one that sends every customer their booking confirmations.
 *
 * Verified against the live account: rotahr.com returned authenticated:false
 * and a test send still came back 201. A 201 therefore proves nothing about
 * whether the mail can land, which is why a real batch checks this first.
 */
export async function checkSenderDomain(): Promise<DomainAuthStatus> {
  const domain = FROM_EMAIL.split("@")[1] ?? "";
  const apiKey = process.env.BREVO_API_KEY;
  const base: DomainAuthStatus = { domain, authenticated: false, missing: [] };
  if (!apiKey) return { ...base, error: "BREVO_API_KEY is not set" };

  try {
    const resp = await fetch(
      `https://api.brevo.com/v3/senders/domains/${encodeURIComponent(domain)}`,
      { headers: { "api-key": apiKey, Accept: "application/json" } }
    );
    const data = (await resp.json()) as {
      authenticated?: boolean;
      message?: string;
      dns_records?: Record<
        string,
        { type?: string; value?: string; host_name?: string; status?: boolean } | null
      >;
    };
    if (!resp.ok) return { ...base, error: data?.message ?? `HTTP ${resp.status}` };

    const missing = Object.values(data.dns_records ?? {})
      .filter(
        (r): r is { type: string; value: string; host_name: string; status: boolean } =>
          Boolean(r && r.status === false && r.host_name && r.value && r.type)
      )
      .map((r) => ({ host: r.host_name, type: r.type, value: r.value }));

    return { domain, authenticated: Boolean(data.authenticated), missing };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendOutreachEmail(opts: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  tags?: string[];
}): Promise<SendResult> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "BREVO_API_KEY is not set", hardBounce: false };
  }

  // List-Unsubscribe + List-Unsubscribe-Post (RFC 8058) put a native
  // "Unsubscribe" button in Gmail and Outlook. Gmail expects these on bulk mail
  // and treats their absence as a spam signal, so this is deliverability as
  // much as compliance.
  const unsub = unsubscribeUrl(opts.to);

  const payload = {
    sender: { email: FROM_EMAIL, name: FROM_NAME },
    to: [{ email: opts.to, name: opts.toName || opts.to }],
    subject: opts.subject,
    htmlContent: opts.html,
    tags: opts.tags,
    headers: {
      "List-Unsubscribe": `<${unsub}>, <mailto:${UNSUB_MAILBOX}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await resp.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    if (!resp.ok) {
      const message =
        (data as { message?: string } | null)?.message ?? text ?? `HTTP ${resp.status}`;
      return {
        ok: false,
        error: message,
        status: resp.status,
        hardBounce: isPermanentRejection(resp.status, message),
      };
    }

    const messageId = (data as { messageId?: string } | null)?.messageId ?? null;
    return { ok: true, messageId };
  } catch (e) {
    // Timeouts and network errors are transient — the lead stays eligible.
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      hardBounce: false,
    };
  }
}

/** Verifies the key works without sending anything. */
export async function checkBrevoAccount(): Promise<
  { ok: true; email: string; plan: string } | { ok: false; error: string }
> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: "BREVO_API_KEY is not set" };
  try {
    const resp = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": apiKey, Accept: "application/json" },
    });
    const data = (await resp.json()) as {
      email?: string;
      message?: string;
      plan?: { type?: string; creditsType?: string; credits?: number }[];
    };
    if (!resp.ok) return { ok: false, error: data?.message ?? `HTTP ${resp.status}` };
    const p = data.plan?.[0];
    return {
      ok: true,
      email: data.email ?? "unknown",
      plan: p ? `${p.type ?? ""} ${p.credits ?? ""} ${p.creditsType ?? ""}`.trim() : "unknown",
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
