/**
 * Classify an inbound message and draft a reply.
 *
 * DESIGN
 * One model call does both. Classification and drafting need exactly the same
 * context, and splitting them doubles the cost and latency to produce a
 * classification the drafting call would only re-derive.
 *
 * The model returns strict JSON. Anything it cannot parse is treated as a
 * failure that escalates to a human rather than a reply that gets sent — the
 * failure mode of this system has to be "Gabor writes it himself", never
 * "a confident wrong answer reaches a customer".
 *
 * Replies are drafted, never sent, by this module. Sending is a separate,
 * explicit, human-triggered action.
 */

import OpenAI from "openai";
import { KNOWLEDGE, ESCALATION_RULES } from "./knowledge";

const MODEL = process.env.INBOX_AI_MODEL || "gpt-4o-mini";
const SIGNOFF = process.env.INBOX_SIGNOFF || "The Rotahr Team";

export type Category =
  | "sales"
  | "outreach-reply"
  | "partner"
  | "support"
  | "billing"
  | "press"
  | "spam"
  | "other";

export const CATEGORIES: Category[] = [
  "sales",
  "outreach-reply",
  "partner",
  "support",
  "billing",
  "press",
  "spam",
  "other",
];

export interface Analysis {
  category: Category;
  intent: string;
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  language: string;
  needsHuman: boolean;
  escalationReason: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  model: string;
}

const SYSTEM = `
You are the inbox assistant for Rotahr, a hospitality operations SaaS. You read
an email sent to sales@rotahr.com and produce (a) a classification and (b) a
draft reply for a human to review.

You are drafting on behalf of a small, credible company. Write the way a
competent founder writes: plain, direct, warm but not gushing. No marketing
voice, no exclamation marks, no "I hope this email finds you well", no emoji,
no bullet-point brochures unless the sender asked a list-shaped question.
Short paragraphs. Typically 60-140 words. Answer the actual question first.

HARD RULES
- Never state a fact that is not in the KNOWLEDGE block. No invented features,
  dates, integrations, customer names, counts or prices.
- Never promise a timeline, a discount, a custom build, a call, or anything that
  commits the company.
- Never claim a person has already done something ("I've checked your account").
  You have no account access.
- If the sender wrote in a language other than English, draft the reply in that
  same language and set language accordingly.
- Sign off exactly as: ${SIGNOFF}
- Do not invent a personal name or a job title.
- Never include an unsubscribe line; this is a one-to-one reply, not marketing.
- Output plain text only. No HTML, no markdown formatting.

${ESCALATION_RULES}

ALWAYS write your best real attempt at the reply, including when needsHuman is
true. Nothing you write is ever sent automatically — a human reads and approves
every draft before it goes out — so a blank or evasive draft costs the reviewer
work and protects nobody. A flagged draft is a starting point they edit, not a
liability.

When needsHuman is true:
- Still answer everything you CAN answer from the KNOWLEDGE block.
- For the part you cannot answer or must not commit to (a price you were not
  given, a legal or GDPR question, a refund, a promise), do not guess and do not
  stall the whole reply. Say plainly that a person will confirm that specific
  point, then continue with what you do know.
- Where you are missing a fact the reviewer must supply, mark the exact spot
  inline as [NEEDS GABOR: what is missing] so it is impossible to send by
  accident without noticing.
Set escalationReason to what specifically needs the human, not a generic note.

If the message is spam, a vendor cold pitch, or a machine-generated
notification, set category accordingly, needsHuman false, and draftBody null.
There is nothing to say to those.

KNOWLEDGE (the only facts you may assert):
${KNOWLEDGE}

Return ONLY a JSON object with exactly these keys:
{
  "category": "sales|outreach-reply|partner|support|billing|press|spam|other",
  "intent": "one sentence on what this person actually wants",
  "sentiment": "positive|neutral|negative",
  "confidence": 0.0-1.0,
  "language": "ISO 639-1 code, e.g. en",
  "needsHuman": true|false,
  "escalationReason": "short reason, or null",
  "draftSubject": "reply subject, or null",
  "draftBody": "the plain-text reply, or null"
}
`.trim();

function client(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

export interface AnalyseInput {
  fromEmail: string;
  fromName?: string | null;
  subject: string;
  bodyText: string;
  /** Set when this address is a known cold-outreach lead, which changes the read
   *  of a terse reply: "not interested" to a stranger's pitch is normal, not a
   *  support problem. */
  isOutreachLead?: boolean;
}

export async function analyseEmail(input: AnalyseInput): Promise<Analysis> {
  const openai = client();

  const context = [
    `From: ${input.fromName ? `${input.fromName} <${input.fromEmail}>` : input.fromEmail}`,
    input.isOutreachLead
      ? "NOTE: this address is on Rotahr's cold outreach list, so this is most likely a reply to a cold email we sent them."
      : "",
    `Subject: ${input.subject}`,
    "",
    input.bodyText || "(empty body)",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: context },
    ],
  });

  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error("model returned an empty response");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("model returned unparseable JSON");
  }

  const category = CATEGORIES.includes(parsed.category as Category)
    ? (parsed.category as Category)
    : "other";

  const confidence =
    typeof parsed.confidence === "number" && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : 0;

  // Belt and braces on the model's own judgement. Two independent things force a
  // human: the model saying so, and the model not being sure. A confident-
  // sounding draft built on low confidence is exactly what must not be sent, and
  // the model is not a reliable judge of when to flag itself.
  const MIN_CONFIDENCE = Number(process.env.INBOX_MIN_CONFIDENCE || 0.6);
  const lowConfidence = confidence < MIN_CONFIDENCE;
  const needsHuman = Boolean(parsed.needsHuman) || lowConfidence;

  const escalationReason =
    typeof parsed.escalationReason === "string" && parsed.escalationReason.trim()
      ? parsed.escalationReason.trim()
      : lowConfidence
        ? `Low model confidence (${confidence.toFixed(2)})`
        : null;

  return {
    category,
    intent: str(parsed.intent) || "unclear",
    sentiment: (["positive", "neutral", "negative"] as const).includes(parsed.sentiment as never)
      ? (parsed.sentiment as Analysis["sentiment"])
      : "neutral",
    confidence,
    language: str(parsed.language) || "en",
    needsHuman,
    escalationReason,
    draftSubject: str(parsed.draftSubject) || null,
    draftBody: str(parsed.draftBody) || null,
    model: MODEL,
  };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Prefix a subject with Re: unless it already carries one. */
export function replySubject(original: string, drafted: string | null): string {
  const base = drafted || original;
  return /^re:/i.test(base) ? base : `Re: ${base.replace(/^(re|fwd):\s*/i, "")}`;
}
