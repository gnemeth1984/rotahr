/**
 * Navigator photo/doc capture — the reading half.
 *
 * One button, no "what kind of thing is this?" question first. Asking someone
 * to classify a document before they can photograph it is exactly the friction
 * that stops the capture happening at all, so the model decides the kind and
 * pulls out only the fields that kind actually has.
 *
 * Three kinds that matter in practice:
 *   receipt   — vendor, total, date. READ ONLY. Money is on the red list, so
 *               this never becomes an Expense row on its own.
 *   note      — handwriting, a whiteboard, a napkin. Becomes tasks.
 *   document  — a letter from Revenue, a lease, an insurance renewal. The whole
 *               reason to photograph one of these is not losing the deadline.
 */

import OpenAI from "openai";

const VISION_MODEL = "gpt-4o-mini";

export type CaptureKind = "receipt" | "note" | "document" | "unknown";

export type CaptureTaskSuggestion = {
  title: string;
  notes?: string | null;
  effortMins?: number | null;
  /** YYYY-MM-DD */
  due?: string | null;
  priority?: "urgent" | "important" | "quickwin" | "later";
};

export type CaptureReading = {
  kind: CaptureKind;
  title: string;
  summary: string;
  rawText: string | null;
  vendor: string | null;
  total: number | null;
  currency: string | null;
  /** YYYY-MM-DD — the date printed on the thing, not today. */
  docDate: string | null;
  /** YYYY-MM-DD — the date something must happen by. */
  deadline: string | null;
  tasks: CaptureTaskSuggestion[];
  lineItems: { name: string; amount: number | null }[];
};

function prompt(todayKey: string): string {
  return `You are reading a photo someone snapped on their phone. Decide what it is, then extract only what that kind of thing actually has. Today is ${todayKey}.

Return ONLY valid JSON:
{
  "kind": "receipt" | "note" | "document" | "unknown",
  "title": "short label, max 60 chars, e.g. 'Tesco receipt EUR42.10' or 'Revenue letter - VAT return'",
  "summary": "2-3 plain sentences. What it is and what it means for them. No preamble.",
  "rawText": "all legible text, or null if there is none",
  "vendor": "receipts only: who was paid. null otherwise",
  "total": "receipts only: the final amount as a number, no currency symbol. null otherwise",
  "currency": "receipts only: EUR, GBP or USD. null otherwise",
  "docDate": "the date printed on the document, YYYY-MM-DD, or null. NEVER guess today's date",
  "deadline": "documents: the date something must be done by, YYYY-MM-DD, or null",
  "tasks": [{"title":"imperative, specific","notes":"optional","effortMins":15,"due":"YYYY-MM-DD or null","priority":"urgent|important|quickwin|later"}],
  "lineItems": [{"name":"string","amount":null}]
}

Rules:
- kind "note" is handwriting, a whiteboard, a list on paper, a screenshot of a thought. kind "document" is official or formal: letters, bills, contracts, licences, insurance, tax.
- For a note: every actionable line becomes one task. Keep their wording. Do not invent tasks they did not write. If a note is purely information, tasks is [].
- For a document: extract the deadline if one exists, and add ONE task for the action it demands (e.g. "File VAT return for Jul-Aug"), due on the deadline. If it demands nothing, tasks is [].
- For a receipt: tasks is ALWAYS []. A receipt is a record, not a job. lineItems only if the lines are clearly legible.
- Dates: only what is printed. A receipt that says "22/08" with no year is ${todayKey.slice(0, 4)}. Irish/UK format is DD/MM/YYYY, not MM/DD.
- If the photo is too blurry or dark to read, use kind "unknown", say so plainly in summary, and leave everything else null or empty.
- Never invent a figure, a date or a sender. null is always better than a guess.`;
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toDateKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  // Sanity window: a phone photo is not documenting the 1800s or the 2100s.
  const year = Number(m[1]);
  if (year < 2000 || year > 2100) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function str(v: unknown, max = 400): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function asKind(v: unknown): CaptureKind {
  return v === "receipt" || v === "note" || v === "document" ? v : "unknown";
}

/**
 * Read an image and return structured content.
 *
 * Throws on API failure — the caller has already stored the blob row, so a
 * throw marks that row failed rather than losing the photo.
 */
export async function readCapture(
  base64Image: string,
  mimeType: string,
  todayKey: string
): Promise<CaptureReading> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const res = await openai.chat.completions.create({
    model: VISION_MODEL,
    response_format: { type: "json_object" },
    temperature: 0,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt(todayKey) },
          {
            type: "image_url",
            // "high" detail: handwriting and the small print on an official
            // letter are unreadable at low detail, which is most of the value.
            image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" },
          },
        ],
      },
    ],
  });

  let data: any = {};
  try {
    data = JSON.parse(res.choices?.[0]?.message?.content ?? "{}");
  } catch {
    data = {};
  }

  const kind = asKind(data.kind);

  const rawTasks: CaptureTaskSuggestion[] = Array.isArray(data.tasks)
    ? data.tasks
        .map((t: any) => {
          const title = str(t?.title, 200);
          if (!title) return null;
          const priority =
            t?.priority === "urgent" || t?.priority === "quickwin" || t?.priority === "later"
              ? t.priority
              : "important";
          const effort = toNum(t?.effortMins);
          return {
            title,
            notes: str(t?.notes, 2000),
            effortMins: effort && effort > 0 ? Math.min(Math.round(effort), 600) : null,
            due: toDateKey(t?.due),
            priority,
          } as CaptureTaskSuggestion;
        })
        .filter(Boolean)
        .slice(0, 12) // a whiteboard photo must not turn into 40 tasks
    : [];

  return {
    kind,
    title: str(data.title, 120) ?? (kind === "unknown" ? "Unreadable capture" : "Capture"),
    summary: str(data.summary, 1200) ?? "",
    rawText: str(data.rawText, 12_000),
    // A receipt is the only kind that carries money fields; the model
    // occasionally fills them in on a document, which then reads like a bill.
    vendor: kind === "receipt" ? str(data.vendor, 160) : null,
    total: kind === "receipt" ? toNum(data.total) : null,
    currency: kind === "receipt" ? (str(data.currency, 3) ?? "EUR").toUpperCase() : null,
    docDate: toDateKey(data.docDate),
    deadline: toDateKey(data.deadline),
    // A receipt never generates work, whatever the model decided.
    tasks: kind === "receipt" ? [] : rawTasks,
    lineItems: Array.isArray(data.lineItems)
      ? data.lineItems
          .map((l: any) => {
            const name = str(l?.name, 160);
            return name ? { name, amount: toNum(l?.amount) } : null;
          })
          .filter(Boolean)
          .slice(0, 40)
      : [],
  };
}
