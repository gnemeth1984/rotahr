/**
 * Source venues that have no website, from OpenStreetMap, into VenueCandidate.
 *
 *   npx tsx --env-file=.env.local scripts/source-osm-venues.ts --dry
 *   npx tsx --env-file=.env.local scripts/source-osm-venues.ts
 *   npx tsx --env-file=.env.local scripts/source-osm-venues.ts --box munster-west
 *
 * Publishes nothing and emails nobody. Safe to re-run: rows are keyed on the
 * OSM ref, so a second pass fills blanks rather than duplicating.
 */
import { prisma } from "@/lib/prisma";
import { IRELAND_BOXES, sourceBox, candidateStats } from "@/lib/outreach/osm-source";

async function main() {
  const dry = process.argv.includes("--dry");
  const only = process.argv.includes("--box")
    ? process.argv[process.argv.indexOf("--box") + 1]
    : null;

  const boxes = only ? IRELAND_BOXES.filter((b) => b.label === only) : IRELAND_BOXES;
  if (boxes.length === 0) {
    console.error(`no box named "${only}". Known: ${IRELAND_BOXES.map((b) => b.label).join(", ")}`);
    process.exit(1);
  }

  if (dry) console.log("DRY RUN — no writes\n");

  const totals = { fetched: 0, created: 0, updated: 0, skipped: 0, dupes: 0 };

  for (const box of boxes) {
    process.stdout.write(`${box.label} (${box.country}) … `);
    try {
      const s = await sourceBox(box, { dry });
      totals.fetched += s.fetched;
      totals.created += s.created;
      totals.updated += s.updated;
      totals.skipped += s.skipped;
      totals.dupes += s.duplicateOfLead;
      console.log(
        `fetched ${s.fetched}, new ${s.created}, updated ${s.updated}, skipped ${s.skipped}, dupes ${s.duplicateOfLead}`
      );
    } catch (err) {
      console.log(`FAILED — ${(err as Error).message}`);
    }
    // Overpass is a donated public service; one query at a time, with a pause.
    if (!dry) await new Promise((r) => setTimeout(r, 4000));
  }

  console.log("\ntotals:", totals);

  if (!dry) {
    const stats = await candidateStats();
    console.log("candidate table:", stats.byStatus);
    console.log("usable now — with a phone:", stats.withPhone, "| with a social page:", stats.withSocial);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
