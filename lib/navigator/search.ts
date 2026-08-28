import { prisma } from "@/lib/db";
import { tokens } from "./memory";

/**
 * One search across every Navigator surface.
 *
 * Navigator grew a tab per concern — tasks, captures, memory, chat — and each
 * one only ever looked at its own table. That is fine while you remember which
 * tab a thing landed in, and useless the moment you don't: a receipt you
 * photographed, the task it created, and the chat message where you first
 * mentioned it are three separate searches in three places today.
 *
 * The ranking is lexical, matching lib/navigator/memory.ts deliberately. There
 * are no embeddings here and that is a choice, not a shortcut: the store is one
 * person's own words, the queries are things he already knows he wrote, and an
 * embedding round-trip would add an API call and a cost to every keystroke for
 * recall he does not need. It also means search keeps working when OpenAI is
 * down.
 */

export type SearchSource = "task" | "capture" | "memory" | "chat";

/** Which Navigator tab a hit should send you to when you tap it. */
const TAB_FOR: Record<SearchSource, string> = {
  task: "tasks",
  capture: "capture",
  memory: "setup",
  chat: "chat",
};

export type SearchHit = {
  id: string;
  source: SearchSource;
  tab: string;
  title: string;
  /** Short body extract, already trimmed around the first match. */
  snippet: string | null;
  /** Small right-hand label: project, kind, status. */
  meta: string | null;
  /** Extra flags worth seeing in a result row, e.g. "draft", "archived". */
  flags: string[];
  when: string;
  score: number;
};

/** Cap the token count so a pasted paragraph cannot build a 400-clause query. */
const MAX_TOKENS = 8;
/** How many candidate rows we pull per surface before scoring. */
const CANDIDATES = 60;

function queryTokens(q: string): string[] {
  const t = Array.from(new Set(tokens(q))).slice(0, MAX_TOKENS);
  // A query made entirely of stop words ("how do I") still deserves an answer,
  // so fall back to the raw trimmed string as a single term.
  if (t.length === 0) {
    const raw = q.trim().toLowerCase();
    return raw.length >= 2 ? [raw] : [];
  }
  return t;
}

/** Build an OR of `contains` clauses: every token against every listed column. */
function containsAny(fields: string[], toks: string[]) {
  const or: any[] = [];
  for (const f of toks) {
    for (const field of fields) {
      or.push({ [field]: { contains: f, mode: "insensitive" } });
    }
  }
  return or;
}

/**
 * Score a hit. Weighting mirrors memory.ts scoreRow: a match in the label the
 * user would actually say out loud beats one buried in a long body, and recent
 * things win ties because personal recall is overwhelmingly recency-biased.
 */
function score(
  label: string,
  body: string | null,
  when: Date,
  toks: string[],
  boost = 0,
): number {
  const labelT = new Set(tokens(label));
  const bodyT = new Set(body ? tokens(body) : []);
  const q = new Set(toks);

  let s = 0;
  for (const t of labelT) if (q.has(t)) s += 4;
  for (const t of bodyT) if (q.has(t)) s += 1;

  // Substring credit, so "revenue" still finds "Revenue letter" when the
  // tokeniser splits differently than the user typed.
  const hay = `${label} ${body ?? ""}`.toLowerCase();
  for (const t of toks) if (t.length > 3 && hay.includes(t)) s += 0.5;

  // Full point this week, decaying to nothing over ~3 months.
  const ageDays = (Date.now() - when.getTime()) / 86_400_000;
  s += Math.max(0, 1 - ageDays / 90) * 2;

  return s + boost;
}

/** Trim a long body down to a window around the first matching token. */
function snippet(body: string | null, toks: string[], len = 180): string | null {
  if (!body) return null;
  const clean = body.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= len) return clean;

  const lower = clean.toLowerCase();
  let at = -1;
  for (const t of toks) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return `${clean.slice(0, len)}…`;

  const start = Math.max(0, at - 60);
  const end = Math.min(clean.length, start + len);
  return `${start > 0 ? "…" : ""}${clean.slice(start, end)}${end < clean.length ? "…" : ""}`;
}

