/**
 * Convert sourced OSM venues that turn out to have a website into sales leads.
 *
 *   npx tsx --env-file=.env.local scripts/leads-from-candidates.ts --limit 20 --dry
 *   npx tsx --env-file=.env.local scripts/leads-from-candidates.ts --limit 20
 *
 * Sends nothing. Every lead created is parked on `unverified`, which appears in
 * no branch of the send query, so it cannot be mailed until it has been probed
 * by scripts/verify-leads.ts and deliberately promoted.
 */
import { prisma } from "@/lib/prisma";
import { convertBatch, UNVERIFIED_STATUS } from "@/lib/outreach/candidate-to-lead";

async function main() {
  const dry = process.argv.includes("--dry");
  const i = process.argv.indexOf("--limit");
  const limit = i !== -1 ? Number(process.argv[i + 1]) : 10;
  const c = process.argv.indexOf("--country");
  const country = c !== -1 ? process.argv[c + 1] : undefined;

  if (!Number.isFinite(limit) || limit <= 0) {
    console.error("--limit must be a positive number");
    process.exit(1);
  }

  console.log(`converting ${limit} candidate(s)${country ? ` in ${country}` : ""}${dry ? " — DRY RUN" : ""}\n`);

  const label: Record<string, string> = {
    lead_created: "LEAD        ",
    already_a_lead: "ALREADY LEAD",
    no_email: "NO EMAIL    ",
    dead_domain: "DEAD DOMAIN ",
    no_website: "NO WEBSITE  ",
    collision: "COLLISION   ",
    error: "ERROR       ",
  };

  // A stray HTTP/2 session error from someone else's web server is emitted on
  // the session rather than rejected at the await, so it arrives as an uncaught
  // exception and takes the process with it. The database writes are already
  // committed by then, so the only thing lost is the report — logging and
  // carrying on is strictly better than dying.
  process.on("uncaughtException", (err) => {
    console.log(`    (ignored socket error: ${(err as Error).message.slice(0, 80)})`);
  });

  const { outcomes, counts, leadsBefore, leadsAfter } = await convertBatch(limit, {
    dry,
    country,
    onOutcome: (o, n, total) => {
      const where = o.city ? `, ${o.city}` : "";
      console.log(`[${n}/${total}] ${label[o.result]} ${o.candidate}${where}`);
      if (o.email) console.log(`    → ${o.email}  (${o.website})`);
      else if (o.website) console.log(`    ${o.website} — ${o.detail ?? ""}`);
      else if (o.detail) console.log(`    ${o.detail}`);
    },
  });

  console.log("\ncounts:", counts);
  console.log(`leads: ${leadsBefore} → ${leadsAfter} (+${leadsAfter - leadsBefore})`);

  const created = counts.lead_created ?? 0;
  const rate = outcomes.length ? Math.round((100 * created) / outcomes.length) : 0;
  console.log(`lead rate: ${created}/${outcomes.length} (${rate}%)`);

  const pool = await prisma.venueCandidate.count({ where: { status: "new", hasWebsite: null } });
  console.log(`unresearched candidates remaining: ${pool}`);
  console.log(`→ at ${rate}% the pool would yield roughly ${Math.round((pool * rate) / 100)} more leads`);

  const parked = await prisma.outreachLead.count({ where: { status: UNVERIFIED_STATUS } });
  console.log(`\nparked on '${UNVERIFIED_STATUS}' (cannot be sent to): ${parked}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
