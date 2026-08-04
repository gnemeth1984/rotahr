import { auditSite } from "./lib/seo/audit";
import { writeFileSync } from "fs";
async function main() {
  const domain = process.argv[2] || "rotahr.com";
  const r = await auditSite(domain, { maxPages: 25, crawlBudgetMs: 90000 });
  writeFileSync("/tmp/audit2.json", JSON.stringify(r, null, 2));
  console.log("score", r.score, "pages", r.pagesCrawled, "ms", r.durationMs);
  console.log(r.scoreBreakdown);
  console.log("psi", r.psi?.performance, r.psi?.seo, r.psi?.accessibility, r.psi?.bestPractices);
  console.log("ai", r.ai);
  for (const i of r.issues) console.log(" ", i.severity, i.code, "|", i.title);
  if (r.warnings?.length) console.log("warnings", r.warnings);
}
main().catch((e) => { console.error(e); process.exit(1); });
