/**
 * Apply the hand rewrites in scripts/seo-rewrites/ to live blog posts, in place.
 *
 * Keeps the slug, `published` and `createdAt` (so the URL and publish date do
 * not change), sets refreshedAt to now, recomputes wordCount, and adds the
 * `manual` tag so the autopilot leaves the post alone afterwards. Refuses to
 * write a rewrite that fails checkRotahrFacts.
 *
 * Dry run by default. Pass --apply to write; --only=<slug> to limit.
 * Run: npx tsx scripts/apply-seo-rewrites.ts [--apply] [--only=slug]
 */
import { prisma } from "../lib/prisma";
import { checkRotahrFacts } from "../lib/seo/product-facts";
import { withManualTag } from "../lib/seo/manual-posts";
import { REWRITES } from "./seo-rewrites";

const APPLY = process.argv.includes("--apply");
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

async function main() {
  let failed = 0;
  for (const r of REWRITES) {
    if (ONLY && r.slug !== ONLY) continue;
    const text = [r.title, r.metaTitle, r.metaDesc, r.excerpt, r.content, JSON.stringify(r.faq)].join("\n\n");
    const problems = checkRotahrFacts(text);
    if (problems.length) {
      failed++;
      console.log(`! ${r.slug}: fails product facts\n${problems.map((p) => "   " + p).join("\n")}`);
      continue;
    }
    if (r.metaTitle.length > 60) console.log(`  warn ${r.slug}: metaTitle ${r.metaTitle.length} chars`);
    if (r.metaDesc.length > 160) console.log(`  warn ${r.slug}: metaDesc ${r.metaDesc.length} chars`);

    const post = await prisma.blogPost.findUnique({ where: { slug: r.slug } });
    if (!post) {
      failed++;
      console.log(`! ${r.slug}: no such post`);
      continue;
    }
    const wordCount = r.content.split(/\s+/).filter(Boolean).length;
    console.log(
      `${APPLY ? "write" : "would write"} ${r.slug}\n` +
        `   title    ${post.title}\n         -> ${r.title}\n` +
        `   meta     ${post.metaTitle}\n         -> ${r.metaTitle}\n` +
        `   words    ${post.wordCount ?? "?"} -> ${wordCount}`,
    );
    if (!APPLY) continue;
    await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        title: r.title,
        metaTitle: r.metaTitle,
        metaDesc: r.metaDesc,
        excerpt: r.excerpt,
        keyword: r.keyword,
        tags: withManualTag(r.tags),
        content: r.content,
        faq: JSON.stringify(r.faq),
        wordCount,
        refreshedAt: new Date(),
        refreshCount: { increment: 1 },
      },
    });
  }
  if (failed) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
