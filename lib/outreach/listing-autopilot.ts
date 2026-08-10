import { prisma } from "@/lib/prisma";
import { isSuppressed } from "@/lib/email/suppression";
import { buildPageFromEmail } from "@/lib/public-page/from-email";
import { renderListingInvite, LISTING_INVITED_STATUS } from "./listing-invite";
import { sendOutreachEmail, isBrevoConfigured, checkSenderDomain } from "./brevo";
import { submitToIndexNow } from "@/lib/seo/indexnow";

/**
 * Unattended version of the listings tool.
 *
 * The manual flow is paste an address, wait for the page, look at it, press
 * send. That is roughly two minutes of a founder's attention per venue, which
 * caps the whole channel at however many minutes he has spare — the reason this
 * file exists.
 *
 * WHY IT IS TWO PHASES ON DIFFERENT SCHEDULES, NOT ONE BUTTON
 * A page is assembled by a model reading a stranger's website, so some pages
 * come out wrong. A wrong page nobody has seen is a five-second delete; a wrong
 * page announced to its owner by cold email is a complaint we cannot recall.
 * So `buildQueue()` runs overnight and publishes silently, and `sendQueue()`
 * runs the next morning and only ever emails pages that have been sitting in
 * the admin Listings tab for `LISTING_REVIEW_HOURS`. Gabor's review is
 * therefore optional rather than blocking: if he looks, he can bin a bad page
 * before anyone hears about it; if he doesn't, the channel still moves.
 *
 * WHY ONE PAGE PER EMAIL DOMAIN
 * The lead list is chain-heavy — 19 rows share thehawksmoor.com. Building a
 * page per lead would publish 19 near-identical pages read off one corporate
 * site: duplicate thin content aimed at a head office that has a rota system
 * already. Candidate selection is DISTINCT ON the domain and prefers domains
 * appearing once or twice, which is as close to "independent venue" as the
 * data gets.
 *
 * WHY FAILED BUILDS ARE MARKED IN `notes` AND NOT IN `status`
 * A venue whose site has no address is still a perfectly good lead for the
 * product pitch. Moving it out of `new` to record a build failure would delete
 * it from the cold-outreach sequence. So the marker goes in `notes`, which
 * nothing else keys off, and the lead stays exactly where it was.
 */

/**
 * Env numbers, parsed so a bad value cannot weaken a safety limit.
 *
 * `Number(process.env.X || 12)` looks safe but isn't: a typo'd value yields
 * NaN, and every comparison against NaN is false — so `age < REVIEW_HOURS`
 * would wave through a page built one minute ago. Anything that isn't a
 * positive finite number falls back to the hard-coded default.
 */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 10/day. The cap that matters is deliverability, not our patience. */
export const LISTING_DAILY_LIMIT = envInt("LISTING_INVITE_DAILY_LIMIT", 10);

/** Built per overnight run. Above the send limit so the queue survives a bad night. */
const BUILD_PER_RUN = envInt("LISTING_BUILD_PER_RUN", 14);

/** How long a page must sit unsent, so there is a window to bin a bad one. */
const REVIEW_HOURS = envInt("LISTING_REVIEW_HOURS", 12);

/**
 * Markets the autopilot may email. IE only by default: the UK list is imported
 * but held, and a held list should not start moving because a cron shipped.
 */
const MARKETS = (process.env.LISTING_MARKETS || "ie")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const SEND_DELAY_MS = envInt("LISTING_SEND_DELAY_MS", 2500);

/** Marker written into OutreachLead.notes so a dead end is tried once, not nightly. */
const SKIP_MARKER = "[listing-autopilot]";

/** Free-mail domains tell us nothing about a venue's own website. */
const GENERIC_DOMAINS = [
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com",
  "outlook.ie", "live.com", "live.ie", "yahoo.com", "yahoo.co.uk", "yahoo.ie",
  "icloud.com", "me.com", "aol.com", "eircom.net", "gmx.com", "protonmail.com",
  "proton.me", "btinternet.com", "sky.com", "virginmedia.com",
];

