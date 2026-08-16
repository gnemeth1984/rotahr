/**
 * Regression guard for the free-visibility autopilot.
 *
 * The dangerous failure here is silent and slow: the discovery job quietly
 * starts accepting link farms, or the monitor quietly demotes listings that are
 * actually live because the target blocks datacenter IPs. Neither produces an
 * error — both just degrade the queue until Gabor stops trusting it. These
 * assertions pin the two gates that stop that happening.
 *
 * Run: export $(grep -E '^DATABASE_URL=' .env | xargs); bun run scripts/verify-listing-autopilot.ts
 */
import { prisma } from "../lib/db";
import {
  isPlausibleTarget,
  rootOf,
  queriesForWeek,
  MIN_WEIGHT,
} from "../lib/seo/listing-discovery";
import { mentionsRotahr, STRIKES_BEFORE_DEMOTION } from "../lib/seo/listing-monitor";
import { OPEN_LIMIT, VISIBILITY_PROJECT } from "../lib/seo/listing-tasks";
import { CAPTERRA_URL, hasCapterraListing } from "../lib/capterra";

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const hit = (title: string, link: string) => ({ title, link, snippet: "" });

async function main() {
  console.log("\nDiscovery filters");
  ok(
    "listicles are rejected",
    !isPlausibleTarget(hit("Top 25 free SaaS directories in 2026", "https://someblog.io/top-25")),
    "a post about directories is not a directory"
  );
  ok(
    "social/forum hosts are rejected",
    !isPlausibleTarget(hit("Submit your startup", "https://www.reddit.com/r/startups/x")) &&
      !isPlausibleTarget(hit("Submit", "https://medium.com/@x/submit")),
    "reddit + medium"
  );
  ok(
    "our own domain is rejected",
    !isPlausibleTarget(hit("Rotahr", "https://rotahr.com/landing")),
    "no self-links"
  );
  ok(
    "a plausible directory passes",
    isPlausibleTarget(hit("Add your product — SaaSHub", "https://www.saashub.com/submit")),
    "saashub"
  );
  ok("malformed URLs are rejected", !isPlausibleTarget(hit("x", "not a url")));

  console.log("\nDeduping");
  ok(
    "root strips www and path",
    rootOf("https://www.Example.com/a/b?c=1") === "example.com",
    rootOf("https://www.Example.com/a/b?c=1")
  );
  ok(
    "two pages on one site share a root",
    rootOf("https://g2.com/products/x") === rootOf("https://www.g2.com/categories/y")
  );

  console.log("\nBudget + floors");
  ok("weight floor is at least 4", MIN_WEIGHT >= 4, `MIN_WEIGHT=${MIN_WEIGHT}`);
  ok("weekly query slice is small", queriesForWeek(new Date()).length <= 6);
  ok(
    "the slice rotates week to week",
    JSON.stringify(queriesForWeek(new Date("2026-08-18"))) !==
      JSON.stringify(queriesForWeek(new Date("2026-08-25"))),
    "otherwise it re-searches the same page forever"
  );

  console.log("\nMonitor");
  ok("a page mentioning us is alive", mentionsRotahr("<p>Try Rotahr for rotas</p>"));
  ok("case does not matter", mentionsRotahr("visit ROTAHR.COM"));
  ok(
    "a recut page is not alive",
    !mentionsRotahr("<p>Top hospitality tools: Deputy, Planday</p>"),
    "a bare 200 would have missed this"
  );
  ok("three strikes before demotion", STRIKES_BEFORE_DEMOTION >= 3);

  console.log("\nHand-out");
  ok("at most two tasks open at once", OPEN_LIMIT <= 2, `OPEN_LIMIT=${OPEN_LIMIT}`);

  console.log("\nLive data");
  const [total, byStatus, withPitch, capterra, openTasks] = await Promise.all([
    prisma.linkProspect.count(),
    prisma.linkProspect.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.linkProspect.count({ where: { pitch: { not: null } } }),
    prisma.linkProspect.findFirst({ where: { name: "Capterra" } }),
    prisma.navTask.count({
      where: { project: VISIBILITY_PROJECT, status: { in: ["todo", "doing"] }, archivedAt: null },
    }),
  ]);
  console.log(
    `  prospects: ${total} — ${byStatus.map((s) => `${s.status}=${s._count._all}`).join(", ")}`
  );
  console.log(`  with copy written: ${withPitch}`);
  console.log(`  open visibility tasks: ${openTasks}`);

  ok("the new schema fields exist", withPitch >= 0, "query would throw otherwise");
  ok("Capterra is marked live", capterra?.status === "live", capterra?.liveUrl ?? "no row");
  ok(
    "the Capterra link is wired into the site",
    hasCapterraListing() && !!CAPTERRA_URL?.includes("capterra.com/p/"),
    String(CAPTERRA_URL)
  );
  ok(
    "the open-task cap is respected",
    openTasks <= OPEN_LIMIT,
    `${openTasks} open, cap ${OPEN_LIMIT}`
  );

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
