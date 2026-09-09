/**
 * Polish an email that Gabor typed himself.
 *
 * WHAT THIS IS NOT
 * `assistant.ts` writes a reply from scratch by reading an inbound email. This
 * module does the opposite job: the human has already written the reply, and
 * the model's only permitted contribution is to express those same words
 * better. The two must not be confused in the UI either, which is why the
 * existing button is labelled "Redraft from their email" and these are "Fix"
 * and "Rewrite".
 *
 * THE ONE RULE THAT MATTERS
 * The model may not introduce content. Not a price, not a date, not a feature,
 * not a link, not a commitment, not a friendly "we'd be happy to set up a call".
 * A rewrite that helpfully adds "and your first month is free" to an email where
 * Gabor never offered it is not a better email, it is a false statement sent to
 * a customer under his name.
 *
 * Prompt rules are probabilistic, so the important ones are enforced again in
 * code after the call:
 *   - every URL in the output must appear verbatim in his input
 *   - every currency amount in the output must appear in his input
 * Anything that fails is reported to the caller and the polish is refused. The
 * failure mode here is "Gabor sends what he originally typed", which is always
 * safe, rather than "Gabor sends a fluent invention".
 *
 * Nothing here sends. Polishing writes into a textarea he still has to read.
 */

import OpenAI from "openai";

const MODEL = process.env.INBOX_AI_MODEL || "gpt-4o-mini";

export type PolishMode = "fix" | "rewrite";

export interface PolishResult {
  text: string;
  mode: PolishMode;
  model: string;
  /** Populated when a deterministic check failed. The caller must not use `text`. */
  refused: string | null;
}

function client(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey: key });
}

/**
 * Shared constraints. Written as prohibitions rather than aspirations because
 * "keep it accurate" is not an instruction a model can act on, and "do not add
 * a number that is not already there" is.
 */
const COMMON = `
You are editing an email written by the founder of Rotahr, a hospitality
operations company. He has already decided what to say. Your job is only to make
his own words read better. You are a copy editor, not a co-author.

ABSOLUTE PROHIBITIONS
- Do not add any fact, number, price, percentage, date, deadline, feature name,
  product claim, statistic or company detail that is not already in his text.
- Do not add any URL, email address or phone number that is not already in his
  text. Not even an obvious one like the company's own website.
- Do not add any commitment, offer, discount, trial, meeting, call or promise
  that he did not already make.
- Do not soften or drop a commitment, a question, a deadline or a "no" that he
  did make. If he declined something, the edit still declines it.
- Do not add a greeting or a sign-off if he did not write one.
- Do not add a signature block. One is appended automatically when the mail is
  sent, so a signature here would be duplicated.
- Do not add pleasantries he did not write: no "I hope this email finds you
  well", no "Thanks so much for reaching out!", no "Feel free to reach out with
  any questions at all".
- No emoji. No exclamation marks unless he used them. No markdown, no bold, no
  bullet characters unless he used them. Plain text only.
- If the text contains a marker in square brackets such as [NEEDS GABOR: ...],
  reproduce it exactly and untouched. It is a deliberate gap.

VOICE
Plain, direct, warm but not gushing. Short paragraphs. The way a competent
person writes to one other person. If a sentence would sound odd said out loud
in a kitchen, it is wrong.

Return ONLY the edited email body as plain text. No preamble, no explanation, no
quotation marks around it, no "Here is the revised version".
`.trim();

const FIX = `
${COMMON}

MODE: FIX
Correct spelling, grammar, punctuation, capitalisation and obvious typos.
Nothing else.

Keep his words. Keep his sentence order. Keep his paragraph breaks. Keep his
phrasing even where you would have phrased it differently. Do not tighten, do
not restructure, do not "improve the flow", do not replace a plain word with a
smarter one. If a sentence is clumsy but correct and clear, leave it clumsy.

If the text is already correct, return it completely unchanged.
`.trim();

const REWRITE = `
${COMMON}

MODE: REWRITE
Rewrite his draft as a clean, well-structured email that says exactly the same
things.

You may reorder points into a sensible order, merge or split paragraphs, cut
repetition, and replace vague phrasing with clearer phrasing. Lead with the
actual answer or the actual ask, then the detail.

Every fact, offer, question and commitment in your version must trace back to
something in his version. If he was vague about something, stay vague about it
rather than inventing the specifics that would make it read better. Being less
specific than the model would like is not a defect.

Aim for a similar length. Do not pad. If his draft was three sentences, the
right answer is usually three better sentences, not a page.
`.trim();