/**
 * Words that mean "not a hospitality business", checked against the lead name
 * and its email domain before a model call is spent on it.
 *
 * The imported lists are scraped and contain strays — `info@adwaccountants.ie`
 * came back as the fourth candidate on the first run. A venue page for an
 * accountancy firm is not a near miss, it's the single most embarrassing thing
 * this pipeline could send unattended.
 */
const NOT_HOSPITALITY = [
  "accountant", "accounting", "solicitor", "law", "legal", "insurance", "mortgage",
  "estateagent", "letting", "dental", "dentist", "doctor", "medical", "clinic",
  "pharmacy", "physio", "plumb", "electric", "roofing", "scaffold", "builder",
  "construction", "motors", "autocentre", "tyres", "garage", "taxi", "haulage",
  "recruit", "payroll", "software", "webdesign", "marketing", "printing",
  "funeral", "veterinary", "vets", "school", "college", "church", "charity",
  "hairdress", "barber", "beauty", "nails", "spa-", "gym", "fitness",
  "carpet", "furniture", "flooring", "windows", "security", "cleaning",
];

/** Postgres alternation of the above — one regex is one index-free scan, twenty LIKEs are twenty. */
const NOT_HOSPITALITY_RE = NOT_HOSPITALITY.join("|");

/** Positive signals that the thing we just read really is a place that serves food. */
const HOSPITALITY_WORDS =
  /\b(restaurant|café|cafe|coffee|bar|pub|tavern|bistro|brasserie|hotel|inn|guesthouse|b&b|takeaway|kitchen|dining|dine|eatery|grill|pizzeria|pizza|deli|bakery|brunch|breakfast|lunch|dinner|menu|cocktail|craft beer|wine bar|gastro|catering|food|chef|table|booking|reservation)\b/i;

/**
 * The bar for publishing a page nobody will look at first.
 *
 * `hasIndexableContent()` accepts opening hours on their own, which is right for
 * the manual tool — an admin can see the page is thin and decide anyway. It is
 * too low for unattended publishing: An Brog went out with seven opening-hours
 * rows, no address, no phone and a thirty-three character description, and the
 * "I built you a page" email pointed straight at it.
 *
 * An address is the one field that makes the page useful to a searcher and
 * makes the email defensible, so the autopilot requires it.
 */
export function goodEnoughToAnnounce(input: {
  address?: string | null;
  about?: string | null;
}): { ok: boolean; why?: string } {
  if (!input.address || input.address.trim().length < 8) {
    return { ok: false, why: "no address on the page — too thin to announce unattended" };
  }
  if (!input.about || input.about.trim().length < 60) {
    return { ok: false, why: "description too short to announce unattended" };
  }
  return { ok: true };
}

/**
 * Would a human recognise this as a venue?
 *
 * Runs on the extraction, not the guess: the model is told it is filling in a
 * hospitality directory, so it will happily label an accountant `other` with a
 * tidy address. Requiring either a real venueType or hospitality language
 * somewhere in the copy is what stops that page going live.
 */
