import { prisma } from "@/lib/db";
import { navigatorJson } from "@/lib/navigator/ai";

/**
 * Hands the founder two ready-to-paste listing submissions a week.
 *
 * WHY A TASK AND NOT A DASHBOARD
 * The admin Links tab already lists every prospect and has done for months
 * without a single one being submitted — 17 rows, all still "new". A list you
 * have to remember to open is not a system. Two rows a week, pushed into the
 * queue he actually works from, with the copy already written, is.
 *
 * WHY TWO
 * Each submission is roughly three minutes of form-filling that cannot be
 * automated (see listing-discovery.ts for why). Two is small enough to never be
 * the reason a day goes badly and still clears ~100 listings a year, which is
 * far more than the zero the tab was producing. The cap matters more than the
 * number: a weekly job that dumps ten tasks trains him to ignore the project.
 *
 * WHY IT STOPS WHEN HE STOPS
 * If two visibility tasks are already open, this run produces nothing. A backlog
 * of stale "submit to X" tasks is exactly how a queue loses credibility, and the
 * targets are not going anywhere.
 */

/** Project bucket. Also the filter the UI groups on. */
export const VISIBILITY_PROJECT = "Visibility";

/** Never more than this open at once, however long the prospect list is. */
export const OPEN_LIMIT = 2;

/**
 * Copy rules, shared with the discovery vetter.
 *
 * The one that matters is the honesty clause. Rotahr has no paying customers,
 * and a directory profile claiming otherwise is a public lie that stays up long
 * after the sentence stopped being convenient — on the exact pages a prospective
 * buyer checks to decide whether the vendor is real.
 */
const PITCH_SYSTEM = `You write submission copy for Rotahr, an all-in-one operations app for hospitality businesses: staff rota scheduling, clock-in with break tracking, table bookings with a floor plan, payroll export, HACCP food-safety logs, stock and recipe costing, bookkeeping with receipt scanning, team messaging and a customer CRM. Built by a former chef. Sold to restaurants, pubs, cafes and hotels in Ireland, the UK, the US, Canada and Australia. Pricing is EUR 59 / 119 / 215 per month including VAT, first month free. Site: https://rotahr.com

Write copy that can be pasted into the target's submission form or sent as the pitch email, with NOTHING left for the user to fill in. No placeholders, no square brackets, no "insert here".

Hard rules:
- Never invent a customer count, revenue figure, funding round, award, review score or testimonial. Rotahr has no paying customers yet. A false claim on a public profile outlives the listing.
- Never use the words "revolutionary", "seamless", "cutting-edge" or "game-changing".
- Lead with what it does, concretely. A hospitality operator should recognise their own week in the first sentence.
- Match the target: a directory wants a product description, a publication wants a short pitch email with a subject line, a community wants a plain first-person post.

Return JSON: {"pitch": string}
Length: 90-180 words for a directory, up to 220 for a pitch email.`;

/**
 * Write the copy for one target. Called at hand-out time for the seeded rows,
 * which were entered by hand and have no pitch stored — rather than pre-writing
 * copy for all seventeen up front, which spends model budget on rows that may
 * never reach the front of the queue.
 */
async function writePitch(row: {
  name: string;
  url: string;
  kind: string;
  angle: string | null;
  contactNote: string | null;
}): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const out = await navigatorJson<{ pitch: string }>(
      PITCH_SYSTEM,
      [
        `Target: ${row.name}`,
        `URL: ${row.url}`,
        `Type: ${row.kind}`,
        row.angle ? `Why they might care: ${row.angle}` : null,
        row.contactNote ? `Submission notes: ${row.contactNote}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      900
    );
    const pitch = String(out?.pitch ?? "").trim();
    return pitch.length >= 80 ? pitch : null;
  } catch {
    return null;
  }
}

export type ListingTasksResult = {
  ok: boolean;
  created: number;
  titles: string[];
  skipped?: string;
};

function stepFor(submitUrl: string | null, url: string): string {
  return `Open ${submitUrl || url} and find the submission form. Copy is already written below — paste it, do not rewrite it.`;
}

export async function createListingTasks(userId: string): Promise<ListingTasksResult> {
  const profile = await prisma.navProfile.findUnique({ where: { userId } });
  if (!profile) return { ok: false, created: 0, titles: [], skipped: "no profile" };

  const open = await prisma.navTask.count({
    where: {
      userId,
      project: VISIBILITY_PROJECT,
      status: { in: ["todo", "doing", "draft"] },
      archivedAt: null,
    },
  });
  if (open >= OPEN_LIMIT)
    return { ok: true, created: 0, titles: [], skipped: `${open} still open` };

  const room = OPEN_LIMIT - open;

  // A few extra candidates, because a row whose copy cannot be written is
  // skipped and the next one takes its place — the weekly quota should not be
  // lost to one failed model call.
  const candidates = await prisma.linkProspect.findMany({
    where: {
      status: "new",
      taskedAt: null,
    },
    orderBy: [{ weight: "desc" }, { createdAt: "asc" }],
    take: room + 3,
    select: {
      id: true,
      name: true,
      url: true,
      submitUrl: true,
      pitch: true,
      angle: true,
      weight: true,
      kind: true,
      contactEmail: true,
      contactNote: true,
    },
  });

  if (!candidates.length)
    return { ok: true, created: 0, titles: [], skipped: "no un-tasked prospects left" };

  const titles: string[] = [];

  for (const row of candidates) {
    if (titles.length >= room) break;

    // Seeded rows were entered by hand and carry no copy. Writing it now is the
    // difference between a task he can finish in three minutes and a task that
    // silently asks him to do the hard part himself.
    if (!row.pitch) {
      const written = await writePitch(row);
      if (!written) continue;
      row.pitch = written;
      await prisma.linkProspect.update({ where: { id: row.id }, data: { pitch: written } });
    }

    const title = `Submit Rotahr to ${row.name}`.slice(0, 300);
    const notes = [
      `Target: ${row.submitUrl || row.url}`,
      row.contactEmail ? `Send to: ${row.contactEmail}` : null,
      `Kind: ${row.kind} · weight ${row.weight}/10`,
      row.angle ? `Angle: ${row.angle}` : null,
      "",
      "--- PASTE THIS ---",
      row.pitch || "",
      "--- END ---",
      "",
      "Mark done once submitted, then set the row to 'sent' in /admin → Links. When the listing goes live paste its URL there so the weekly monitor can watch it.",
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.navTask.create({
      data: {
        userId,
        title,
        notes,
        project: VISIBILITY_PROJECT,
        status: "todo",
        priority: "quickwin",
        effortMins: 5,
        startTrigger: stepFor(row.submitUrl, row.url),
      },
    });

    // Stamped immediately so a crash mid-loop cannot re-propose the same target
    // next week on top of a task that already exists.
    await prisma.linkProspect.update({
      where: { id: row.id },
      data: { taskedAt: new Date(), status: "queued" },
    });

    titles.push(title);
  }

  return { ok: true, created: titles.length, titles };
}
