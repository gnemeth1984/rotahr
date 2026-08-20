/**
 * Free template library — shared types.
 *
 * Each entry drives three things from one definition:
 *   1. a landing page at /templates/<slug>
 *   2. a printable PDF at /templates/<slug>.pdf
 *   3. a working spreadsheet at /templates/<slug>.xlsx (+ .csv)
 *
 * The PDF/XLSX are generated in the sandbox by scripts/build-templates.py and
 * committed to public/templates. Nothing is generated at request time — Vercel
 * has no Chrome, and static files are CDN-cached for free.
 *
 * Audience is international. Do NOT write country-specific legal claims into a
 * template ("as required by the FSAI"). Where a threshold is genuinely a common
 * standard, state it as a widely used figure and say the operator should check
 * their own local rules. A wrong compliance claim on a downloaded PDF is worse
 * than no template at all.
 */

export type TemplateCategoryId =
  | "haccp"
  | "rota"
  | "open-close"
  | "safety"
  | "cleaning"
  | "hr"
  | "stock"
  | "bar"
  | "hotel"
  | "finance";

export interface TemplateCategory {
  id: TemplateCategoryId;
  /** Nav label. */
  name: string;
  /** One line explaining what this group of paperwork is for. */
  blurb: string;
}

/** A column on a log/count sheet. */
export interface SheetColumn {
  name: string;
  /** Small grey text under the heading — units, thresholds, expected format. */
  hint?: string;
  /** Relative width. 1 = narrow, 2 = default, 4 = wide free-text. */
  width?: number;
}

/** A named group of pre-printed rows on a checklist. */
export interface SheetSection {
  title: string;
  rows: string[];
}

/**
 * How the printable/spreadsheet artefact is laid out.
 *
 *  - "log"       columns + blank numbered rows to fill in daily
 *  - "checklist" pre-printed task rows in sections, with tick/initial columns
 *  - "form"      a single record per sheet: label/value field pairs
 *  - "guide"     reference sheet — numbered steps, nothing to fill in
 */
export interface TemplateSheet {
  kind: "log" | "checklist" | "form" | "guide";
  orientation: "portrait" | "landscape";
  /** Fields printed in the header block (venue, date, signed off by...). */
  headerFields: string[];
  /** Required for "log" and "checklist". */
  columns?: SheetColumn[];
  /**
   * Columns added to the spreadsheet version only. The printable PDF stays one
   * page, so anything that would make it too wide to write in goes here.
   */
  extraColumns?: SheetColumn[];
  /** Blank rows to print. Used by "log". */
  rowCount?: number;
  /** Pre-printed rows. Used by "checklist", "form" and "guide". */
  sections?: SheetSection[];
  /** Small print at the bottom of the sheet. */
  footerNotes: string[];
}

export interface TemplateFaq {
  q: string;
  a: string;
}

export interface FreeTemplate {
  slug: string;
  category: TemplateCategoryId;
  /** Short label used in grids and nav. */
  name: string;
  /** Page H1. */
  h1: string;
  /** Title tag, under 60 chars including " | Rotahr". */
  title: string;
  metaDescription: string;
  /**
   * First line of the page. Must answer the H1 directly and name the format —
   * this is the sentence an answer engine quotes.
   */
  answer: string;
  /** Body paragraphs. Real operational detail, not filler. */
  body: string[];
  /** The artefact definition. */
  sheet: TemplateSheet;
  /** Numbered how-to steps. Rendered as HowTo JSON-LD. */
  howToUse: string[];
  /** Bullet list of what the download actually contains. */
  whatsIncluded: string[];
  faqs: TemplateFaq[];
  /** Related template slugs, for internal linking. */
  related: string[];
  /** Search phrases this page is meant to answer. Not stuffed into copy. */
  keywords: string[];
}
