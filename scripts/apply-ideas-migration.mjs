import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const prisma = new PrismaClient();
const sql = readFileSync(
  "prisma/migrations/20260816120000_navigator_ideas/migration.sql",
  "utf8"
);

const statements = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  console.log("->", stmt.slice(0, 90));
  await prisma.$executeRawUnsafe(stmt);
}

const [col] = await prisma.$queryRawUnsafe(
  `SELECT column_name, data_type, column_default FROM information_schema.columns
   WHERE table_name = 'NavProfile' AND column_name = 'ideasEnabled'`
);
const idx = await prisma.$queryRawUnsafe(
  `SELECT indexname FROM pg_indexes WHERE tablename = 'NavTask' AND indexname = 'NavTask_userId_project_status_idx'`
);
console.log("column:", col);
console.log("index:", idx);

await prisma.$disconnect();
