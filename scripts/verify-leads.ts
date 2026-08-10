/**
 * Batch-verify outreach lead mailboxes and store the verdicts.
 *
 * Must run from a machine with outbound port 25 (the sandbox has it; Vercel
 * blocks it), which is why this is a script and not a cron route.
 *
 *   npx tsx --env-file=.env.local scripts/verify-leads.ts --limit 200
 *   npx tsx --env-file=.env.local scripts/verify-leads.ts --country uk --limit 500
 *   npx tsx --env-file=.env.local scripts/verify-leads.ts --revalidate-bounced
 *
 * Flags:
 *   --limit N              how many to check (default 100)
 *   --country ie|uk        restrict to one market
 *   --revalidate-bounced   check leads marked bounced, to find ones that never
 *                          actually bounced (424 were marked during a spell when
 *                          the sending domain was unauthenticated, so every send
 *                          errored before delivery was ever attempted)
 *   --recheck-days N       re-verify leads whose verdict is older than N days
 *                          (default 90; mailboxes are created and deleted)
 *   --verdict V            re-probe leads currently holding verdict V, ignoring
 *                          how recently it was set. Mainly --verdict unknown:
 *                          those probes were inconclusive rather than negative,
 *                          and a slower second pass resolves most of them.
 *   --dry                  probe and print, write nothing
 */
import { prisma } from "@/lib/db";
import { verifyEmails } from "@/lib/outreach/smtp-verify";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : fallback;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const limit = Number(arg("limit", "100"));
  const country = arg("country");
  const revalidateBounced = has("revalidate-bounced");
  const verdictFilter = arg("verdict");
  const recheckDays = Number(arg("recheck-days", "90"));
  const dry = has("dry");
  const staleBefore = new Date(Date.now() - recheckDays * 86_400_000);

  const where = revalidateBounced
    ? {
        // Only the ones with no send record: a lead with a real OutreachSend row
        // genuinely bounced and should stay retired.
        bouncedAt: { not: null },
        sends: { none: {} },
        ...(country ? { country } : {}),
      }
    : verdictFilter
      ? {
          // Re-probe a specific verdict regardless of how recently it was set.
          // `unknown` is the case that matters: it means the probe was
          // inconclusive (timeout, greylisting, rate limit), not that the
          // mailbox is bad, and a quieter second pass usually resolves it.
          status: { notIn: ["unsubscribed", "replied", "converted", "bounced"] },
          emailVerdict: verdictFilter,
          ...(country ? { country } : {}),
        }
      : {
          status: { notIn: ["unsubscribed", "replied", "converted", "bounced"] },
          OR: [{ verifiedAt: null }, { verifiedAt: { lt: staleBefore } }],
          ...(country ? { country } : {}),
        };

  const leads = await prisma.outreachLead.findMany({
    where,
    select: { id: true, email: true, country: true },
    take: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100,
    orderBy: { createdAt: "asc" },
  });

  console.log(
    `Verifying ${leads.length} lead(s)${country ? ` in ${country}` : ""}${
      revalidateBounced ? " [revalidating bounced-with-no-send]" : ""
    }${verdictFilter ? ` [re-probing verdict=${verdictFilter}]` : ""}${dry ? " [dry run]" : ""}\n`
  );
  if (!leads.length) return;

  const byEmail = new Map(leads.map((l) => [l.email.toLowerCase(), l]));
  const tally: Record<string, number> = {};

  const results = await verifyEmails(
    leads.map((l) => l.email),
    {
      concurrency: 4,
      onResult: (r, done, total) => {
        tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
        const flag = r.verdict === "dead" || r.verdict === "no-mx" ? "x" : " ";
        console.log(
          `[${String(done).padStart(4)}/${total}] ${flag} ${r.verdict.padEnd(9)} ${r.email.padEnd(44)} ${r.detail.slice(0, 60)}`
        );
      },
    }
  );

  if (dry) {
    console.log("\nDry run — nothing written.");
    console.log("Tally:", tally);
    return;
  }

  let written = 0;
  let revived = 0;
  for (const r of results) {
    const lead = byEmail.get(r.email);
    if (!lead) continue;

    const data: Record<string, unknown> = {
      emailVerdict: r.verdict,
      verifyDetail: r.detail,
      verifiedAt: new Date(),
    };

    // A lead marked bounced that now verifies as reachable never actually
    // bounced — clear the flag and put it back in the sequence. Anything still
    // dead keeps its retirement.
    if (revalidateBounced && (r.verdict === "ok" || r.verdict === "catch-all" || r.verdict === "unknown")) {
      data.bouncedAt = null;
      data.status = "new";
      revived++;
    }

    await prisma.outreachLead.update({ where: { id: lead.id }, data });
    written++;
  }

  console.log(`\nWrote ${written} verdict(s). Tally:`, tally);
  if (revalidateBounced) console.log(`Returned ${revived} lead(s) to the sequence.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
