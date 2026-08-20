import type { FreeTemplate } from "./types";
import { haccpTemplates } from "./data/haccp";
import { rotaTemplates } from "./data/rota";
import { openCloseTemplates } from "./data/open-close";
import { safetyTemplates } from "./data/safety";
import { cleaningTemplates } from "./data/cleaning";
import { hrTemplates } from "./data/hr";
import { stockTemplates } from "./data/stock";
import { barTemplates } from "./data/bar";
import { hotelTemplates } from "./data/hotel";
import { financeTemplates } from "./data/finance";

export * from "./types";
export { templateCategories, getCategory } from "./categories";

/**
 * The full library. Order within a category is the display order.
 *
 * Adding a template is two steps: append it to its category file, then re-run
 * `bun run templates:build` to regenerate the PDF/XLSX/CSV into public/templates
 * and commit the output. The page and the sitemap pick it up automatically.
 */
export const freeTemplates: FreeTemplate[] = [
  ...haccpTemplates,
  ...rotaTemplates,
  ...openCloseTemplates,
  ...safetyTemplates,
  ...cleaningTemplates,
  ...hrTemplates,
  ...stockTemplates,
  ...barTemplates,
  ...hotelTemplates,
  ...financeTemplates,
];

export function getTemplate(slug: string) {
  return freeTemplates.find((t) => t.slug === slug);
}

export function templatesByCategory(categoryId: string) {
  return freeTemplates.filter((t) => t.category === categoryId);
}

export function relatedTemplates(slug: string) {
  const t = getTemplate(slug);
  if (!t) return [];
  return t.related
    .map((s) => getTemplate(s))
    .filter((x): x is FreeTemplate => Boolean(x));
}