export function looksHospitality(input: {
  name?: string | null;
  venueType?: string | null;
  cuisine?: string | null;
  about?: string | null;
  tagline?: string | null;
}): boolean {
  const type = (input.venueType || "").toLowerCase();
  if (["restaurant", "cafe", "bar", "pub", "hotel"].includes(type)) return true;
  if (input.cuisine && input.cuisine.trim().length > 2) return true;
  const copy = [input.name, input.tagline, input.about].filter(Boolean).join(" ");
  return HOSPITALITY_WORDS.test(copy);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function autopilotEnabled(): boolean {
  return process.env.LISTING_AUTOPILOT_ENABLED === "true";
}

/**
 * Invites sent since midnight in Dublin.
 *
 * Counted from OutreachSend rather than a counter row: the manual per-row send
 * button writes the same rows, so a morning of hand-sending correctly eats into
 * the day's automated allowance instead of doubling it.
 */
export async function invitesSentToday(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "OutreachSend"
    WHERE step = ${LISTING_INVITED_STATUS}
      AND "sentAt" >= (date_trunc('day', now() AT TIME ZONE 'Europe/Dublin')) AT TIME ZONE 'Europe/Dublin'
  `;
  return Number(rows[0]?.n ?? 0);
}

export type BuildCandidate = {
  id: string;
  email: string;
  name: string;
  country: string;
  domain: string;
};

/**
 * Leads worth trying to build a page for.
 *
 * Excludes, in SQL because doing it in JS means fetching 1,300 rows to throw
 * most away: free-mail domains, anything suppressed, anything already taken
 * down, domains that already have a page, and leads a previous run already
 * failed on.
 */
export async function pickBuildCandidates(take: number): Promise<BuildCandidate[]> {
  if (take <= 0) return [];
  return prisma.$queryRawUnsafe<BuildCandidate[]>(
    `
    SELECT DISTINCT ON (domain) id, email, name, country, domain
    FROM (
      SELECT l.id, l.email, l.name, l.country,
             split_part(l.email, '@', 2) AS domain,
             count(*) OVER (PARTITION BY split_part(l.email, '@', 2)) AS domain_leads
      FROM "OutreachLead" l
      WHERE l.status = 'new'
        AND l."bouncedAt" IS NULL
        AND l."repliedAt" IS NULL
        AND l.country = ANY($1::text[])
        AND (l.notes IS NULL OR l.notes NOT LIKE '%${SKIP_MARKER}%')
        AND split_part(l.email, '@', 2) <> ALL($2::text[])
        AND lower(l.name || ' ' || l.email) !~ $3
        AND NOT EXISTS (
          SELECT 1 FROM "EmailSuppression" s
          WHERE s.email = l.email AND s."revokedAt" IS NULL
        )
        AND NOT EXISTS (
          SELECT 1 FROM "ListingTakedown" t WHERE t.email = l.email
        )
        AND NOT EXISTS (
          SELECT 1 FROM "Business" b
          WHERE b."publicEmail" IS NOT NULL
            AND split_part(b."publicEmail", '@', 2) = split_part(l.email, '@', 2)
        )
    ) c
    WHERE domain_leads <= 2
    ORDER BY domain, domain_leads ASC, random()
    LIMIT ${Math.max(0, Math.floor(take))}
    `,
    MARKETS,
    GENERIC_DOMAINS,
    NOT_HOSPITALITY_RE
  );
}

/** How many candidates are left — the honest answer to "how long can this run". */
export async function candidatePoolSize(): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `
    SELECT count(*) AS n FROM (
      SELECT DISTINCT split_part(l.email, '@', 2) AS domain,
             count(*) OVER (PARTITION BY split_part(l.email, '@', 2)) AS domain_leads
      FROM "OutreachLead" l
      WHERE l.status = 'new' AND l."bouncedAt" IS NULL AND l."repliedAt" IS NULL
        AND l.country = ANY($1::text[])
        AND (l.notes IS NULL OR l.notes NOT LIKE '%${SKIP_MARKER}%')
        AND split_part(l.email, '@', 2) <> ALL($2::text[])
        AND lower(l.name || ' ' || l.email) !~ $3
        AND NOT EXISTS (SELECT 1 FROM "EmailSuppression" s WHERE s.email = l.email AND s."revokedAt" IS NULL)
        AND NOT EXISTS (SELECT 1 FROM "Business" b WHERE b."publicEmail" IS NOT NULL
                        AND split_part(b."publicEmail", '@', 2) = split_part(l.email, '@', 2))
    ) c WHERE domain_leads <= 2
    `,
    MARKETS,
    GENERIC_DOMAINS,
    NOT_HOSPITALITY_RE
  );
  return Number(rows[0]?.n ?? 0);
}

/** Records that this lead can't produce a page, without touching its sequence. */
async function markSkipped(leadId: string, reason: string): Promise<void> {
  const lead = await prisma.outreachLead.findUnique({
    where: { id: leadId },
    select: { notes: true },
  });
  const stamp = `${SKIP_MARKER} ${new Date().toISOString().slice(0, 10)}: ${reason.slice(0, 160)}`;
  await prisma.outreachLead.update({
    where: { id: leadId },
    data: { notes: lead?.notes ? `${lead.notes}\n${stamp}` : stamp },
  });
}

export type BuildOutcome = {
  email: string;
  name: string;
  ok: boolean;
  slug?: string;
  reason?: string;
};

export type BuildQueueResult = {
  attempted: number;
  built: number;
  failed: number;
  outcomes: BuildOutcome[];
  indexnow?: string;
  poolRemaining: number;
  stoppedEarly?: string;
  /** Set when the brake below stopped the run before any build was attempted. */
  paused?: string;
};

/**
 * Stop building once this many pages are already waiting to be invited.
 *
 * Building 14 a day against 10 weekday sends means the queue grows every
 * weekend and never drains. Three things go wrong if it's left unbounded: a
 * model call is spent weeks before the page is used, the "I built you a page"
 * email starts describing a page assembled a month ago from a menu that has
 * since changed, and a takedown request arrives for a page nobody has mentioned
 * to anybody. Keeping roughly three days of sending in hand is enough to
 * survive a failed overnight run without any of that.
 */
const MAX_QUEUE = envInt("LISTING_MAX_QUEUE", LISTING_DAILY_LIMIT * 3);

/**
 * Overnight build phase. Publishes pages, emails nobody.
 *
 * `deadlineMs` exists because each build fetches a website and calls a model —
 * 20-40s a venue — and a Vercel function killed at 300s mid-build leaves no
 * record of what it did. Stopping cleanly at the budget reports honestly.
 */
export async function buildQueue(
  opts: { take?: number; deadlineMs?: number; ignoreQueueCap?: boolean } = {}
): Promise<BuildQueueResult> {
  const deadline = Date.now() + (opts.deadlineMs ?? 240_000);

  // Every unsent page counts toward the cap, whether or not its review window
  // has elapsed — pages in review are queue too, they just haven't matured yet.
  const queued = opts.ignoreQueueCap ? 0 : await unsentPageCount();
  const room = opts.ignoreQueueCap ? (opts.take ?? BUILD_PER_RUN) : MAX_QUEUE - queued;
  if (room <= 0) {
    return {
      attempted: 0,
      built: 0,
      failed: 0,
      outcomes: [],
      poolRemaining: await candidatePoolSize(),
      paused: `${queued} pages already waiting to be invited (cap ${MAX_QUEUE}) — not building more until the queue drains`,
    };
  }

  const take = Math.min(opts.take ?? BUILD_PER_RUN, room);
  const candidates = await pickBuildCandidates(take);
  const outcomes: BuildOutcome[] = [];
  const newUrls: string[] = [];
  let stoppedEarly: string | undefined;

  for (const lead of candidates) {
    if (Date.now() > deadline) {
      stoppedEarly = `time budget reached after ${outcomes.length} of ${candidates.length}`;
      break;
    }
    try {
      const r = await buildPageFromEmail({ email: lead.email, name: lead.name || null });
      if (r.ok) {
        // Last gate, after the model has actually read the site. Unattended, a
        // page for a non-venue is worse than no page, so it is deleted rather
        // than left for someone to notice.
        if (
          !looksHospitality({
            name: r.name,
            venueType: r.extracted.venueType,
            cuisine: r.extracted.cuisine,
            about: r.extracted.about,
            tagline: r.extracted.tagline,
          })
        ) {
          await prisma.business.delete({ where: { id: r.businessId } }).catch(() => undefined);
          const reason = "doesn't read as a hospitality venue — page deleted";
          outcomes.push({ email: lead.email, name: r.name, ok: false, reason });
          await markSkipped(lead.id, reason);
          continue;
        }
        // Second quality gate, stricter than the manual tool's. A page that
        // fails it is deleted rather than published-and-never-sent, so the
        // Listings tab doesn't silt up with pages that can never go out.
        const quality = goodEnoughToAnnounce({
          address: r.extracted.address,
          about: r.extracted.about,
        });
        if (!quality.ok) {
          await prisma.business.delete({ where: { id: r.businessId } }).catch(() => undefined);
          outcomes.push({ email: lead.email, name: r.name, ok: false, reason: quality.why });
          await markSkipped(lead.id, quality.why || "below quality bar");
          continue;
        }

        outcomes.push({ email: lead.email, name: r.name, ok: true, slug: r.slug });
        // noindex pages are the thin ones; only ask search engines for the rest.
        if (r.indexable) newUrls.push(`https://rotahr.com/v/${r.slug}`);
      } else {
        outcomes.push({ email: lead.email, name: lead.name, ok: false, reason: r.error });
        await markSkipped(lead.id, r.error);
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : "build threw";
      outcomes.push({ email: lead.email, name: lead.name, ok: false, reason });
      await markSkipped(lead.id, reason);
    }
  }

  const built = outcomes.filter((o) => o.ok).length;
  return {
    attempted: outcomes.length,
    built,
    failed: outcomes.length - built,
    outcomes,
    indexnow: newUrls.length ? await submitToIndexNow(newUrls) : undefined,
    poolRemaining: await candidatePoolSize(),
    stoppedEarly,
  };
}

