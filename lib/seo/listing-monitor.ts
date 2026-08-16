import { prisma } from "@/lib/prisma";

/**
 * Weekly check that the listings Rotahr has actually earned are still there.
 *
 * WHY THIS EXISTS
 * A directory profile is not a one-off purchase. Sites get redesigned, free
 * tiers get pruned, profiles get archived for inactivity, and editors delete
 * old roundups. None of that generates a notification. Without a check, a link
 * that quietly disappeared is indistinguishable from one that is still working,
 * and the only symptom is traffic that never arrives — which is invisible when
 * the baseline is already near zero.
 *
 * WHAT COUNTS AS ALIVE
 * The page must load AND still mention rotahr.com. A 200 on its own is not
 * enough: the most common failure is not a dead page, it is a live page that
 * has been re-cut and no longer contains the listing. Checking for the domain
 * string catches both.
 *
 * WHY THREE STRIKES
 * A single failed fetch is usually the target being briefly down, rate-limiting
 * a datacenter IP, or blocking a bot user-agent. Demoting a real listing on one
 * bad read would throw away work and put a false task in Gabor's queue. Three
 * consecutive weekly failures is roughly three weeks of absence, which is a
 * real disappearance.
 *
 * WHY 403/429 IS NOT A FAILURE AT ALL
 * The big directories — Capterra and G2 among them — sit behind bot protection
 * that returns 403 to any datacenter IP no matter what user-agent it claims.
 * Those are exactly the listings worth the most, so counting a block as a strike
 * would reliably demote the best rows and leave the junk ones alive. A block is
 * recorded as inconclusive: the check date moves, the strike count does not.
 */

export const STRIKES_BEFORE_DEMOTION = 3;

const TIMEOUT_MS = 15_000;

/** A browser UA. Several directories 403 anything that self-identifies as a bot. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * Statuses that mean "we were not allowed to look", not "it is gone".
 * 403 bot-wall, 429 rate limit, 503 shield/maintenance.
 */
const INCONCLUSIVE = new Set([401, 403, 429, 503]);

export type CheckOutcome = {
  id: string;
  name: string;
  url: string;
  ok: boolean;
  /** True when we could not read the page at all — neither alive nor dead. */
  inconclusive?: boolean;
  /** http | missing_mention | fetch_error — why it failed, when it did. */
  why?: string;
  status?: number;
  failures: number;
  demoted?: boolean;
};

/** Does this HTML still point at us? */
export function mentionsRotahr(html: string): boolean {
  const h = html.toLowerCase();
  return h.includes("rotahr.com") || h.includes("rotahr");
}

async function fetchPage(url: string): Promise<{ status: number; html: string } | { error: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    const html = await res.text().catch(() => "");
    return { status: res.status, html };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

export type MonitorResult = {
  ok: boolean;
  checked: number;
  alive: number;
  failed: number;
  blocked: number;
  demoted: string[];
  recovered: string[];
  outcomes: CheckOutcome[];
};

/**
 * Check every row that claims to be live.
 *
 * Only `status: "live"` rows with a `liveUrl` are checked. A row still sitting
 * at "new" or "sent" has nothing to monitor — there is no listing yet — and
 * fetching those pages weekly would be a pointless load on targets we are
 * about to ask a favour of.
 */
export async function monitorListings(limit = 60): Promise<MonitorResult> {
  const rows = await prisma.linkProspect.findMany({
    where: { status: "live", liveUrl: { not: null } },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }, { weight: "desc" }],
    take: limit,
    select: { id: true, name: true, liveUrl: true, checkFailures: true },
  });

  const out: MonitorResult = {
    ok: true,
    checked: 0,
    alive: 0,
    failed: 0,
    blocked: 0,
    demoted: [],
    recovered: [],
    outcomes: [],
  };

  for (const row of rows) {
    const url = row.liveUrl!;
    const res = await fetchPage(url);
    out.checked += 1;

    let ok = false;
    let inconclusive = false;
    let why: string | undefined;
    let status: number | undefined;

    if ("error" in res) {
      why = `fetch_error: ${res.error.slice(0, 120)}`;
    } else {
      status = res.status;
      if (INCONCLUSIVE.has(res.status)) {
        inconclusive = true;
        why = `blocked (http ${res.status}) - not counted against the listing`;
      } else if (res.status >= 400) {
        why = `http ${res.status}`;
      } else if (!mentionsRotahr(res.html)) {
        why = "page loads but no longer mentions Rotahr";
      } else {
        ok = true;
      }
    }

    // A block leaves the strike count exactly where it was: we learned nothing.
    const failures = inconclusive ? row.checkFailures : ok ? 0 : row.checkFailures + 1;
    const demote = !ok && !inconclusive && failures >= STRIKES_BEFORE_DEMOTION;

    await prisma.linkProspect.update({
      where: { id: row.id },
      data: {
        lastCheckedAt: new Date(),
        ...(inconclusive ? {} : { lastCheckOk: ok }),
        checkFailures: failures,
        // Demote back to "sent" rather than "rejected": the relationship and the
        // submission still happened, only the published link is gone. "sent"
        // puts it back in the follow-up path, which is the correct next move.
        ...(demote ? { status: "sent", liveUrl: null, liveAt: null } : {}),
        ...(!ok && !inconclusive
          ? {
              notes: `${new Date().toISOString().slice(0, 10)} check failed (${failures}x): ${why}`.slice(
                0,
                1000
              ),
            }
          : {}),
      },
    });

    if (inconclusive) {
      out.blocked += 1;
    } else if (ok) {
      out.alive += 1;
      if (row.checkFailures > 0) out.recovered.push(row.name);
    } else {
      out.failed += 1;
      if (demote) out.demoted.push(row.name);
    }

    out.outcomes.push({
      id: row.id,
      name: row.name,
      url,
      ok,
      inconclusive: inconclusive || undefined,
      why,
      status,
      failures,
      demoted: demote || undefined,
    });
  }

  return out;
}
