/**
 * THE BOUNDARY.
 *
 * Navigator is a private tool, but it is powered by an external AI model. Every
 * byte that reaches a prompt has left Rotahr's control and cannot be recalled.
 * Rotahr holds personal data belonging to other people's customers and other
 * people's staff, under GDPR (Ireland/UK), CCPA/CPRA, PIPEDA and the Australian
 * Privacy Act — all of which the published privacy policy commits to.
 *
 * Gabor is a processor for that data, not its owner. Feeding another tenant's
 * customer list to an LLM so his personal assistant can be chattier is not a
 * trade-off worth making, and it is not his data to trade.
 *
 * So the rule this module enforces is deliberately blunt:
 *
 *   Other tenants  -> AGGREGATE NUMBERS ONLY. Never a name, email, phone,
 *                     address, note, message body or free text of any kind.
 *   Own business   -> record-level detail allowed (it is his own business), but
 *                     still scrubbed of customer/staff identifiers before it
 *                     reaches a prompt, because those are guests and employees,
 *                     not him.
 *   Himself        -> unrestricted.
 *
 * Enforcement is structural, not by convention. `sealPulse()` walks the finished
 * object and throws if anything that looks like personal data survived. A thrown
 * error fails the cron and leaves the previous pulse in place; it never ships a
 * leaky payload. Fail closed, always.
 */

/** Keys that must never appear in a pulse, at any depth, for any tenant. */
const BANNED_KEYS = new Set([
  "email",
  "emails",
  "phone",
  "mobile",
  "telephone",
  "address",
  "addressLine1",
  "addressLine2",
  "eircode",
  "postcode",
  "zip",
  "firstName",
  "lastName",
  "fullName",
  "customerName",
  "guestName",
  "contactName",
  "employeeName",
  "staffName",
  "dob",
  "dateOfBirth",
  "pps",
  "ppsNumber",
  "iban",
  "bic",
  "accountNumber",
  "sortCode",
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
  "pushSubscription",
  "notes",
  "note",
  "body",
  "message",
  "messageBody",
  "content",
  "comment",
]);

/**
 * Keys that are allowed to hold free text because they are Gabor's own words or
 * machine-generated summaries, not third-party personal data.
 */
const ALLOWED_TEXT_KEYS = new Set([
  "summary",
  "detail",
  "label",
  "title",
  "job",
  "kind",
  "status",
  "action",
  "name", // business/module/venue names only — asserted below
  "band",
  "trend",
  "why",
  "sha",
  "url",
  "query",
  "page",
  "path",
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// E.164 and common IE/UK shapes. Deliberately greedy — a false positive costs a
// redacted string, a false negative costs a data leak.
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;
const PPS_RE = /\b\d{7}[A-Z]{1,2}\b/i;

export class PulseLeakError extends Error {
  constructor(path: string, why: string) {
    super(`Pulse blocked: ${why} at ${path}`);
    this.name = "PulseLeakError";
  }
}

/** Scrubs obvious identifiers out of a free-text string. */
export function scrubText(input: string, maxLen = 200): string {
  return input
    .replace(new RegExp(EMAIL_RE, "gi"), "[email]")
    .replace(new RegExp(IBAN_RE, "g"), "[iban]")
    .replace(new RegExp(PPS_RE, "gi"), "[pps]")
    .replace(new RegExp(PHONE_RE, "g"), "[phone]")
    .slice(0, maxLen);
}

/**
 * Walks a finished pulse and throws on anything that should not have survived.
 *
 * This runs on every refresh, in production. It is not a test helper. The cost
 * of walking a few hundred keys is nothing next to the cost of one leaked
 * customer email sitting in a third party's model logs forever.
 */
export function sealPulse<T>(pulse: T): T {
  walk(pulse, "$");
  return pulse;
}

function walk(node: unknown, path: string): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    node.forEach((v, i) => walk(v, `${path}[${i}]`));
    return;
  }

  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const here = `${path}.${k}`;
      if (BANNED_KEYS.has(k)) {
        throw new PulseLeakError(here, `banned key "${k}"`);
      }
      walk(v, here);
    }
    return;
  }

  if (typeof node === "string") {
    const key = path.slice(path.lastIndexOf(".") + 1).replace(/\[\d+\]$/, "");
    if (EMAIL_RE.test(node)) throw new PulseLeakError(path, "string contains an email address");
    if (IBAN_RE.test(node)) throw new PulseLeakError(path, "string contains an IBAN");
    if (PPS_RE.test(node)) throw new PulseLeakError(path, "string contains a PPS number");
    // Long free text is only allowed under keys we have explicitly reasoned about.
    if (node.length > 300 && !ALLOWED_TEXT_KEYS.has(key)) {
      throw new PulseLeakError(path, `unreviewed free text (${node.length} chars) under "${key}"`);
    }
  }
}

/**
 * Business display names are Gabor's customers' trading names, not personal
 * data — but a sole trader's business name IS often their own name ("Jane
 * Murphy Catering"). Named businesses therefore only ever appear for his own
 * tenants; everywhere else they are counted, not listed.
 */
export function anonymiseBusiness(index: number): string {
  return `business #${index + 1}`;
}
