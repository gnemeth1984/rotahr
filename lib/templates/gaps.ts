/**
 * Weekly review of the free template library.
 *
 * Two questions worth answering once a week, and only two:
 *   1. what did people ask for that we don't have?
 *   2. which of the 27 templates are actually being downloaded?
 *
 * Requests are clustered on shared keywords rather than sent through a model —
 * a list of 6 requests does not need an LLM, and a wrong cluster in an email to
 * yourself is just noise you have to unpick. Downloads come from ActivityLog,
 * where the beacon writes them.
 */

import { prisma } from "@/lib/prisma";
import { freeTemplates } from "@/lib/templates";
import { sendEmail } from "@/lib/email/send";

const STOP = new Set([
  "a", "an", "and", "any", "are", "as", "at", "be", "but", "by", "can", "do",
  "for", "from", "get", "got", "has", "have", "how", "i", "if", "in", "is",
  "it", "its", "just", "like", "me", "my", "need", "needed", "of", "on", "one",
  "or", "our", "out", "please", "sheet", "so", "some", "template", "templates",
  "that", "the", "their", "them", "there", "this", "to", "up", "us", "use",
  "want", "was", "we", "what", "when", "which", "with", "would", "you", "your",
  "form", "log", "list", "checklist", "would", "could", "looking",
]);

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOP.has(w)),
    ),
  );
}

export interface GapReport {
  openRequests: number;
  newSinceLastWeek: number;
  themes: { term: string; count: number; examples: string[] }[];
  downloads7d: { slug: string; count: number }[];
  neverDownloaded: string[];
  emailed: boolean;
  emailError: string | null;
}

export async function reviewTemplateGaps(
  options: { notify?: boolean } = {},
): Promise<GapReport> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [open, recent, downloadRows] = await Promise.all([
    prisma.templateRequest.findMany({
      where: { status: "new" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { request: true, email: true, venueType: true, createdAt: true },
    }),
    prisma.templateRequest.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.activityLog.findMany({
      where: { action: "template_download", createdAt: { gte: weekAgo } },
      select: { details: true },
      take: 5000,
    }),
  ]);

  // Requests → themes. A term only counts as a theme when two different people
  // used it; a single mention is in the raw list further down the email anyway.
  const termCounts = new Map<string, { count: number; examples: string[] }>();
  for (const r of open) {
    for (const term of keywords(r.request)) {
      const entry = termCounts.get(term) ?? { count: 0, examples: [] };
      entry.count += 1;
      if (entry.examples.length < 3) entry.examples.push(r.request.slice(0, 140));
      termCounts.set(term, entry);
    }
  }
  const themes = Array.from(termCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12)
    .map(([term, v]) => ({ term, count: v.count, examples: v.examples }));

  // Downloads per slug.
  const dl = new Map<string, number>();
  for (const row of downloadRows) {
    const slug = (row.details as { slug?: string } | null)?.slug;
    if (typeof slug === "string") dl.set(slug, (dl.get(slug) ?? 0) + 1);
  }
  const downloads7d = Array.from(dl.entries())
    .map(([slug, count]) => ({ slug, count }))
    .sort((a, b) => b.count - a.count);
  const neverDownloaded = freeTemplates
    .filter((t) => !dl.has(t.slug))
    .map((t) => t.slug);

  const report: GapReport = {
    openRequests: open.length,
    newSinceLastWeek: recent,
    themes,
    downloads7d,
    neverDownloaded,
    emailed: false,
    emailError: null,
  };

  // Nothing asked for and nothing downloaded is not worth an email — a weekly
  // "no news" message is the fastest way to stop reading a weekly message.
  const worthSending =
    recent > 0 || open.length > 0 || downloads7d.length > 0;
  if (!options.notify || !worthSending) return report;

  const rows = (items: string[]) =>
    items.length
      ? `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`
      : "<p style='color:#64748b'>None.</p>";

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#0f1c35;max-width:640px">
      <h2 style="margin:0 0 4px">Template library — weekly review</h2>
      <p style="color:#64748b;margin:0 0 20px">
        ${freeTemplates.length} templates live ·
        ${recent} new request${recent === 1 ? "" : "s"} this week ·
        ${open.length} open
      </p>

      <h3 style="margin:0 0 6px">Asked for more than once</h3>
      ${
        themes.length
          ? `<ul>${themes
              .map(
                (t) =>
                  `<li><strong>${escapeHtml(t.term)}</strong> — ${t.count} mentions<br>
                   <span style="color:#64748b;font-size:13px">${t.examples
                     .map(escapeHtml)
                     .join(" · ")}</span></li>`,
              )
              .join("")}</ul>`
          : "<p style='color:#64748b'>No repeated themes yet.</p>"
      }

      <h3 style="margin:24px 0 6px">Open requests</h3>
      ${rows(
        open
          .slice(0, 25)
          .map(
            (r) =>
              `${r.request.slice(0, 180)}${
                r.venueType ? ` — ${r.venueType}` : ""
              }${r.email ? " (wants a reply)" : ""}`,
          ),
      )}

      <h3 style="margin:24px 0 6px">Downloaded this week</h3>
      ${rows(downloads7d.slice(0, 20).map((d) => `${d.slug} — ${d.count}`))}

      <h3 style="margin:24px 0 6px">No downloads this week (${neverDownloaded.length})</h3>
      <p style="color:#64748b;font-size:13px">${
        neverDownloaded.map(escapeHtml).join(", ") || "None — all 27 were taken."
      }</p>

      <p style="margin-top:24px">
        <a href="https://rotahr.com/admin?tab=templates"
           style="background:#ff6b35;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">
          Review requests
        </a>
      </p>
    </div>`;

  const to = process.env.TEMPLATE_REVIEW_EMAIL || "gnemeth1984@gmail.com";
  const res = await sendEmail({
    to,
    subject: `Templates: ${recent} new request${recent === 1 ? "" : "s"}, ${
      downloads7d.reduce((a, b) => a + b.count, 0)
    } downloads this week`,
    html,
    context: "template-gaps",
  });
  report.emailed = res.ok;
  report.emailError = res.error;
  return report;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
