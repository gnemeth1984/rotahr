/**
 * Shared types for the domain-agnostic site auditor.
 *
 * Nothing in here may reference Rotahr. The whole engine has to run against any
 * domain the operator types in, using only what a crawler can see from outside —
 * no Search Console, no analytics, no privileged access. That constraint is what
 * makes it work on a prospect's site during a sales call.
 */

export type Severity = "critical" | "warning" | "notice" | "pass";

export type IssueCategory =
  | "technical"
  | "onpage"
  | "performance"
  | "structured-data"
  | "ai-readiness";

export interface Issue {
  /** Stable identifier, e.g. "missing-title". Used to dedupe and group. */
  code: string;
  category: IssueCategory;
  severity: Severity;
  /** One-line statement of what is wrong. */
  title: string;
  /** Why it matters, in plain language an owner can act on. */
  detail: string;
  /** Pages affected. Empty for site-wide issues. */
  urls: string[];
  /** Concrete next action. */
  fix: string;
  /**
   * Rough effort/impact ranking used to order the report.
   * Higher = do sooner. Derived only from observable signals.
   */
  priority: number;
}

export interface PageResult {
  url: string;
  status: number;
  /** Final URL after redirects, when different from url. */
  redirectedTo?: string;
  redirectChain: number;
  contentType: string;
  /** Milliseconds to first byte + full body. */
  loadMs: number;
  bytes: number;

  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string[];
  h2: string[];
  canonical: string | null;
  robotsMeta: string | null;
  noindex: boolean;
  lang: string | null;

  wordCount: number;
  /** Text of the first paragraph — used to judge answer-shaped content. */
  firstParagraph: string | null;

  images: number;
  imagesMissingAlt: number;

  internalLinks: string[];
  externalLinks: string[];

  /** Parsed JSON-LD blocks, with @type extracted. */
  schemaTypes: string[];
  schemaErrors: string[];

  openGraph: Record<string, string>;
  /** Set when the fetch itself failed. */
  error?: string;
}

export interface RobotsInfo {
  found: boolean;
  /** Raw file, truncated. */
  raw: string | null;
  sitemaps: string[];
  /** AI/LLM crawlers explicitly allowed, blocked, or unmentioned. */
  aiCrawlers: Record<string, "allowed" | "blocked" | "unmentioned">;
  blocksEverything: boolean;
}

export interface SitemapInfo {
  found: boolean;
  url: string | null;
  urlCount: number;
  /** Sitemap URLs that returned a non-200 when sampled. */
  brokenSample: string[];
  /** True when a sitemap references URLs on another host. */
  crossDomain: boolean;
}

export interface PsiResult {
  ok: boolean;
  error?: string;
  strategy: "mobile" | "desktop";
  /** Lighthouse performance score 0-100. */
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  /** Core Web Vitals, in ms except CLS. */
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  fcp: number | null;
  si: number | null;
  /** Field data from real Chrome users, when Google has enough traffic. */
  fieldLcp: number | null;
  fieldCls: number | null;
  fieldInp: number | null;
  hasFieldData: boolean;
}

export interface AiReadiness {
  llmsTxt: boolean;
  llmsTxtBytes: number;
  /** Pages whose first paragraph directly answers the H1 question. */
  answerShapedPages: number;
  /** Pages with a question-shaped H1 or H2. */
  questionHeadings: number;
  /** Pages carrying FAQ schema. */
  faqSchemaPages: number;
  /** Blocked AI crawlers, which stop the site being cited by assistants. */
  blockedAiCrawlers: string[];
  hasTables: number;
}

export interface AuditReport {
  domain: string;
  /** Normalised origin actually crawled, e.g. https://example.com */
  origin: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;

  pagesCrawled: number;
  pagesRequested: number;

  robots: RobotsInfo;
  sitemap: SitemapInfo;
  psi: PsiResult | null;
  ai: AiReadiness;

  pages: PageResult[];
  issues: Issue[];

  /** 0-100 headline score derived from weighted issue severity. */
  score: number;
  scoreBreakdown: Record<IssueCategory, number>;

  /** Non-fatal problems encountered while auditing. */
  warnings: string[];
}
