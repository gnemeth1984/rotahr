/**
 * Navigator long-term memory.
 *
 * The chat only ever sees the last ~14 messages, which made the assistant
 * amnesiac: anything durable about the user had to be repeated every session.
 * This module gives it a persistent store that is written two ways —
 * explicitly by the model (the `remember` tool) and automatically by an
 * extraction pass after each turn — and read back as a compact prompt block.
 *
 * Retrieval is lexical, not vector-based, on purpose. This is one person's
 * memory: a few hundred rows, not a corpus. Token overlap plus pinning and
 * recency beats an embedding round-trip on latency, cost and dependencies, and
 * it stays debuggable — you can read the score and see why a row surfaced.
 * If this ever grows past a few thousand rows, swap scoreRow for pgvector.
 */
import { prisma } from "@/lib/db";
import OpenAI from "openai";

const MODEL = "gpt-4o-mini";

function client() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export const MEMORY_KINDS = ["fact", "preference", "person", "thread", "project"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export function asMemoryKind(raw: unknown): MemoryKind {
  return MEMORY_KINDS.includes(raw as MemoryKind) ? (raw as MemoryKind) : "fact";
}

export type MemoryRow = {
  id: string;
  kind: string;
  key: string;
  value: string;
  subject: string | null;
  pinned: boolean;
};

// Words too common to carry signal — they would match every row equally.
const STOP = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "am", "do", "does", "did", "doing", "have", "has", "had",
  "i", "me", "my", "mine", "myself", "you", "your", "it", "its", "we", "our", "they", "them",
  "to", "of", "in", "on", "at", "for", "with", "from", "by", "about", "as", "into", "over",
  "so", "just", "now", "not", "no", "yes", "can", "will", "would", "should", "could",
  "what", "when", "where", "who", "why", "how", "get", "got", "go", "going", "want", "need",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t.length > 2 && !STOP.has(t));
}

/** Collapse a key to a dedupe handle so "Coffee order" and "coffee  order" are one row. */
function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function scoreRow(
  row: { key: string; value: string; subject: string | null; pinned: boolean; useCount: number; updatedAt: Date },
  qTokens: Set<string>,
): number {
  const keyT = tokens(row.key);
  const valT = tokens(row.value);
  const subT = row.subject ? tokens(row.subject) : [];

  let score = 0;
  // The key and subject are the labels the user would actually say, so a hit
  // there is worth far more than a hit buried in a long value.
  for (const t of new Set(keyT)) if (qTokens.has(t)) score += 4;
  for (const t of new Set(subT)) if (qTokens.has(t)) score += 3;
  for (const t of new Set(valT)) if (qTokens.has(t)) score += 1;

  // Recency: full point this week, decaying to nothing over ~3 months.
  const ageDays = (Date.now() - row.updatedAt.getTime()) / 86_400_000;
  score += Math.max(0, 1 - ageDays / 90) * 2;

  // Mild feedback loop: what keeps getting used keeps surfacing.
  score += Math.min(row.useCount, 5) * 0.2;

  return score;
}

/**
 * Pull the memories worth putting in front of the model for this message.
 *
 * Pinned rows always come back — they are the standing facts the user chose to
 * keep in context. The rest are scored against the message and the top few
 * survive, so a long store never floods the prompt.
 */
export async function recallMemories(userId: string, query: string, limit = 14): Promise<MemoryRow[]> {
  const rows = await prisma.navMemory.findMany({
    where: { userId, forgotten: false },
    orderBy: { updatedAt: "desc" },
    // Bounded read: one person's store is small, and this keeps a runaway
    // extraction pass from turning recall into a full table scan.
    take: 400,
  });
  if (!rows.length) return [];

  const qTokens = new Set(tokens(query));
  const pinned = rows.filter((r) => r.pinned);
  const rest = rows.filter((r) => !r.pinned);

  const scored = rest
    .map((r) => ({ r, s: scoreRow(r, qTokens) }))
    // Below this the row is only matching on recency and adds noise, not context.
    .filter((x) => x.s >= 1.5)
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.max(0, limit - pinned.length))
    .map((x) => x.r);

  const chosen = [...pinned, ...scored];

  // Retrieval feedback, fire-and-forget: never let bookkeeping fail a chat turn.
  if (chosen.length) {
    prisma.navMemory
      .updateMany({
        where: { id: { in: chosen.map((c) => c.id) } },
        data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
      })
      .catch(() => {});
  }

  return chosen.map((r) => ({
    id: r.id,
    kind: r.kind,
    key: r.key,
    value: r.value,
    subject: r.subject,
    pinned: r.pinned,
  }));
}

/** Render recalled rows as a prompt block. Empty string when there is nothing. */
export function renderMemories(rows: MemoryRow[]): string {
  if (!rows.length) return "";
  const lines = rows.map((r) => {
    const who = r.subject ? ` (${r.subject})` : "";
    return `- [${r.kind}] ${r.key}${who}: ${r.value}`;
  });
  return `What you remember about this person (from previous conversations — use it naturally, never recite it back as a list):\n${lines.join("\n")}`;
}

