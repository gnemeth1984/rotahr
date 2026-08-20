/**
 * Dumps the template catalog to JSON so the Python generator can read it.
 *
 * The catalog lives in TypeScript because the landing pages consume it too, and
 * one source of truth beats keeping a parallel JSON in step by hand.
 *
 *   bun run scripts/dump-templates.ts > /tmp/templates.json
 */
import { freeTemplates, templateCategories } from "../lib/templates";

process.stdout.write(
  JSON.stringify({ categories: templateCategories, templates: freeTemplates }, null, 2),
);
