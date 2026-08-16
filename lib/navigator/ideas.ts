/**
 * The ideas engine — daily.
 *
 * Gabor asked for Navigator to "help gather ideas and new functionality". The
 * naive version of that is a chatbot that produces ten plausible SaaS ideas on
 * request, which is worth nothing: the bottleneck was never generating ideas,
 * it was noticing the one signal in the system that says WHICH idea is worth a
 * week. So this reads the real pulse and is only allowed to propose things it
 * can attach a number to.
 *
 * Three rules do the heavy lifting:
 *
 *  1. GROUNDED. Every idea must cite a figure from the pulse. "Add a loyalty
 *     module" is rejected; "3 of 6 tenants logged zero HACCP checks in 14 days,
 *     and HACCP is the stickiest module — a first-run checklist is the cheapest
 *     retention fix" is an idea. The prompt makes the citation mandatory and
 *     ideas without one are dropped locally, not just discouraged.
 *
 *  2. RATE LIMITED BY THE INBOX, NOT BY THE CLOCK. Daily generation is only
 *     safe if it stops when he stops triaging. Once six undecided ideas are
 *     sitting in the inbox it produces nothing at all until he clears some.
 *     An idea list nobody reads is worse than no list, because it teaches him
 *     the inbox is noise — the exact failure mode the whole Navigator design
 *     exists to avoid.
 *
 *  3. NO NOTIFICATION. Ideas never buzz the phone. They are not time-critical
 *     and the nudge channel is a scarce, protected resource (see the burst cap
 *     in nudges.ts). They appear in the triage inbox and get mentioned in the
 *     morning warm-up. That is enough.
 *
 * They land as NavTask drafts, reusing the batch-2 triage inbox rather than
 * inventing a parallel "ideas" surface with its own list, filter and empty
 * state. A draft is already "captured but undecided" — that is exactly what an
 * idea is, and one swipe promotes it to real work.
 */
import { prisma } from "@/lib/db";
import { readPulse } from "./rotahr/pulse";
import { renderPulse } from "./rotahr/signals";
import { navigatorJson } from "./ai";

/** Ideas project name. Also the filter the UI groups on. */
export const IDEAS_PROJECT = "Ideas";

/** Stop producing once this many undecided ideas are already waiting. */
export const INBOX_LIMIT = 6;

/** Never more than this in one run, however much the model wants to say. */
export const MAX_PER_RUN = 2;

export type IdeaOut = {
  title: string;
  evidence: string;
  why: string;
  firstStep: string;
  effortMins: number;
  priority: "urgent" | "important" | "quickwin" | "later";
};

export type IdeasResult = {
  ok: boolean;
  created: number;
  skipped?: string;
  titles: string[];
  rejected: { title: string; reason: string }[];
};

/** Lowercase alphanumeric tokens, for the duplicate check. */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/**
 * Jaccard overlap. Cheap, and good enough: the failure mode being defended
 * against is the model re-proposing yesterday's idea in slightly different
 * words, which shares most of its nouns.
 */
export function tooSimilar(a: string, b: string, threshold = 0.55): boolean {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return false;
  let shared = 0;
  for (const t of A) if (B.has(t)) shared += 1;
  return shared / new Set([...A, ...B]).size >= threshold;
}

