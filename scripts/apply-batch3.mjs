// One-off: apply the batch-3 Navigator migration to Neon and record it in
// _prisma_migrations, since Vercel only ever runs `prisma generate`.
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const NAME = "20260815200000_navigator_batch3";
const FILE = `prisma/migrations/${NAME}/migration.sql`;
const prisma = new PrismaClient();

const sql = readFileSync(FILE, "utf8");
const statements = sql
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter((s) => s && !s.split("\n").every((l) => l.trim().startsWith("--")));

let ran = 0;
for (const st of statements) {
  await prisma.$executeRawUnsafe(st);
  ran++;
}

const checksum = createHash("sha256").update(sql).digest("hex");
const already = await prisma.$queryRawUnsafe(
  `SELECT id FROM "_prisma_migrations" WHERE migration_name = $1`,
  NAME
);
if (!already.length) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     VALUES ($1, $2, now(), $3, NULL, NULL, now(), $4)`,
    randomUUID(),
    checksum,
    NAME,
    ran
  );
}

// Verify, rather than trust.
const cols = await prisma.$queryRawUnsafe(
  `SELECT table_name, column_name FROM information_schema.columns
   WHERE (table_name = 'NavProfile' AND column_name IN ('bufferShifts','preShiftMins','postShiftMins','ritualsEnabled'))
      OR (table_name = 'NavTask' AND column_name = 'archivedAt')
   ORDER BY table_name, column_name`
);
const tables = await prisma.$queryRawUnsafe(
  `SELECT table_name FROM information_schema.tables WHERE table_name IN ('NavSnooze','NavRitualLog') ORDER BY table_name`
);
console.log("statements run:", ran);
console.log("columns:", cols);
console.log("tables:", tables);
await prisma.$disconnect();
