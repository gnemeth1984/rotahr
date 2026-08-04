/**
 * Turns raw crawl data into prioritised, actionable issues.
 *
 * Scoring rule: priority comes only from what we actually observed. There are no
 * invented search volumes or difficulty scores anywhere in here — an operator can
 * trace every number back to a crawled page.
 */

import type {
  AiReadiness,
  AuditReport,
  Issue,
  IssueCategory,
  PageResult,
  PsiResult,
  RobotsInfo,
  SitemapInfo,
  Severity,
} from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 12,
  warning: 5,
  notice: 1.5,
  pass: 0,
};

function isQuestion(s: string): boolean {
  return (
    /\?$/.test(s.trim()) ||
    /^(how|what|why|when|where|which|who|can|do|does|is|are|should)\b/i.test(s.trim())
  );
}

/** True when the opening paragraph plausibly answers the heading directly. */
function answersDirectly(page: PageResult): boolean {
  if (!page.firstParagraph || !page.h1.length) return false;
  const p = page.firstParagraph.trim();
  if (p.length < 40) return false;
  // A direct answer states something; it does not open by restating the question.
  if (isQuestion(p.split(/[.!?]/)[0] ?? "")) return false;
  const heading = page.h1[0].toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const words = heading.split(/\s+/).filter((w) => w.length > 4);
  if (!words.length) return true;
  const lower = p.toLowerCase();
  const hits = words.filter((w) => lower.includes(w)).length;
  // Echoing key nouns from the heading early is the citation-friendly pattern.
  return hits >= Math.min(2, words.length);
}

export function buildAiReadiness(
  pages: PageResult[],
  robots: RobotsInfo,
  llmsTxt: { found: boolean; bytes: number },
): AiReadiness {
  const html = pages.filter((p) => p.status === 200 && p.contentType.includes("html"));
  return {
    llmsTxt: llmsTxt.found,
    llmsTxtBytes: llmsTxt.bytes,
    answerShapedPages: html.filter(answersDirectly).length,
    questionHeadings: html.filter((p) => [...p.h1, ...p.h2].some(isQuestion)).length,
    faqSchemaPages: html.filter((p) => p.schemaTypes.some((t) => /FAQPage|Question/i.test(t))).length,
    blockedAiCrawlers: Object.entries(robots.aiCrawlers)
      .filter(([, v]) => v === "blocked")
      .map(([k]) => k),
    hasTables: 0,
  };
}