export async function searchNavigator(
  userId: string,
  rawQuery: string,
  opts: { limit?: number; sources?: SearchSource[] } = {},
): Promise<{ hits: SearchHit[]; tokens: string[]; counts: Record<SearchSource, number> }> {
  const toks = queryTokens(rawQuery);
  const counts: Record<SearchSource, number> = { task: 0, capture: 0, memory: 0, chat: 0 };
  if (toks.length === 0) return { hits: [], tokens: [], counts };

  const want = (s: SearchSource) => !opts.sources || opts.sources.includes(s);
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);

  const [tasks, captures, memories, chats] = await Promise.all([
    want("task")
      ? prisma.navTask.findMany({
          // Drafts and archived rows ARE searchable. Excluding drafts is right
          // for ambient lists and nudges — an untriaged dump should not shout —
          // but search is explicit intent: he typed the words, so hiding the
          // row he is hunting for would be the bug, not the feature.
          where: { userId, OR: containsAny(["title", "notes", "project"], toks) },
          select: {
            id: true, title: true, notes: true, project: true, status: true,
            priority: true, dueDate: true, archivedAt: true, updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: CANDIDATES,
        })
      : [],
    want("capture")
      ? prisma.navCapture.findMany({
          where: { userId, OR: containsAny(["title", "summary", "rawText", "vendor"], toks) },
          select: {
            id: true, kind: true, title: true, summary: true, rawText: true,
            vendor: true, status: true, total: true, docDate: true, createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: CANDIDATES,
        })
      : [],
    want("memory")
      ? prisma.navMemory.findMany({
          // Forgotten rows stay out. A soft flag keeps them auditable in the
          // memory panel, but "forget this" has to actually stop it surfacing
          // or the word means nothing.
          where: { userId, forgotten: false, OR: containsAny(["key", "value", "subject"], toks) },
          select: {
            id: true, kind: true, key: true, value: true, subject: true,
            pinned: true, useCount: true, updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: CANDIDATES,
        })
      : [],
    want("chat")
      ? prisma.navChatMessage.findMany({
          where: { userId, OR: containsAny(["content"], toks) },
          select: { id: true, role: true, content: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: CANDIDATES,
        })
      : [],
  ]);

  const hits: SearchHit[] = [];

  for (const t of tasks) {
    const flags: string[] = [];
    if (t.status === "draft") flags.push("draft");
    if (t.archivedAt) flags.push("archived");
    if (t.status === "done") flags.push("done");
    hits.push({
      id: t.id,
      source: "task",
      tab: TAB_FOR.task,
      title: t.title,
      snippet: snippet(t.notes, toks),
      meta: t.project ?? t.priority,
      flags,
      when: t.updatedAt.toISOString(),
      // A live task is more useful than a finished one when both match.
      score: score(t.title, t.notes, t.updatedAt, toks, t.archivedAt || t.status === "done" ? -1.5 : 0),
    });
  }

  for (const c of captures) {
    const label = c.title ?? c.vendor ?? c.kind;
    const flags: string[] = [];
    if (c.status === "failed") flags.push("unread");
    if (c.status === "pending") flags.push("reading");
    hits.push({
      id: c.id,
      source: "capture",
      tab: TAB_FOR.capture,
      title: label,
      snippet: snippet(c.summary ?? c.rawText, toks),
      meta: c.kind,
      flags,
      when: (c.docDate ?? c.createdAt).toISOString(),
      score: score(label, `${c.summary ?? ""} ${c.rawText ?? ""}`, c.createdAt, toks),
    });
  }

  for (const m of memories) {
    hits.push({
      id: m.id,
      source: "memory",
      tab: TAB_FOR.memory,
      title: m.key,
      snippet: snippet(m.value, toks),
      meta: m.subject ?? m.kind,
      flags: m.pinned ? ["pinned"] : [],
      when: m.updatedAt.toISOString(),
      // Same mild feedback loop as recall: what gets used keeps surfacing.
      score: score(m.key, m.value, m.updatedAt, toks, Math.min(m.useCount, 5) * 0.2 + (m.pinned ? 0.5 : 0)),
    });
  }

  for (const c of chats) {
    hits.push({
      id: c.id,
      source: "chat",
      tab: TAB_FOR.chat,
      title: c.role === "user" ? "You said" : "Navigator said",
      snippet: snippet(c.content, toks),
      meta: null,
      flags: [],
      when: c.createdAt.toISOString(),
      // Chat is the noisiest surface by volume, so it needs a handicap or a
      // long conversation buries the task it was actually about.
      score: score("", c.content, c.createdAt, toks, -0.75),
    });
  }

  for (const h of hits) counts[h.source]++;

  hits.sort((a, b) => b.score - a.score || b.when.localeCompare(a.when));

  return { hits: hits.slice(0, limit), tokens: toks, counts };
}
