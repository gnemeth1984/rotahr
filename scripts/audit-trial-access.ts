/**
 * Production safety check for the read-only gate.
 *
 * Answers one question: is this gate currently restricting anybody, and is
 * that correct? Run it after any change to trial logic.
 *
 *   bun run scripts/audit-trial-access.ts
 */
import { PrismaClient } from "@prisma/client";
import { computeAccess } from "../lib/billing/access";

const prisma = new PrismaClient();

(async () => {
  const rows = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      lsStatus: true,
      lsPlan: true,
      trialEndsAt: true,
    },
  });

  const tally: Record<string, number> = {};
  const blocked: typeof rows = [];

  for (const b of rows) {
    const a = computeAccess({
      lsStatus: b.lsStatus,
      trialEndsAt: b.trialEndsAt,
    });
    const key = `${a.mode} / ${a.reason}`;
    tally[key] = (tally[key] ?? 0) + 1;
    if (a.mode === "readonly") blocked.push(b);
  }

  console.log(`\nBusinesses: ${rows.length}`);
  console.log("\nAccess breakdown:");
  for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`);
  }

  console.log(`\nRead-only right now: ${blocked.length}`);
  for (const b of blocked) {
    console.log(
      `   - ${b.name} (${b.id}) status=${b.lsStatus} plan=${b.lsPlan} ends=${b.trialEndsAt?.toISOString()}`,
    );
  }

  const withDeadline = rows.filter((r) => r.trialEndsAt).length;
  console.log(
    `\nWith a trial deadline: ${withDeadline} — the rest are NULL and can never be restricted.`,
  );
  console.log();
})()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
