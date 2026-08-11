/**
 * Re-apply triage to already-sourced rows after the chain list changes.
 *
 * Only ever moves a row from `new` to `skipped`. A row that has progressed to
 * `enriched`, `built` or `rejected` is left alone: re-triage is for tightening
 * the filter, not for reversing a decision something downstream has acted on.
 *
 *   npx tsx --env-file=.env.local scripts/retriage-candidates.ts --dry
 */
import { prisma } from "@/lib/prisma";
import { isChain } from "@/lib/outreach/osm-source";

async function main() {
  const dry = process.argv.includes("--dry");
  const rows = await prisma.venueCandidate.findMany({
    where: { status: "new" },
    select: { id: true, name: true },
  });

  const hits = rows.filter((r) => isChain(r.name));
  console.log(`${hits.length} of ${rows.length} 'new' rows now match the chain list`);

  const byName: Record<string, number> = {};
  for (const h of hits) byName[h.name] = (byName[h.name] ?? 0) + 1;
  for (const [n, c] of Object.entries(byName).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${n}: ${c}`);
  }

  if (dry) return console.log("\nDRY RUN — nothing written");

  const res = await prisma.venueCandidate.updateMany({
    where: { id: { in: hits.map((h) => h.id) } },
    data: { status: "skipped", skipReason: "chain" },
  });
  console.log(`\nmarked ${res.count} rows as skipped (chain)`);
  const left = await prisma.venueCandidate.count({ where: { status: "new" } });
  console.log(`usable candidates remaining: ${left}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
