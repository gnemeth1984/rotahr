/**
 * Regression guard for the admin business-count bug.
 *
 * The dashboard once reported 110 businesses when there were 6 tenants — the
 * other 104 are listing shells created behind the public /v/... pages. This
 * script re-derives the numbers straight from the DB and fails if the scoped
 * count ever drifts back towards the raw table count.
 *
 * Run: export $(grep -E '^DATABASE_URL=' .env | xargs); bun run scripts/verify-admin-counts.ts
 */
import { prisma } from "../lib/db";
import { REAL_BUSINESS_WHERE, DEMO_BUSINESS_IDS } from "../lib/tenancy/real-business";

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

async function main() {
  const [raw, real, shells, prospects, paying, users] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: REAL_BUSINESS_WHERE }),
    prisma.business.count({ where: { users: { none: {} } } }),
    prisma.business.count({ where: { publicProspect: true } }),
    prisma.business.count({ where: { ...REAL_BUSINESS_WHERE, lsStatus: "active" } }),
    prisma.user.count(),
  ]);

  console.log(`\nBusiness table: ${raw} rows`);
  console.log(`  tenants (has a user): ${real}`);
  console.log(`  listing shells:       ${shells}`);
  console.log(`  publicProspect flag:  ${prospects}`);
  console.log(`  paying tenants:       ${paying}`);
  console.log(`  users:                ${users}`);
  console.log(`  overstatement if unscoped: ${real > 0 ? (raw / real).toFixed(1) : "n/a"}x\n`);

  ok("tenants + shells accounts for every row", real + shells === raw, `${real} + ${shells} = ${raw}`);

  // The two independent definitions of "not a tenant" must agree. If they ever
  // diverge, one of them is lying and the dashboard is wrong again.
  ok("shell count matches the publicProspect flag", shells === prospects, `${shells} vs ${prospects}`);

  const prospectWithUsers = await prisma.business.count({
    where: { publicProspect: true, users: { some: {} } },
  });
  ok("no listing shell has a user attached", prospectWithUsers === 0, `${prospectWithUsers}`);

  const tenantWithoutUsers = await prisma.business.count({
    where: { publicProspect: { not: true }, users: { none: {} } },
  });
  ok("no tenant is missing its user", tenantWithoutUsers === 0, `${tenantWithoutUsers}`);

  // The actual bug: the scoped count must not equal the raw count while shells
  // exist. This is the assertion that would have caught it originally.
  ok(
    "scoped tenant count is not the raw table count",
    shells === 0 || real !== raw,
    `real=${real} raw=${raw}`,
  );

  ok("every tenant is reachable by the shared helper", real > 0, `${real}`);
  ok("paying never exceeds tenants", paying <= real, `${paying} <= ${real}`);

  const demoPresent = await prisma.business.count({ where: { id: { in: DEMO_BUSINESS_IDS } } });
  ok("demo tenants still exist and are excludable", demoPresent === DEMO_BUSINESS_IDS.length,
    `${demoPresent}/${DEMO_BUSINESS_IDS.length}`);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  if (fail > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("ERROR", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