export type ReadyPage = {
  id: string;
  name: string;
  slug: string;
  email: string;
  city: string | null;
  createdAt: Date;
};

/**
 * Pages cleared to be announced: real content on them, a contact to send to,
 * working links, past the review window, and no invite already recorded.
 */
/**
 * Every prospect page that could still be invited — mature or still in review.
 *
 * This is what the build brake measures, not `pickReadyPages`: a page built ten
 * minutes ago is already committed work even though it can't be sent yet, and
 * counting only mature pages would let a run build another full batch every
 * night while the previous one sat in its review window.
 */
export async function unsentPageCount(): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "Business" b
    WHERE b."publicProspect" = true
      AND b."publicSlug" IS NOT NULL
      AND b."publicEmail" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "EmailSuppression" s
        WHERE s.email = b."publicEmail" AND s."revokedAt" IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM "OutreachLead" l
        WHERE l.email = b."publicEmail"
          AND (l.status IN (${LISTING_INVITED_STATUS}, 'bounced', 'unsubscribed', 'replied', 'converted')
               OR l."bouncedAt" IS NOT NULL)
      )
  `;
  return Number(rows[0]?.n ?? 0);
}

export async function pickReadyPages(take: number): Promise<ReadyPage[]> {
  if (take <= 0) return [];
  const cutoff = new Date(Date.now() - REVIEW_HOURS * 3600_000);
  const rows = await prisma.$queryRawUnsafe<ReadyPage[]>(
    `
    SELECT b.id, b.name, b."publicSlug" AS slug, b."publicEmail" AS email,
           NULL::text AS city, b."createdAt"
    FROM "Business" b
    WHERE b."publicProspect" = true
      AND b."publicNoIndex" = false
      AND b."publicSlug" IS NOT NULL
      AND b."publicEmail" IS NOT NULL
      AND b."publicTakedownToken" IS NOT NULL
      AND b."createdAt" <= $1
      AND NOT EXISTS (
        SELECT 1 FROM "EmailSuppression" s
        WHERE s.email = b."publicEmail" AND s."revokedAt" IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM "OutreachLead" l
        WHERE l.email = b."publicEmail"
          AND (l.status IN ($2, 'bounced', 'unsubscribed', 'replied', 'converted')
               OR l."bouncedAt" IS NOT NULL)
      )
    ORDER BY b."createdAt" ASC
    LIMIT ${Math.max(0, Math.floor(take))}
    `,
    cutoff,
    LISTING_INVITED_STATUS
  );
  return rows;
}

export type InviteResult =
  | { ok: true; to: string; subject: string }
  | { ok: false; error: string; status?: number };

/**
 * Send the "I made you a page" email for one prospect page and record it.
 *
 * The single implementation behind both the admin per-row button and the cron,
 * so the two can't drift into disagreeing about what a sent invite looks like
 * in the database.
 */
export async function sendListingInvite(
  businessId: string,
  opts: {
    city?: string;
    hook?: string;
    /**
     * Skip the review-window check. Only ever set by the per-row admin button,
     * where a human is looking at the page as they click — that click IS the
     * review. No automated path may set it.
     */
    force?: boolean;
    /** Recorded on the lead so a surprise batch can be traced to its trigger. */
    via?: string;
  } = {}
): Promise<InviteResult> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      publicSlug: true,
      publicEmail: true,
      publicProspect: true,
      publicTakedownToken: true,
      createdAt: true,
    },
  });
  if (!biz || !biz.publicProspect) {
    return { ok: false, error: "No prospect page with that id.", status: 404 };
  }

  /**
   * Real invites may only leave from the deployed app.
   *
   * `.env.local` holds the production database URL and a live Brevo key, so a
   * throwaway script run from the sandbox sends real mail to real venues. That
   * is exactly what happened: eleven invites went to pages eleven minutes old
   * from a working copy that was mid-edit, while the committed code had the
   * review window in place. Reading the source proved nothing because the
   * source wasn't what ran. Vercel sets VERCEL=1; nothing else does, so the
   * cron and the admin panel are unaffected and local runs are inert unless
   * someone opts in on purpose.
   */
  if (!process.env.VERCEL && process.env.LISTING_ALLOW_LOCAL_SEND !== "true") {
    return {
      ok: false,
      error:
        "Refusing to send from outside the deployed app. Set LISTING_ALLOW_LOCAL_SEND=true only if you mean to mail real venues from here.",
      status: 403,
    };
  }

  /**
   * The review window, enforced here rather than only in pickReadyPages.
   *
   * It used to live solely in that query's WHERE clause, which meant the
   * protection belonged to one code path instead of to the act of sending. Ten
   * invites went out to pages eleven minutes old, and one of them (An Brog) had
   * no address and a one-line description — precisely what the window exists to
   * catch. Every caller now funnels through this check, so a new script, route
   * or button cannot quietly reintroduce the same hole.
   */
  /**
   * The daily cap, also enforced here and not only in sendQueue.
   *
   * Eleven invites went out on a ten-invite day: two runs each read
   * `sentToday` as 0 before either had sent anything, so both were entitled to
   * a full batch. Checking immediately before each individual send closes the
   * window to one message instead of a whole batch.
   */
  if (!opts.force && (await invitesSentToday()) >= LISTING_DAILY_LIMIT) {
    return {
      ok: false,
      error: `Daily limit of ${LISTING_DAILY_LIMIT} listing invites already reached.`,
      status: 429,
    };
  }

  const ageHours = (Date.now() - biz.createdAt.getTime()) / 3_600_000;
  if (!opts.force && ageHours < REVIEW_HOURS) {
    return {
      ok: false,
      error: `Page is ${ageHours.toFixed(1)}h old and the review window is ${REVIEW_HOURS}h — not sending yet.`,
      status: 400,
    };
  }
  if (!biz.publicSlug || !biz.publicTakedownToken || !biz.publicEmail) {
    // An invite whose links don't work is worse than no invite.
    return {
      ok: false,
      error: "That page is missing a slug, email or takedown token — can't send.",
      status: 400,
    };
  }
  if (await isSuppressed(biz.publicEmail)) {
    return { ok: false, error: "That address has unsubscribed.", status: 400 };
  }

  const existingLead = await prisma.outreachLead.findUnique({
    where: { email: biz.publicEmail },
    select: { id: true, status: true },
  });
  if (existingLead?.status === LISTING_INVITED_STATUS) {
    return { ok: false, error: "Already invited.", status: 400 };
  }
  if (existingLead && ["bounced", "unsubscribed"].includes(existingLead.status)) {
    return { ok: false, error: `Lead is ${existingLead.status} — not sending.`, status: 400 };
  }

  const content = renderListingInvite({
    name: biz.name,
    email: biz.publicEmail,
    slug: biz.publicSlug,
    takedownToken: biz.publicTakedownToken,
    city: opts.city,
    hook: opts.hook,
  });

  const sent = await sendOutreachEmail({
    to: biz.publicEmail,
    toName: biz.name,
    subject: content.subject,
    html: content.html,
    text: content.text,
    tags: ["listing_invite"],
  });

  if (!sent.ok) {
    if (sent.hardBounce) {
      await prisma.outreachLead.upsert({
        where: { email: biz.publicEmail },
        create: {
          email: biz.publicEmail,
          name: biz.name,
          city: opts.city || "",
          status: "bounced",
          bouncedAt: new Date(),
          source: "listing_invite",
        },
        update: { status: "bounced", bouncedAt: new Date() },
      });
    }
    return { ok: false, error: sent.error || "Send failed.", status: 502 };
  }

  // Parked on `listing_invited`, which matches no branch in findEligibleLeads —
  // so the weekday cron cannot fold these into the five-step product pitch.
  const lead = await prisma.outreachLead.upsert({
    where: { email: biz.publicEmail },
    create: {
      email: biz.publicEmail,
      name: biz.name,
      city: opts.city || "",
      status: LISTING_INVITED_STATUS,
      contactCount: 1,
      lastContacted: new Date(),
      source: "listing_invite",
    },
    update: {
      status: LISTING_INVITED_STATUS,
      contactCount: { increment: 1 },
      lastContacted: new Date(),
    },
  });

  // Who sent this, in plain text on the lead. Cheap, and the thing whose
  // absence made an unexplained batch of ten take an hour to investigate.
  await prisma.outreachLead
    .update({
      where: { id: lead.id },
      data: {
        notes: `${lead.notes ? lead.notes + "\n" : ""}[listing-invite] ${new Date().toISOString()} via ${
          opts.via || "unknown"
        }${opts.force ? " (forced past review window)" : ""}`,
      },
    })
    .catch(() => undefined);

  await prisma.outreachSend
    .create({
      data: {
        leadId: lead.id,
        email: biz.publicEmail,
        step: LISTING_INVITED_STATUS,
        subject: content.subject,
        messageId: sent.messageId,
      },
    })
    .catch(() => undefined);

  return { ok: true, to: biz.publicEmail, subject: content.subject };
}

export type SendQueueResult = {
  sent: number;
  skipped: number;
  attempted: number;
  dailyLimit: number;
  sentToday: number;
  queueDepth: number;
  reason?: string;
  outcomes: { to: string; name: string; sent: boolean; subject?: string; reason?: string }[];
};

/** Morning send phase: up to `LISTING_DAILY_LIMIT` invites, oldest page first. */
export async function sendQueue(
  opts: { limit?: number; dryRun?: boolean; via?: string } = {}
): Promise<SendQueueResult> {
  const sentToday = await invitesSentToday();
  const base = {
    sent: 0,
    skipped: 0,
    attempted: 0,
    dailyLimit: LISTING_DAILY_LIMIT,
    sentToday,
    queueDepth: 0,
    outcomes: [] as SendQueueResult["outcomes"],
  };

  if (!opts.dryRun && !isBrevoConfigured()) {
    return { ...base, reason: "BREVO_API_KEY is not set" };
  }

  // Same guard as the cold batch: Brevo returns 201 for unsigned mail, so
  // without this a broken DNS record turns into a quiet reputation fire.
  if (!opts.dryRun && process.env.OUTREACH_ALLOW_UNVERIFIED_DOMAIN !== "true") {
    const dns = await checkSenderDomain();
    if (!dns.authenticated) {
      return {
        ...base,
        reason: `Sending domain ${dns.domain} is not authenticated at Brevo — ${
          dns.error || `missing ${dns.missing.map((r) => `${r.type} ${r.host}`).join(", ")}`
        }`,
      };
    }
  }

  const remaining = LISTING_DAILY_LIMIT - sentToday;
  if (!opts.dryRun && remaining <= 0) {
    return { ...base, reason: `Daily limit of ${LISTING_DAILY_LIMIT} already reached` };
  }

  const take = Math.max(0, Math.min(opts.limit ?? remaining, opts.dryRun ? 50 : remaining));
  const pages = await pickReadyPages(take);
  if (!pages.length) {
    return { ...base, reason: `No pages ready (need to be ${REVIEW_HOURS}h old with content and a contact)` };
  }

  const outcomes: SendQueueResult["outcomes"] = [];
  let sent = 0;
  let skipped = 0;

  for (const page of pages) {
    if (opts.dryRun) {
      outcomes.push({ to: page.email, name: page.name, sent: false, reason: "dry run" });
      continue;
    }
    const r = await sendListingInvite(page.id, { via: opts.via || "sendQueue" });
    if (r.ok) {
      sent++;
      outcomes.push({ to: r.to, name: page.name, sent: true, subject: r.subject });
    } else {
      skipped++;
      outcomes.push({ to: page.email, name: page.name, sent: false, reason: r.error });
    }
    if (page !== pages[pages.length - 1]) await sleep(SEND_DELAY_MS);
  }

  return {
    sent,
    skipped,
    attempted: pages.length,
    dailyLimit: LISTING_DAILY_LIMIT,
    sentToday: await invitesSentToday(),
    queueDepth: (await pickReadyPages(200)).length,
    outcomes,
  };
}

export type AutopilotStatus = {
  enabled: boolean;
  markets: string[];
  dailyLimit: number;
  buildPerRun: number;
  reviewHours: number;
  sentToday: number;
  readyToSend: number;
  inReview: number;
  invitedTotal: number;
  poolRemaining: number;
  daysOfRunway: number;
  queued: number;
  maxQueue: number;
  /** True when the queue is full, so tonight's build will deliberately do nothing. */
  buildPaused: boolean;
};

/** What the admin panel shows: is it on, is there fuel, did it move today. */
export async function listingAutopilotStatus(): Promise<AutopilotStatus> {
  const [sentToday, ready, pool, invitedTotal, queued] = await Promise.all([
    invitesSentToday(),
    pickReadyPages(500),
    candidatePoolSize(),
    prisma.outreachLead.count({ where: { status: LISTING_INVITED_STATUS } }),
    unsentPageCount(),
  ]);

  // "In review" is the part of the queue that isn't sendable yet. Counting
  // every page created in the last 12h instead reported 11 while only 2 were
  // actually waiting — a dashboard that overstates the backlog is worse than
  // no dashboard, because it makes a stalled autopilot look busy.
  const inReview = Math.max(0, queued - ready.length);
  return {
    enabled: autopilotEnabled(),
    markets: MARKETS,
    dailyLimit: LISTING_DAILY_LIMIT,
    buildPerRun: BUILD_PER_RUN,
    reviewHours: REVIEW_HOURS,
    sentToday,
    readyToSend: ready.length,
    inReview,
    invitedTotal,
    poolRemaining: pool,
    daysOfRunway: Math.floor((ready.length + pool) / Math.max(1, LISTING_DAILY_LIMIT)),
    queued,
    maxQueue: MAX_QUEUE,
    buildPaused: queued >= MAX_QUEUE,
  };
}
