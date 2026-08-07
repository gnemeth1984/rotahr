/**
 * Reply formatting: plain-text signature and the HTML body wrapper.
 *
 * DESIGN
 * Deliberately restrained. These are one-to-one replies, so they have to look
 * like a person wrote them — a full marketing template with banners and social
 * icons reads as bulk mail, which is both less persuasive and more likely to be
 * filtered. A small logo and one link line is the most branding this can carry
 * without changing what the email *is*.
 *
 * The plain-text and HTML parts must carry the same information. A text part
 * that disagrees with its HTML part is a spam signal, and some recipients only
 * ever render the text one.
 *
 * This lives in its own module so the send route and any test harness format
 * mail through exactly the same code. A second copy would eventually drift, and
 * then a test would stop telling the truth about what customers receive.
 */

/** Absolute, because mail clients have no origin to resolve a relative path against. */
const LOGO_URL = "https://rotahr.com/email-logo.png";
const TAGLINE = "Scheduling, bookings, payroll and HACCP for hospitality";

const SIG_TEXT = `\n\n—\nRotahr · ${TAGLINE}\nhttps://rotahr.com`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signatureHtml(): string {
  return [
    `<div style="margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0">`,
    // Width and height are inline attributes because Outlook ignores CSS sizing
    // on images, and an unsized 260px logo would render at full width there.
    `<img src="${LOGO_URL}" alt="Rotahr" width="130" height="48" style="display:block;border:0;margin-bottom:8px">`,
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#64748b">`,
    `${TAGLINE}<br>`,
    `<a href="https://rotahr.com" style="color:#e8365d;text-decoration:none">rotahr.com</a>`,
    `</p></div>`,
  ].join("");
}

/** Append the plain-text signature, unless the draft already ends with one. */
export function withSignature(text: string): string {
  return text.includes("rotahr.com\n") || text.trimEnd().endsWith("rotahr.com")
    ? text
    : `${text.trimEnd()}${SIG_TEXT}`;
}

/** Plain text to simple HTML. The reply is prose, so paragraphs are enough. */
export function textToHtml(text: string): string {
  const paras = escapeHtml(text)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1e293b">${paras}${signatureHtml()}</div>`;
}
