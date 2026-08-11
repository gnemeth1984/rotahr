/**
 * Research sourced venues to find out which are actually buildable.
 *
 *   npx tsx --env-file=.env.local scripts/research-venues.ts --limit 15
 *   npx tsx --env-file=.env.local scripts/research-venues.ts --limit 15 --dry
 *
 * Publishes nothing and emails nobody. Records a verdict per row so we can see
 * the real conversion rate from "sourced" to "a page we could stand behind"
 * before spending model calls on thousands of them.
 */
import { prisma } from "@/lib/prisma";
import { researchBatch } from "@/lib/outreach/venue-research";

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

  console.log(`researching ${limit} candidate(s)${country ? ` in ${country}` : ""}${dry ? " — DRY RUN" : ""}\n`);

  const { outcomes, counts } = await researchBatch(limit, { dry, country });

  const label: Record<string, string> = {
    has_own_site: "HAS OWN SITE  → retired to pitch sequence",
    buildable: "BUILDABLE     → own-channel description found",
    social_only: "SOCIAL ONLY   → contact found, no description",
    nothing: "NOTHING       → no own-channel facts exist",
    collision: "COLLISION     → sources are a different venue",
    error: "ERROR",
  };

  for (const o of outcomes) {
    console.log(`${label[o.result]}  ${o.name}${o.city ? `, ${o.city}` : ""}`);
    if (o.detail) console.log(`    ${o.detail}`);
  }

  console.log("\ncounts:", counts);

  const buildable = counts.buildable ?? 0;
  const pct = outcomes.length ? Math.round((100 * buildable) / outcomes.length) : 0;
  console.log(`buildable rate: ${buildable}/${outcomes.length} (${pct}%)`);

  const pool = await prisma.venueCandidate.count({ where: { status: "new", hasWebsite: null } });
  console.log(`unresearched candidates remaining: ${pool}`);
  console.log(`→ at ${pct}% this pool would yield roughly ${Math.round((pool * pct) / 100)} publishable pages`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