/**
 * Write a memory, updating in place when the same key already exists.
 *
 * The update-not-insert rule is what stops the store contradicting itself: when
 * a preference changes, the old row must change with it rather than sit next to
 * the new one where retrieval could surface either.
 */
export async function saveMemory(
  userId: string,
  input: { kind?: unknown; key: string; value: string; subject?: string | null; source?: string; pinned?: boolean },
) {
  const key = input.key.trim().slice(0, 120);
  const value = input.value.trim().slice(0, 2000);
  if (!key || !value) return null;

  const kind = asMemoryKind(input.kind);
  const target = normKey(key);

  // Match on the normalised key within the same kind. Done in JS because the
  // normalisation (punctuation collapse) has no SQL equivalent we can index.
  const existing = (
    await prisma.navMemory.findMany({
      where: { userId, kind },
      select: { id: true, key: true, forgotten: true },
      take: 400,
    })
  ).find((r) => normKey(r.key) === target);

  if (existing) {
    return prisma.navMemory.update({
      where: { id: existing.id },
      data: {
        value,
        subject: input.subject?.trim() || null,
        source: input.source ?? "chat",
        // Re-stating something the user previously forgot revives it: the newer
        // instruction wins.
        forgotten: false,
        ...(input.pinned === undefined ? {} : { pinned: input.pinned }),
      },
    });
  }

  return prisma.navMemory.create({
    data: {
      userId,
      kind,
      key,
      value,
      subject: input.subject?.trim() || null,
      source: input.source ?? "chat",
      pinned: input.pinned ?? false,
    },
  });
}

/** Soft-forget by id or by key. Reversible on purpose — see the schema comment. */
export async function forgetMemory(userId: string, ref: { id?: string; key?: string }) {
  if (ref.id) {
    const r = await prisma.navMemory.updateMany({
      where: { id: ref.id, userId },
      data: { forgotten: true, pinned: false },
    });
    return r.count;
  }
  if (!ref.key) return 0;

  const target = normKey(ref.key);
  const rows = await prisma.navMemory.findMany({
    where: { userId, forgotten: false },
    select: { id: true, key: true },
    take: 400,
  });
  const hits = rows.filter((r) => normKey(r.key) === target).map((r) => r.id);
  if (!hits.length) return 0;

  const r = await prisma.navMemory.updateMany({
    where: { id: { in: hits }, userId },
    data: { forgotten: true, pinned: false },
  });
  return r.count;
}

// --------------------------------------------------------------------------
// Automatic extraction
// --------------------------------------------------------------------------

const EXTRACT_SYSTEM = `You extract durable long-term memories about ONE person from a conversation with their personal assistant.

Return JSON: {"memories":[{"kind":"fact|preference|person|thread|project","key":"short label","value":"the fact, one sentence","subject":"who/what it is about, or null"}]}

SAVE only things still true and useful weeks from now:
- stable facts about them (where they live, what they do, how they work)
- preferences and dislikes, especially ones that should change how you advise them
- people in their life, with the relationship
- ongoing projects or threads worth following up on
- commitments and deadlines that outlive today

NEVER save:
- transient state ("tired right now", "hungry", today's plan, today's mood)
- anything already obvious from their task/habit/meal data
- health, medical, diagnosis, medication or crisis details — skip these entirely, no exceptions
- speculation, or anything they did not actually say
- the assistant's own suggestions they did not agree to

Rules: max 4 memories per turn, and usually 0. An ordinary logistical exchange yields nothing — return {"memories":[]} rather than inventing something. Keys are short and reusable ("gym timing", "sister"), so a later update overwrites the same key. Values are one plain sentence.`;

/**
 * Look at one completed turn and store anything durable.
 *
 * Awaited by the caller rather than fired into the void: on Vercel the function
 * is frozen once the response is sent, so a floating promise here would be
 * killed roughly half the time and memory would silently stop working.
 */
export async function extractMemories(userId: string, userText: string, assistantText: string): Promise<number> {
  // Not worth a model call on "ok" / "thanks" / "yes".
  if (userText.trim().length < 12) return 0;

  try {
    const res = await client().chat.completions.create({
      model: MODEL,
      temperature: 0,
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        {
          role: "user",
          content: `They said:\n${userText.slice(0, 3000)}\n\nAssistant replied:\n${assistantText.slice(0, 1500)}`,
        },
      ],
    });

    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    const list = Array.isArray(parsed?.memories) ? parsed.memories.slice(0, 4) : [];

    let saved = 0;
    for (const m of list) {
      if (!m?.key || !m?.value) continue;
      const row = await saveMemory(userId, {
        kind: m.kind,
        key: String(m.key),
        value: String(m.value),
        subject: m.subject ? String(m.subject) : null,
        source: "auto",
      });
      if (row) saved++;
    }
    return saved;
  } catch {
    // Memory is an enhancement — a failed extraction must never break the chat.
    return 0;
  }
}