export async function generateIdeas(userId: string): Promise<IdeasResult> {
  const profile = await prisma.navProfile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, created: 0, skipped: "no profile", titles: [], rejected: [] };
  if (!profile.ideasEnabled)
    return { ok: true, created: 0, skipped: "ideas disabled", titles: [], rejected: [] };
  if (!profile.systemAccess)
    return { ok: true, created: 0, skipped: "system access off", titles: [], rejected: [] };

  // Ungrounded ideas are the thing this exists to avoid, so no pulse means no
  // ideas — not "ideas from general knowledge".
  const { data: pulse, ageMinutes } = await readPulse(userId);
  if (!pulse) return { ok: true, created: 0, skipped: "no pulse yet", titles: [], rejected: [] };

  const waiting = await prisma.navTask.count({
    where: { userId, status: "draft", project: IDEAS_PROJECT },
  });
  if (waiting >= INBOX_LIMIT)
    return {
      ok: true,
      created: 0,
      skipped: `inbox full (${waiting} waiting)`,
      titles: [],
      rejected: [],
    };

  // Everything he has already seen or done recently, so the model does not
  // proudly reinvent it. Titles only — his own task titles, his own data.
  const [recentTasks, ships] = await Promise.all([
    prisma.navTask.findMany({
      where: { userId, createdAt: { gte: new Date(Date.now() - 45 * 864e5) } },
      select: { title: true, status: true, project: true },
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
    prisma.navShipLog.findMany({
      where: { userId, at: { gte: new Date(Date.now() - 21 * 864e5) } },
      select: { message: true },
      orderBy: { at: "desc" },
      take: 30,
    }),
  ]);

  const known = recentTasks.map((t) => t.title);
  const room = Math.min(MAX_PER_RUN, INBOX_LIMIT - waiting);

  const out = await navigatorJson<{ ideas: IdeaOut[] }>(
    `You are Navigator, working as the founder's product partner for Rotahr — an all-in-one
hospitality operations app (scheduling, bookings, payroll, HACCP, stock, CRM, bookkeeping)
sold to restaurants, bars and hotels in Ireland, the UK, the US, Canada and Australia.

Propose at most ${room} idea(s) for what he should build, fix or try NEXT. Return JSON only:
{ "ideas": [ { "title": string, "evidence": string, "why": string, "firstStep": string, "effortMins": number, "priority": "urgent"|"important"|"quickwin"|"later" } ] }

Hard rules:
- EVIDENCE IS MANDATORY. "evidence" must quote an actual figure from the system readout
  below and name it. If you cannot point at a number, do not propose the idea. An idea with
  invented or vague evidence is worse than no idea.
- Prefer fixing something the numbers say is broken or unused over adding something new.
  A module with usage from 1 of 6 tenants is a bigger opportunity than a module that does
  not exist yet.
- No duplicates of anything in "Already captured or shipped".
- "title": one concrete action starting with a verb. Max 90 chars. No marketing language.
- "why": one or two sentences on the mechanism — why this specific change moves that
  specific number. Max 240 chars.
- "firstStep": the 15-minute first physical action, zero decisions required.
- "effortMins": honest build estimate for a solo founder, inflated 50% over the optimistic one.
- "priority": quickwin only if genuinely under an hour. Do not inflate. Most are "later".
- Say fewer things. One idea with a real number beats two without. An empty array is a
  valid and correct answer when nothing in the readout warrants action today.`,
    `${renderPulse(pulse, 2600)}
${ageMinutes != null && ageMinutes > 240 ? `\n(Readout is ${Math.floor(ageMinutes / 60)}h old.)` : ""}

Already captured or shipped — do not repeat these:
${[...known, ...ships.map((s) => s.message.split("\n")[0])].slice(0, 90).map((t) => `- ${t}`).join("\n") || "- (nothing yet)"}`,
    900
  );

  const proposed = Array.isArray(out?.ideas) ? out.ideas.slice(0, room) : [];
  const rejected: { title: string; reason: string }[] = [];
  const accepted: IdeaOut[] = [];

  for (const idea of proposed) {
    const title = String(idea?.title ?? "").trim();
    if (!title) continue;
    // Rule 1, enforced in code and not just asked for in the prompt.
    if (!idea?.evidence || String(idea.evidence).trim().length < 12) {
      rejected.push({ title, reason: "no evidence" });
      continue;
    }
    const clash = [...known, ...accepted.map((a) => a.title)].find((k) => tooSimilar(k, title));
    if (clash) {
      rejected.push({ title, reason: `duplicate of "${clash}"` });
      continue;
    }
    accepted.push({ ...idea, title });
  }

  if (!accepted.length)
    return { ok: true, created: 0, skipped: "nothing worth proposing", titles: [], rejected };

  await prisma.navTask.createMany({
    data: accepted.map((idea) => ({
      userId,
      title: idea.title.slice(0, 300),
      // The evidence is the point, so it is the first line of the note — it is
      // what he reads when deciding whether to keep the idea.
      notes: [
        `Signal: ${idea.evidence}`,
        idea.why ? `Why: ${idea.why}` : null,
        "— generated from the daily system pulse",
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 4000),
      project: IDEAS_PROJECT,
      status: "draft",
      priority: (["urgent", "important", "quickwin", "later"] as const).includes(idea.priority)
        ? idea.priority
        : "later",
      effortMins: Number.isFinite(idea.effortMins) ? Math.max(15, Math.round(idea.effortMins)) : null,
      startTrigger: idea.firstStep ? String(idea.firstStep).slice(0, 500) : null,
    })),
  });

  return { ok: true, created: accepted.length, titles: accepted.map((a) => a.title), rejected };
}
