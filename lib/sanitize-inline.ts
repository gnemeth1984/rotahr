/**
 * Minimal inline-HTML sanitiser for AI-generated chat text.
 *
 * This replaced `isomorphic-dompurify`, which was the cause of a production
 * outage-shaped bug: isomorphic-dompurify pulls in jsdom, jsdom 29 pulls in
 * html-encoding-sniffer 6, and that requires @exodus/bytes, which is ESM-only.
 * Vercel's serverless module loader cannot `require()` an ES module, so merely
 * importing it crashed the server render of every page that mounted
 * HelpAssistant — which the (app) layout does on every signed-in page. Local
 * `next start` was fine because Node 22+ supports require(esm), which is what
 * made the bug invisible outside production.
 *
 * DOMPurify was only ever used here to allow four inline tags and no
 * attributes at all, so a DOM implementation was never needed.
 *
 * The approach is escape-first, then re-allow: everything is HTML-escaped, and
 * only the exact escaped forms of <strong>, <em>, <b> and <br/> are turned back
 * into markup. Nothing carrying an attribute, a URL, a style or a script can
 * survive that, because any tag with content between the name and the closing
 * bracket simply never matches and stays escaped and inert.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function sanitizeInlineHtml(input: string): string {
  const escaped = String(input ?? "").replace(
    /[&<>"']/g,
    (c) => HTML_ESCAPES[c]
  );

  return escaped
    .replace(/&lt;(\/?)(strong|em|b)&gt;/gi, "<$1$2>")
    .replace(/&lt;br\s*\/?&gt;/gi, "<br/>");
}