export function analyse(input: {
  origin: string;
  pages: PageResult[];
  robots: RobotsInfo;
  sitemap: SitemapInfo;
  psi: PsiResult | null;
  ai: AiReadiness;
}): { issues: Issue[]; score: number; breakdown: Record<IssueCategory, number> } {
  const { origin, pages, robots, sitemap, psi, ai } = input;
  const issues: Issue[] = [];
  const ok = pages.filter((p) => p.status === 200 && p.contentType.includes("html"));

  const add = (i: Issue) => issues.push(i);

  // ── Technical ────────────────────────────────────────────────────────────
  const serverErrors = pages.filter((p) => p.status >= 500);
  if (serverErrors.length) {
    add({
      code: "server-errors",
      category: "technical",
      severity: "critical",
      title: `${serverErrors.length} page${serverErrors.length > 1 ? "s" : ""} returning a server error`,
      detail: "Google drops pages that repeatedly return 5xx, and users see a broken site.",
      urls: serverErrors.map((p) => p.url).slice(0, 20),
      fix: "Check server logs for these routes and fix the underlying exception.",
      priority: 100,
    });
  }

  const notFound = pages.filter((p) => p.status === 404);
  if (notFound.length) {
    add({
      code: "broken-internal-links",
      category: "technical",
      severity: "critical",
      title: `${notFound.length} internal link${notFound.length > 1 ? "s" : ""} point to a 404`,
      detail: "Broken internal links waste crawl budget and strand visitors.",
      urls: notFound.map((p) => p.url).slice(0, 20),
      fix: "Update or remove the linking anchor, or add a 301 to the correct URL.",
      priority: 92,
    });
  }

  const failed = pages.filter((p) => p.error);
  if (failed.length) {
    add({
      code: "unreachable-pages",
      category: "technical",
      severity: failed.length > 2 ? "critical" : "warning",
      title: `${failed.length} page${failed.length > 1 ? "s" : ""} failed to load`,
      detail: "Timeouts and connection resets stop pages being indexed at all.",
      urls: failed.map((p) => `${p.url} — ${p.error}`).slice(0, 20),
      fix: "Investigate server response time and availability for these URLs.",
      priority: 88,
    });
  }

  if (robots.blocksEverything) {
    add({
      code: "robots-blocks-all",
      category: "technical",
      severity: "critical",
      title: "robots.txt blocks all crawlers from the entire site",
      detail: "A `User-agent: * / Disallow: /` rule removes the site from search entirely.",
      urls: [`${origin}/robots.txt`],
      fix: "Remove the blanket Disallow, or scope it to the paths that must stay private.",
      priority: 100,
    });
  }

  if (!robots.found) {
    add({
      code: "no-robots",
      category: "technical",
      severity: "notice",
      title: "No robots.txt",
      detail: "Without one you cannot point crawlers at your sitemap or control AI crawler access.",
      urls: [`${origin}/robots.txt`],
      fix: "Add a robots.txt that references your sitemap.",
      priority: 30,
    });
  }

  if (!sitemap.found) {
    add({
      code: "no-sitemap",
      category: "technical",
      severity: "warning",
      title: "No XML sitemap found",
      detail: "A sitemap is how search engines discover pages that aren't well linked internally.",
      urls: [`${origin}/sitemap.xml`],
      fix: "Generate a sitemap.xml and reference it from robots.txt.",
      priority: 62,
    });
  } else if (robots.found && !robots.sitemaps.length) {
    add({
      code: "sitemap-not-in-robots",
      category: "technical",
      severity: "notice",
      title: "Sitemap exists but isn't declared in robots.txt",
      detail: "Declaring it speeds up discovery for crawlers that read robots.txt first.",
      urls: [`${origin}/robots.txt`],
      fix: `Add "Sitemap: ${sitemap.url}" to robots.txt.`,
      priority: 28,
    });
  }

  if (sitemap.crossDomain) {
    add({
      code: "sitemap-cross-domain",
      category: "technical",
      severity: "warning",
      title: "Sitemap lists URLs on a different hostname",
      detail: "Cross-domain sitemap entries are ignored, so those pages never get discovered.",
      urls: sitemap.url ? [sitemap.url] : [],
      fix: "Ensure every <loc> uses the same host as the site being submitted.",
      priority: 55,
    });
  }

  const redirected = ok.filter((p) => p.redirectedTo);
  if (redirected.length > Math.max(2, ok.length * 0.2)) {
    add({
      code: "many-redirects",
      category: "technical",
      severity: "notice",
      title: `${redirected.length} internal links redirect before resolving`,
      detail: "Each hop adds latency and dilutes link signals.",
      urls: redirected.map((p) => `${p.url} → ${p.redirectedTo}`).slice(0, 15),
      fix: "Update internal links to point directly at the final URL.",
      priority: 34,
    });
  }

  const noindexed = ok.filter((p) => p.noindex);
  if (noindexed.length) {
    add({
      code: "noindex-pages",
      category: "technical",
      severity: noindexed.length > ok.length / 2 ? "critical" : "notice",
      title: `${noindexed.length} crawled page${noindexed.length > 1 ? "s carry" : " carries"} a noindex tag`,
      detail: "Noindex pages cannot rank. That's correct for admin screens, wrong for content.",
      urls: noindexed.map((p) => p.url).slice(0, 20),
      fix: "Confirm each of these is deliberately excluded from search.",
      priority: noindexed.length > ok.length / 2 ? 90 : 26,
    });
  }

  // Search-relevant checks should only judge pages that can actually rank. A
  // URL that redirects is really its target, and a deliberately noindexed
  // utility page (sign-in, reset password) is not a content failure.
  const indexable = ok.filter((p) => !p.redirectedTo && !p.noindex);

  const noCanonical = indexable.filter((p) => !p.canonical);
  if (noCanonical.length) {
    add({
      code: "missing-canonical",
      category: "technical",
      severity: "notice",
      title: `${noCanonical.length} page${noCanonical.length > 1 ? "s" : ""} without a canonical tag`,
      detail: "Canonicals prevent duplicate-content splits when URLs vary by parameters.",
      urls: noCanonical.map((p) => p.url).slice(0, 20),
      fix: "Add <link rel=\"canonical\"> with the preferred absolute URL.",
      priority: 32,
    });
  }

  // ── On-page ──────────────────────────────────────────────────────────────
  const noTitle = indexable.filter((p) => !p.title);
  if (noTitle.length) {
    add({
      code: "missing-title",
      category: "onpage",
      severity: "critical",
      title: `${noTitle.length} page${noTitle.length > 1 ? "s" : ""} missing a title tag`,
      detail: "The title is the strongest on-page ranking signal and the clickable line in results.",
      urls: noTitle.map((p) => p.url).slice(0, 20),
      fix: "Write a unique 50-60 character title describing the page.",
      priority: 95,
    });
  }

  const titleGroups = new Map<string, string[]>();
  for (const p of indexable) {
    if (!p.title) continue;
    const k = p.title.trim().toLowerCase();
    titleGroups.set(k, [...(titleGroups.get(k) ?? []), p.url]);
  }
  const dupTitles = [...titleGroups.values()].filter((v) => v.length > 1);
  if (dupTitles.length) {
    add({
      code: "duplicate-titles",
      category: "onpage",
      severity: "warning",
      title: `${dupTitles.length} set${dupTitles.length > 1 ? "s" : ""} of pages share the same title`,
      detail: "Identical titles make pages compete with each other and look templated.",
      urls: dupTitles.flat().slice(0, 20),
      fix: "Give every page a distinct title reflecting its specific content.",
      priority: 68,
    });
  }

  const badLenTitles = indexable.filter((p) => p.title && (p.titleLength < 25 || p.titleLength > 65));
  if (badLenTitles.length) {
    add({
      code: "title-length",
      category: "onpage",
      severity: "notice",
      title: `${badLenTitles.length} title${badLenTitles.length > 1 ? "s" : ""} outside the 25-65 character range`,
      detail: "Short titles waste the slot; long ones get truncated in results.",
      urls: badLenTitles.map((p) => `${p.url} (${p.titleLength})`).slice(0, 20),
      fix: "Rewrite to roughly 50-60 characters.",
      priority: 36,
    });
  }

  const noDesc = indexable.filter((p) => !p.metaDescription);
  if (noDesc.length) {
    add({
      code: "missing-meta-description",
      category: "onpage",
      severity: "warning",
      title: `${noDesc.length} page${noDesc.length > 1 ? "s" : ""} missing a meta description`,
      detail: "Without one, search engines invent a snippet, usually less compelling than yours.",
      urls: noDesc.map((p) => p.url).slice(0, 20),
      fix: "Add a 140-160 character description with the page's main benefit.",
      priority: 58,
    });
  }

  const noH1 = indexable.filter((p) => p.h1.length === 0);
  if (noH1.length) {
    add({
      code: "missing-h1",
      category: "onpage",
      severity: "warning",
      title: `${noH1.length} page${noH1.length > 1 ? "s" : ""} without an H1`,
      detail: "The H1 tells both readers and crawlers what the page is about.",
      urls: noH1.map((p) => p.url).slice(0, 20),
      fix: "Add exactly one H1 per page, matching search intent.",
      priority: 60,
    });
  }

  const multiH1 = indexable.filter((p) => p.h1.length > 1);
  if (multiH1.length) {
    add({
      code: "multiple-h1",
      category: "onpage",
      severity: "notice",
      title: `${multiH1.length} page${multiH1.length > 1 ? "s have" : " has"} more than one H1`,
      detail: "Multiple H1s dilute the topical signal.",
      urls: multiH1.map((p) => `${p.url} (${p.h1.length})`).slice(0, 20),
      fix: "Keep one H1 and demote the rest to H2.",
      priority: 24,
    });
  }

  const thin = indexable.filter((p) => p.wordCount < 300);
  if (thin.length) {
    add({
      code: "thin-content",
      category: "onpage",
      severity: thin.length > indexable.length / 2 ? "warning" : "notice",
      title: `${thin.length} page${thin.length > 1 ? "s" : ""} under 300 words`,
      detail: "Thin pages rarely rank for competitive terms and are seldom cited by AI assistants.",
      urls: thin.map((p) => `${p.url} (${p.wordCount}w)`).slice(0, 20),
      fix: "Expand with specifics, examples and a comparison table, or consolidate into a stronger page.",
      priority: 52,
    });
  }

  const noAlt = ok.filter((p) => p.imagesMissingAlt > 0);
  if (noAlt.length) {
    const total = noAlt.reduce((s, p) => s + p.imagesMissingAlt, 0);
    add({
      code: "images-missing-alt",
      category: "onpage",
      severity: "notice",
      title: `${total} image${total > 1 ? "s" : ""} missing alt text`,
      detail: "Alt text is an accessibility requirement and adds image-search context.",
      urls: noAlt.map((p) => `${p.url} (${p.imagesMissingAlt})`).slice(0, 20),
      fix: "Describe each image's content; use alt=\"\" only for decoration.",
      priority: 30,
    });
  }

  const noLang = ok.filter((p) => !p.lang);
  if (noLang.length) {
    add({
      code: "missing-lang",
      category: "onpage",
      severity: "notice",
      title: `${noLang.length} page${noLang.length > 1 ? "s" : ""} without a lang attribute`,
      detail: "Screen readers and search engines use <html lang> to pick pronunciation and locale.",
      urls: noLang.map((p) => p.url).slice(0, 10),
      fix: 'Add lang to the <html> element, e.g. <html lang="en">.',
      priority: 20,
    });
  }

  // ── Structured data ──────────────────────────────────────────────────────
  const withSchema = ok.filter((p) => p.schemaTypes.length > 0);
  if (ok.length && !withSchema.length) {
    add({
      code: "no-structured-data",
      category: "structured-data",
      severity: "warning",
      title: "No structured data anywhere on the site",
      detail:
        "Schema.org markup is how you qualify for rich results and how AI assistants extract facts reliably.",
      urls: [origin],
      fix: "Add Organization plus the type matching your business (LocalBusiness, Product, SoftwareApplication).",
      priority: 70,
    });
  } else if (withSchema.length < ok.length / 2 && ok.length > 3) {
    add({
      code: "sparse-structured-data",
      category: "structured-data",
      severity: "notice",
      title: `Only ${withSchema.length} of ${ok.length} crawled pages carry structured data`,
      detail: "Pages without markup can't produce rich results.",
      urls: ok.filter((p) => !p.schemaTypes.length).map((p) => p.url).slice(0, 20),
      fix: "Extend your schema template to the remaining page types.",
      priority: 44,
    });
  }

  const schemaBroken = ok.filter((p) => p.schemaErrors.length > 0);
  if (schemaBroken.length) {
    add({
      code: "invalid-json-ld",
      category: "structured-data",
      severity: "critical",
      title: `${schemaBroken.length} page${schemaBroken.length > 1 ? "s have" : " has"} unparseable JSON-LD`,
      detail: "Invalid JSON-LD is silently discarded, so the markup does nothing at all.",
      urls: schemaBroken.map((p) => `${p.url} — ${p.schemaErrors[0]}`).slice(0, 15),
      fix: "Validate with the Rich Results Test and fix the JSON syntax error.",
      priority: 80,
    });
  }

  const allTypes = new Set(ok.flatMap((p) => p.schemaTypes.map((t) => t.toLowerCase())));
  if (withSchema.length && !allTypes.has("organization") && !allTypes.has("localbusiness")) {
    add({
      code: "no-organization-schema",
      category: "structured-data",
      severity: "notice",
      title: "No Organization or LocalBusiness markup",
      detail: "This is the entity that anchors your brand in knowledge graphs.",
      urls: [origin],
      fix: "Add Organization (or LocalBusiness for a physical venue) with name, logo, url and sameAs links.",
      priority: 42,
    });
  }

  // ── AI readiness ─────────────────────────────────────────────────────────
  if (ai.blockedAiCrawlers.length) {
    add({
      code: "ai-crawlers-blocked",
      category: "ai-readiness",
      severity: "critical",
      title: `${ai.blockedAiCrawlers.length} AI crawler${ai.blockedAiCrawlers.length > 1 ? "s are" : " is"} blocked`,
      detail: `Blocked: ${ai.blockedAiCrawlers.join(", ")}. These assistants cannot read or cite the site, so it can never appear in AI answers.`,
      urls: [`${origin}/robots.txt`],
      fix: "Allow the crawlers you want citations from. Blocking them forfeits AI-search visibility entirely.",
      priority: 86,
    });
  }

  if (!ai.llmsTxt) {
    add({
      code: "no-llms-txt",
      category: "ai-readiness",
      severity: "notice",
      title: "No /llms.txt",
      detail:
        "An emerging convention that gives AI assistants a curated map of your key pages instead of leaving them to guess.",
      urls: [`${origin}/llms.txt`],
      fix: "Publish /llms.txt listing your main pages and what each covers.",
      priority: 38,
    });
  }

  if (indexable.length >= 3) {
    // Measured over indexable pages only — redirects and noindexed utility
    // screens aren't meant to answer anything.
    const shaped = indexable.filter(answersDirectly).length;
    const ratio = shaped / indexable.length;
    if (ratio < 0.3) {
      add({
        code: "not-answer-shaped",
        category: "ai-readiness",
        severity: "warning",
        title: `Only ${shaped} of ${indexable.length} pages open with a direct answer`,
        detail:
          "AI assistants quote the first passage that answers the heading. Pages that open with preamble get skipped in favour of competitors that lead with the answer.",
        urls: [],
        fix: "Open each page with a one-sentence answer to its H1, then expand below it.",
        priority: 64,
      });
    }
    if (!ai.faqSchemaPages) {
      add({
        code: "no-faq-schema",
        category: "ai-readiness",
        severity: "notice",
        title: "No FAQ structured data",
        detail: "FAQ markup maps question to answer explicitly, which is the easiest shape to cite.",
        urls: [],
        fix: "Add FAQPage schema to pages that answer recurring customer questions.",
        priority: 40,
      });
    }
  }

  // ── Performance ──────────────────────────────────────────────────────────
  if (psi?.ok) {
    if (psi.performance !== null && psi.performance < 50) {
      add({
        code: "poor-performance",
        category: "performance",
        severity: "critical",
        title: `Lighthouse performance score is ${psi.performance}/100`,
        detail: "Below 50 is a failing grade; slow pages lose both rankings and conversions.",
        urls: [origin],
        fix: "Start with the largest contentful element and total blocking time.",
        priority: 84,
      });
    } else if (psi.performance !== null && psi.performance < 90) {
      add({
        code: "mediocre-performance",
        category: "performance",
        severity: "warning",
        title: `Lighthouse performance score is ${psi.performance}/100`,
        detail: "Under 90 leaves measurable speed gains on the table.",
        urls: [origin],
        fix: "Compress images, defer non-critical JS, and preload the LCP element.",
        priority: 50,
      });
    }

    // Google's Core Web Vitals thresholds.
    if (psi.lcp !== null && psi.lcp > 2500) {
      add({
        code: "lcp-slow",
        category: "performance",
        severity: psi.lcp > 4000 ? "critical" : "warning",
        title: `Largest Contentful Paint is ${(psi.lcp / 1000).toFixed(1)}s`,
        detail: "Google's threshold is 2.5s. LCP is the metric users experience as 'slow'.",
        urls: [origin],
        fix: "Preload the hero image/font and cut render-blocking requests.",
        priority: psi.lcp > 4000 ? 82 : 54,
      });
    }
    if (psi.cls !== null && psi.cls > 0.1) {
      add({
        code: "cls-high",
        category: "performance",
        severity: psi.cls > 0.25 ? "critical" : "warning",
        title: `Cumulative Layout Shift is ${psi.cls.toFixed(3)}`,
        detail: "Above 0.1 means content visibly jumps while loading.",
        urls: [origin],
        fix: "Set explicit width/height on images and reserve space for injected banners.",
        priority: psi.cls > 0.25 ? 78 : 48,
      });
    }
    if (psi.tbt !== null && psi.tbt > 200) {
      add({
        code: "tbt-high",
        category: "performance",
        severity: psi.tbt > 600 ? "warning" : "notice",
        title: `Total Blocking Time is ${Math.round(psi.tbt)}ms`,
        detail: "High TBT means the page looks ready but ignores taps and clicks.",
        urls: [origin],
        fix: "Split large bundles and move heavy work off the main thread.",
        priority: psi.tbt > 600 ? 46 : 22,
      });
    }
    if (psi.seo !== null && psi.seo < 90) {
      add({
        code: "lighthouse-seo",
        category: "performance",
        severity: "warning",
        title: `Lighthouse SEO score is ${psi.seo}/100`,
        detail: "Lighthouse flags crawlability and mobile-friendliness basics.",
        urls: [origin],
        fix: "Open the PSI report for this URL and clear the failing SEO audits.",
        priority: 56,
      });
    }
  }

  issues.sort((a, b) => b.priority - a.priority);

  // ── Score ────────────────────────────────────────────────────────────────
  const cats: IssueCategory[] = ["technical", "onpage", "performance", "structured-data", "ai-readiness"];
  const breakdown = {} as Record<IssueCategory, number>;
  for (const c of cats) {
    const penalty = issues
      .filter((i) => i.category === c)
      .reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0);
    breakdown[c] = Math.max(0, Math.round(100 - penalty * 2.2));
  }
  const totalPenalty = issues.reduce((s, i) => s + SEVERITY_WEIGHT[i.severity], 0);
  const score = Math.max(0, Math.min(100, Math.round(100 - totalPenalty * 1.15)));

  return { issues, score, breakdown };
}

export function summarise(report: AuditReport): string {
  const crit = report.issues.filter((i) => i.severity === "critical").length;
  const warn = report.issues.filter((i) => i.severity === "warning").length;
  return `${report.score}/100 · ${crit} critical, ${warn} warnings across ${report.pagesCrawled} pages`;
}
