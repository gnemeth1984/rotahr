/**
 * Read-only IMAP access to the sales@rotahr.com mailbox.
 *
 * WHY IMAP AND NOT AN INBOUND WEBHOOK
 * Routing inbound mail to a webhook means pointing rotahr.com's MX records at a
 * parsing service. The domain has exactly one real mailbox and it is the address
 * printed on the privacy policy, the terms, and every outbound email — breaking
 * its delivery to gain a webhook would be a bad trade. IMAP reads the same
 * mailbox without touching DNS, so the mailbox keeps working exactly as it does
 * in a normal mail client.
 *
 * Nothing here mutates the mailbox: messages are fetched without setting \Seen,
 * so mail still looks unread in the normal client and the assistant is purely an
 * observer. That also means a failed sync is always safe to retry.
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const HOST = process.env.INBOX_IMAP_HOST || "mail.privateemail.com";
const PORT = Number(process.env.INBOX_IMAP_PORT || 993);
const USER = process.env.INBOX_IMAP_USER || "sales@rotahr.com";
// Trim whitespace and any stray surrounding quotes — a password pasted into an
// env UI with quotes authenticates locally (dotenv strips them) but fails in
// production, which is a miserable thing to debug.
const PASS = (process.env.INBOX_IMAP_PASSWORD || "")
  .trim()
  .replace(/^['"]|['"]$/g, "");

export interface FetchedMessage {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  references: string | null;
  fromEmail: string;
  fromName: string | null;
  toEmail: string | null;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  isAutomated: boolean;
}

export function imapConfigured(): boolean {
  return Boolean(PASS);
}

/**
 * Bounces, vacation autoresponders and other machine mail must be recognised
 * before anything tries to answer them: replying to an autoresponder invites a
 * loop where each side answers the other forever, and replying to a bounce
 * address does nothing except add spam signal.
 *
 * The headers are the reliable signal (RFC 3834 Auto-Submitted, the widely
 * honoured Precedence: bulk/auto_reply, and List-* for mailing lists). Subject
 * matching is a fallback for senders that set no headers at all.
 */
export function detectAutomated(headers: Map<string, unknown>, subject: string, fromEmail: string): boolean {
  const get = (k: string) => String(headers.get(k) ?? "").toLowerCase();

  const autoSubmitted = get("auto-submitted");
  if (autoSubmitted && autoSubmitted !== "no") return true;

  const precedence = get("precedence");
  if (["bulk", "auto_reply", "junk", "list"].includes(precedence)) return true;

  if (get("x-autoreply") || get("x-autorespond") || get("x-auto-response-suppress")) return true;
  if (headers.has("list-unsubscribe") || headers.has("list-id")) return true;

  const from = fromEmail.toLowerCase();
  if (
    from.startsWith("mailer-daemon@") ||
    from.startsWith("postmaster@") ||
    from.startsWith("no-reply@") ||
    from.startsWith("noreply@") ||
    from.startsWith("bounce") ||
    from.includes("@bounce")
  ) {
    return true;
  }

  const s = subject.toLowerCase();
  const subjectSignals = [
    "out of office",
    "automatic reply",
    "auto-reply",
    "autoreply",
    "undeliverable",
    "delivery status notification",
    "returned mail",
    "mail delivery failed",
    "delivery has failed",
    "message blocked",
  ];
  return subjectSignals.some((sig) => s.includes(sig));
}

/** Strip quoted history so the model reasons about what this person just wrote. */
export function stripQuotedReply(text: string): string {
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) break;
    if (/^\s*-{2,}\s*original message\s*-{2,}/i.test(line)) break;
    if (/^\s*On .+ wrote:\s*$/i.test(line)) break;
    if (/^\s*From:\s.+/i.test(line) && out.length > 3) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Fetch messages with a UID above `sinceUid`.
 *
 * IMAP UIDs only ever increase within a mailbox, so the highest UID already
 * stored is a safe cursor. `limit` caps a single run: the first sync of a
 * mailbox with years of history must not try to classify everything at once and
 * time out the function, so it walks forward a page at a time.
 */
export async function fetchNewMessages(sinceUid: number, limit = 25): Promise<FetchedMessage[]> {
  if (!PASS) throw new Error("INBOX_IMAP_PASSWORD is not set");

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });

  const results: FetchedMessage[] = [];
  await client.connect();

  try {
    // Read-only: opening with readOnly means the server will not set \Seen on
    // anything we touch, so the human view of the mailbox is untouched.
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      const range = `${sinceUid + 1}:*`;
      for await (const msg of client.fetch(
        { uid: range },
        { uid: true, envelope: true, source: true, headers: true },
        { uid: true }
      )) {
        // A `n:*` range always returns at least one message even when nothing is
        // above n, so anything at or below the cursor is discarded explicitly.
        if (!msg.uid || msg.uid <= sinceUid) continue;
        if (results.length >= limit) break;

        const parsed = await simpleParser(msg.source as Buffer);

        const fromAddr = parsed.from?.value?.[0];
        const fromEmail = (fromAddr?.address || "").toLowerCase();
        if (!fromEmail) continue;

        const subject = parsed.subject || "(no subject)";
        const rawText = parsed.text || stripHtml(parsed.html || "") || "";

        results.push({
          uid: msg.uid,
          messageId: parsed.messageId || null,
          inReplyTo: parsed.inReplyTo || null,
          references: Array.isArray(parsed.references)
            ? parsed.references.join(" ")
            : parsed.references || null,
          fromEmail,
          fromName: fromAddr?.name || null,
          toEmail:
            (Array.isArray(parsed.to) ? parsed.to[0]?.value?.[0]?.address : parsed.to?.value?.[0]?.address) ||
            null,
          subject,
          bodyText: stripQuotedReply(rawText).slice(0, 8000),
          receivedAt: parsed.date || new Date(),
          isAutomated: detectAutomated(parsed.headers as Map<string, unknown>, subject, fromEmail),
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {
      /* the connection is being torn down anyway */
    });
  }

  return results;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Verify credentials and reachability without importing any mail. */
export async function testConnection(): Promise<{ ok: boolean; error?: string; total?: number }> {
  if (!PASS) return { ok: false, error: "INBOX_IMAP_PASSWORD is not set" };
  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
  });
  try {
    await client.connect();
    const box = await client.mailboxOpen("INBOX", { readOnly: true });
    const total = box.exists;
    await client.logout();
    return { ok: true, total };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
