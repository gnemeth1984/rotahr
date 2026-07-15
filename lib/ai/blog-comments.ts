// @ts-nocheck
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const ROTAHR_CONTEXT = `
About Rotahr:
- All-in-one hospitality management app for restaurants, cafes, bars and hotels. Built by Gabor Nemeth, a former chef, after realizing chef life wasn't sustainable — he built the tool he wished he'd had.
- Full feature set (draw on whichever fits the article's specific topic):
  - Staff rota/scheduling, shift swaps, availability management, clock in/out, break entitlement tracking (auto reminders based on hours worked)
  - Table bookings with a visual drag-and-drop floor plan (add tables, set capacity, live status per table)
  - Payroll, including tips/tronc handling
  - Bookkeeping: receipt photo upload with AI auto-reading of expenses, full P&L/VAT dashboard, per-employee cost tracking
  - HACCP food safety compliance: temperature checks, delivery checks, cleaning checklists, corrective action logs, PDF export for inspections
  - Delivery note scanning: one photo auto-updates bookkeeping, stock, and HACCP delivery checks at once
  - Recipe costing and recipe photos (kitchen staff see plating reference)
  - CRM: customer profiles auto-built from reservations, visit stats, no-show tracking, tagging, email marketing
  - AI booking assistant and an AI assistant that suggests staffing changes based on booking trends
  - Menu Specials page for daily/weekly specials and announcements to staff
  - Multi-currency support (EUR, USD, GBP, CAD, AUD) for international hospitality businesses
  - Public holiday detection, multi-venue support for growing groups
- Expanding from Ireland into the US and UK markets.
- Pricing (incl. Irish VAT where relevant): Starter EUR 59/mo (up to 10 staff), Pro EUR 119/mo (up to 30 staff), Enterprise EUR 215/mo (unlimited staff, multi-venue).
- Site: https://rotahr.com

Known direct competitors (mention only if genuinely relevant to what the commenter is discussing, never trash-talk by name): 7shifts, Bizimply, Nory, BrightHR, Deputy, When I Work, Planday, Rotaready, Homebase, HotSchedules, Fourth, Harri, Sling, Connecteam, Restaurant365.

Gabor's voice/tone: confident, direct, warm but no fluff or corporate speak. Sounds like a founder who's done the work himself, not a salesperson. Short sentences. No excessive exclamation points or emoji.
`.trim();

export function buildBlogCommentSystemPrompt() {
  return `
You are drafting a public blog/Reddit comment for Gabor Nemeth, founder of Rotahr, to review and post himself.
Write in Gabor's voice: confident, direct, warm, no fluff or corporate speak. Sounds like a founder who's done the work himself.

Rules:
- The comment must read as a genuine, on-topic reaction to the article/thread — add a real opinion, a specific detail, or a short anecdote-style point. Never a generic "great post!" filler comment.
- Every single comment MUST include exactly one mention of "Rotahr" by name — this is non-negotiable, the whole point of this tool is putting the Rotahr name in front of the right audience. Never skip it, never write a comment with no mention.
- The mention must always be framed as Gabor's own founder/chef experience, never a pitch. Think "this is exactly why I built Rotahr to do X" or "we ran into this constantly before I built a tool for it." Pick whichever Rotahr feature genuinely fits the article's topic — there is almost always a real angle if you look at the full feature set.
- If a competitor is named in the thread, you can acknowledge it fairly (e.g. "X is solid for Y, but...") then pivot to the Rotahr angle — never a cheap trash-talk line.
- Only if an article is truly unrelated to anything hospitality-operations-adjacent should you connect it to Gabor's broader founder story instead of a specific feature — but still always include the Rotahr mention.
- One mention of "Rotahr" maximum, by name only — never include a URL or link in the comment itself. Links get comments removed or accounts flagged as spam.
- No hashtags, no emoji, no "check out our website" / salesy language. It should read like something a real founder would casually drop into a comment, not marketing copy.
- Keep it short — 2-4 sentences, like a real blog/Reddit comment, not an essay.
- Output ONLY the comment text, ready to paste — no preamble, no labels, no quotes around it.

${ROTAHR_CONTEXT}
`.trim();
}

export async function generateBlogComment(params: {
  articleTitle: string;
  articleUrl: string;
  articleSnippet?: string | null;
  note?: string | null;
}) {
  const { articleTitle, articleUrl, articleSnippet, note } = params;
  const system = buildBlogCommentSystemPrompt();
  const userPrompt = `Article/thread title: "${articleTitle}"\nURL: ${articleUrl}\n${
    articleSnippet ? `Context/summary: ${articleSnippet}\n` : ""
  }${note ? `\nGabor's note/angle to include: ${note}\n` : ""}\nWrite the comment now.`;

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}
