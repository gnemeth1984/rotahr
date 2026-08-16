/**
 * End-to-end check of the daily ideas engine against the real database.
 *   bun run scripts/verify-ideas.ts
 */
import { prisma } from "../lib/db";
import { generateIdeas, tooSimilar, IDEAS_PROJECT, INBOX_LIMIT } from "../lib/navigator/ideas";

const USER_ID = "cmr1vwcm80001v0jojd3a1o7t";

// Duplicate detection, before spending a token on anything.
const dupCases: [string, string, boolean][] = [
  ["Add a first-run HACCP checklist wizard", "Build a first run HACCP checklist wizard", true],
  ["Add a first-run HACCP checklist wizard", "Ship a Slack integration for shift swaps", false],
  ["Fix the /admin real-business count", "Correct real business counting in admin analytics", false],
];
for (const [a, b, want] of dupCases) {
  const got = tooSimilar(a, b);
  console.log(`${got === want ? "PASS" : "FAIL"}  dupe "${a.slice(0, 32)}…" vs "${b.slice(0, 32)}…" -> ${got}`);
}

const before = await prisma.navTask.count({
  where: { userId: USER_ID, status: "draft", project: IDEAS_PROJECT },
});
console.log(`\nIdeas already waiting: ${before} / ${INBOX_LIMIT}`);

const out = await generateIdeas(USER_ID);
console.log("\nresult:", JSON.stringify(out, null, 2));

const created = await prisma.navTask.findMany({
  where: { userId: USER_ID, status: "draft", project: IDEAS_PROJECT },
  orderBy: { createdAt: "desc" },
  take: 4,
  select: { title: true, notes: true, effortMins: true, priority: true, startTrigger: true },
});
console.log("\n--- inbox top ---");
for (const c of created) {
  console.log(`\n• ${c.title}  [${c.priority}, ~${c.effortMins}m]`);
  console.log(`  ${c.notes?.replace(/\n+/g, "\n  ")}`);
  console.log(`  first step: ${c.startTrigger}`);
}

await prisma.$disconnect();