export interface PolishInput {
  /** What Gabor typed. The only source of permitted content. */
  text: string;
  mode: PolishMode;
  /** The message being replied to. Context for tone and pronouns only, never a
   *  source of new facts. Safe to omit. */
  context?: {
    fromName?: string | null;
    fromEmail?: string;
    subject?: string;
    bodyText?: string;
  } | null;
}

/** Every http(s) URL and bare domain, lowercased, trailing punctuation removed. */
function urlsIn(s: string): string[] {
  const out = new Set<string>();
  const re = /\b(?:https?:\/\/|www\.)[^\s<>()[\]"']+/gi;
  for (const m of s.matchAll(re)) {
    out.add(m[0].toLowerCase().replace(/[.,;:!?)\]]+$/, ""));
  }
  return [...out];
}

/** Currency amounts in the five currencies Rotahr actually supports, plus bare percentages. */
function moneyIn(s: string): string[] {
  const out = new Set<string>();
  // Both orders: "EUR 49" and "49 EUR". Missing the first one let an invented
  // price straight through in testing.
  const re =
    /(?:[€$£]\s?\d[\d,.]*|\b(?:EUR|GBP|USD|CAD|AUD)\s?\d[\d,.]*|\b\d[\d,.]*\s?(?:EUR|GBP|USD|CAD|AUD)\b|\b\d[\d.]*\s?%)/gi;
  for (const m of s.matchAll(re)) {
    out.add(m[0].toLowerCase().replace(/\s+/g, ""));
  }
  return [...out];
}

export async function polishEmail(input: PolishInput): Promise<PolishResult> {
  const original = (input.text || "").trim();
  if (!original) throw new Error("Nothing to polish");
  // A whole-email rewrite is a slow call on a long thread and the model gets
  // worse, not better, past this length. Refusing is clearer than truncating,
  // which would silently delete the end of his email.
  if (original.length > 12000) throw new Error("Draft is too long to polish");

  const openai = client();
  const system = input.mode === "fix" ? FIX : REWRITE;

  const parts: string[] = [];
  if (input.context?.bodyText) {
    parts.push(
      "CONTEXT ONLY - this is the message he is replying to. Use it to understand",
      "who he is writing to and what they asked. You may NOT take any fact from",
      "it into the reply. Do not answer it yourself.",
      "---",
      `From: ${input.context.fromName || input.context.fromEmail || "unknown"}`,
      `Subject: ${input.context.subject || "(none)"}`,
      "",
      input.context.bodyText.slice(0, 4000),
      "---",
      "",
    );
  }
  parts.push("HIS DRAFT - edit this:", "---", original);

  const res = await openai.chat.completions.create({
    model: MODEL,
    // Low, and lower still for FIX: this is a correctness task, and creativity
    // is the exact failure being guarded against.
    temperature: input.mode === "fix" ? 0 : 0.3,
    messages: [
      { role: "system", content: system },
      { role: "user", content: parts.join("\n") },
    ],
  });

  let text = (res.choices[0]?.message?.content || "").trim();
  if (!text) throw new Error("The model returned nothing");

  // Models wrap output in fences or quotes despite being told not to.
  text = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .trim();

  // Deterministic guards. These are the rules that must hold even when the
  // prompt fails, so they are checked rather than requested.
  const addedUrls = urlsIn(text).filter((u) => !urlsIn(original).includes(u));
  const addedMoney = moneyIn(text).filter((m) => !moneyIn(original).includes(m));

  if (addedUrls.length || addedMoney.length) {
    const bits = [
      addedUrls.length ? `link${addedUrls.length > 1 ? "s" : ""} ${addedUrls.join(", ")}` : "",
      addedMoney.length ? `figure${addedMoney.length > 1 ? "s" : ""} ${addedMoney.join(", ")}` : "",
    ].filter(Boolean);
    return {
      text: original,
      mode: input.mode,
      model: MODEL,
      refused: `Rewrite discarded - it added ${bits.join(" and ")} that you did not write. Your draft is unchanged.`,
    };
  }

  return { text, mode: input.mode, model: MODEL, refused: null };
}
