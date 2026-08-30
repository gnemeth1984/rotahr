/**
 * The printable record of a passed in-house course.
 *
 * ── Why this is a print sheet and not a generated PDF file ──────────────────
 * The same reason the HACCP export is a print sheet: it needs no PDF library,
 * no headless browser on the server (Vercel has none), and the browser's own
 * print dialog already offers "Save as PDF" on every desktop and mobile OS a
 * venue actually uses. One less dependency in the path of a document somebody
 * may have to produce in an inspection.
 *
 * ── The wording is the important part ───────────────────────────────────────
 * This sheet must never read like an accredited certificate. It says, in plain
 * words and in the same size as everything else, that the training was
 * delivered in house by the employer and is not an accredited qualification.
 * A venue that shows an inspector a sheet implying HACCP Level 2 when nobody
 * sat a HACCP Level 2 course is in a far worse position than a venue that shows
 * an honest in-house record. So: no seals, no crests, no awarding-body
 * language, no "certified" — "record of training" throughout.
 *
 * It also carries the things that make a record credible rather than
 * decorative: the score, the pass mark, the date, the name the trainee typed to
 * sign it, the reference id of the stored record, and the retrain-by date.
 */

export interface CertificateData {
  /** CourseCompletion id — printed as the verifiable reference. */
  completionId: string;
  businessName: string;
  traineeName: string;
  /** The name the trainee typed to sign the attempt. */
  signedName: string;
  courseTitle: string;
  /** The wording used on the tracker record, e.g. "Allergen awareness (in-house)". */
  certTitle: string;
  score: number;
  total: number;
  passMark: number;
  /** ISO date string. */
  completedAt: string;
  /** ISO date string, or null if the course record does not expire. */
  expiresAt: string | null;
  /** Minutes of study the course claims. */
  minutes: number;
  /** What the course actually covered, one line each — the syllabus. */
  topics: string[];
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function longDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Builds the whole printable document as a single HTML string.
 *
 * Deliberately self-contained: inline styles only, no fonts to fetch, no
 * images. It has to render identically in a popup window that has no access to
 * the app's stylesheet, and it has to print the same on a venue's old office
 * printer as it does to a PDF.
 */
export function certificateHtml(d: CertificateData): string {
  const percent = d.total > 0 ? Math.round((d.score / d.total) * 100) : 0;
  const topics = d.topics.length
    ? d.topics.map((t) => "<li>" + esc(t) + "</li>").join("")
    : "";

  const rows: [string, string][] = [
    ["Score", `${d.score} of ${d.total} correct (${percent}%) · pass mark ${d.passMark}%`],
    ["Date completed", longDate(d.completedAt)],
    ["Retrain by", d.expiresAt ? longDate(d.expiresAt) : "No fixed expiry"],
    ["Signed by the trainee as", d.signedName || d.traineeName],
    ["Record reference", d.completionId],
  ];

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        '<tr><th scope="row">' + esc(k) + "</th><td>" + esc(v) + "</td></tr>"
    )
    .join("");

  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" />' +
    "<title>" +
    esc(d.certTitle) +
    " — " +
    esc(d.traineeName) +
    "</title>" +
    "<style>" +
    "@page{size:A4;margin:16mm 15mm;}" +
    "*{box-sizing:border-box;}" +
    "body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;font-size:12px;line-height:1.5;}" +
    ".sheet{max-width:180mm;margin:0 auto;border:1.5px solid #0f172a;padding:14mm 14mm 10mm;}" +
    ".brand{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;}" +
    ".kind{margin-top:10mm;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#334155;}" +
    "h1{font-size:26px;margin:3mm 0 0;line-height:1.2;}" +
    ".who{margin-top:9mm;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;}" +
    ".name{font-size:22px;font-weight:bold;margin-top:2mm;border-bottom:1px solid #cbd5e1;padding-bottom:3mm;}" +
    ".venue{margin-top:3mm;font-size:13px;color:#334155;}" +
    "table{width:100%;border-collapse:collapse;margin-top:8mm;}" +
    "th,td{text-align:left;padding:2.6mm 0;border-bottom:1px solid #e2e8f0;vertical-align:top;font-weight:normal;}" +
    "th{width:42mm;color:#64748b;font-size:11px;}" +
    "td{font-size:12px;}" +
    "h2{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#64748b;margin:8mm 0 2mm;}" +
    "ul{margin:0;padding-left:5mm;}" +
    "li{margin-bottom:1.4mm;}" +
    ".notice{margin-top:8mm;border:1px solid #cbd5e1;background:#f8fafc;padding:4mm;font-size:11px;}" +
    ".notice strong{display:block;margin-bottom:1.5mm;}" +
    ".sign{margin-top:10mm;display:flex;gap:10mm;}" +
    ".sign div{flex:1;border-top:1px solid #0f172a;padding-top:2mm;font-size:10px;color:#64748b;}" +
    ".foot{margin-top:6mm;text-align:center;font-size:9px;color:#94a3b8;}" +
    "@media print{.noprint{display:none;}body{font-size:11.5px;}}" +
    ".noprint{max-width:180mm;margin:6mm auto 0;text-align:center;}" +
    ".noprint button{font:inherit;font-size:13px;padding:8px 18px;border:1px solid #0f172a;background:#0f172a;color:#fff;border-radius:6px;cursor:pointer;}" +
    ".noprint p{color:#64748b;font-size:11px;}" +
    "</style></head><body>" +
    '<div class="sheet">' +
    '<div class="brand">' +
    esc(d.businessName) +
    "</div>" +
    '<div class="kind">Record of in-house training</div>' +
    "<h1>" +
    esc(d.courseTitle) +
    "</h1>" +
    '<div class="who">Completed by</div>' +
    '<div class="name">' +
    esc(d.traineeName) +
    "</div>" +
    '<div class="venue">Training delivered by ' +
    esc(d.businessName) +
    " · approximately " +
    String(d.minutes) +
    " minutes of instruction followed by a marked assessment</div>" +
    "<table><tbody>" +
    rowsHtml +
    "</tbody></table>" +
    (topics ? "<h2>What this course covered</h2><ul>" + topics + "</ul>" : "") +
    '<div class="notice"><strong>What this record is, and what it is not</strong>' +
    "This is a record of training delivered in house by the employer named above. It is " +
    "<strong style=\"display:inline\">not</strong> an accredited qualification and it is not issued by an awarding body. " +
    "It does not replace any certified course a role or a local authority may separately require. " +
    "Where the law or an inspector asks for accredited training, this record does not satisfy that requirement. " +
    "Figures taught in the course are the ones in common use; local rules vary and the venue's own procedures take precedence." +
    "</div>" +
    '<div class="sign"><div>Trainee signature</div><div>Manager / person delivering the training</div><div>Date</div></div>' +
    '<div class="foot">Record ' +
    esc(d.completionId) +
    " · stored in the Rotahr training log for " +
    esc(d.businessName) +
    " · rotahr.com</div>" +
    "</div>" +
    '<div class="noprint"><button onclick="window.print()">Print or save as PDF</button>' +
    "<p>Use your browser's print dialog and choose <em>Save as PDF</em> to keep a copy.</p></div>" +
    "</body></html>"
  );
}

/**
 * Opens the sheet in a new window and triggers the print dialog.
 *
 * Returns false when the popup was blocked, so the caller can say something
 * useful instead of appearing to do nothing.
 */
export function openCertificate(d: CertificateData): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(
    certificateHtml(d).replace(
      "</body></html>",
      "<script>setTimeout(function(){window.print();},400);<\/script></body></html>"
    )
  );
  w.document.close();
  return true;
}
