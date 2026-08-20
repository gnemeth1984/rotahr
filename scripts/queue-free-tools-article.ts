/**
 * Queue the "free hospitality templates" article for tomorrow's blog slot.
 *
 * Inserts it unpublished with a createdAt in tomorrow's cron window. The
 * generate-blog cron picks up any due unpublished post and publishes it
 * instead of generating an AI article that day.
 *
 * Run: bun run scripts/queue-free-tools-article.ts
 */
import { prisma } from "../lib/prisma";

const SLUG = "free-hospitality-templates-download";

const TITLE =
  "27 Free Hospitality Templates: HACCP Logs, Rotas and Checklists You Can Download Today";

const EXCERPT =
  "Every restaurant, bar and hotel runs on the same paperwork: temperature logs, rotas, opening checklists, stock counts, cash-up sheets. Here are 27 of them, free to download as PDF, Excel or CSV — no email required.";

const META_DESC =
  "Download 27 free hospitality templates — HACCP temperature logs, staff rotas, opening and closing checklists, cleaning schedules, stock sheets and more. PDF, Excel and CSV, no email needed.";

const KEYWORD = "free hospitality templates";

const TAGS =
  "free templates,haccp,rota,checklists,food safety,stock control,hospitality";

const CONTENT = `Every restaurant, bar and hotel in the world runs on more or less the same stack of paperwork. A temperature log by the walk-in. A rota stuck to the office wall. An opening checklist nobody reads until something gets missed. A cash-up sheet that only makes sense to the person who wrote it.

Most operators end up building these from scratch, or inheriting a photocopy of a photocopy from a previous manager. So we made proper versions of all of them and put them online for free.

There are 27 templates, covering ten areas of day-to-day operations. Every one is available as a printable PDF, an editable Excel file and a CSV. No email address, no signup, no "book a demo to unlock." You click the format you want and the file downloads.

[Browse all 27 free templates](/templates)

## What's in the library

**HACCP and food safety.** The [fridge and freezer temperature log](/templates/fridge-freezer-temperature-log) gives you one page per week with a row for every named unit and space for a morning and evening reading. The [cooking and cooling log](/templates/cooking-cooling-temperature-log) tracks a batch from core temp through to the use-by date that goes on the label. There's a [delivery check record](/templates/delivery-check-record) for goods in, and a [corrective action log](/templates/haccp-corrective-action-log) — the one most kitchens don't have, and the one an inspector will ask for when a reading is out of range.

**Rotas and scheduling.** A [weekly staff rota](/templates/weekly-staff-rota) that fits on one page, with hours totalled per person and a wage cost column so you can see the labour spend before you publish it. Plus a [shift swap request form](/templates/shift-swap-request-form) and a [holiday request form](/templates/holiday-request-form) with the entitlement maths built in.

**Opening and closing.** Separate checklists for the [kitchen](/templates/kitchen-opening-closing-checklist), the [bar](/templates/bar-opening-closing-checklist) and [front of house](/templates/front-of-house-opening-closing-checklist), because the three jobs have almost nothing in common beyond the lock-up.

**Health and safety.** A [fire safety checklist](/templates/fire-safety-checklist), an [accident and incident report form](/templates/accident-incident-report-form), and a [first aid and emergency steps poster](/templates/first-aid-emergency-steps) written for a busy kitchen rather than a classroom — burns, deep cuts, choking, eye splashes, and space to write your own emergency numbers.

**Cleaning.** A [daily and weekly cleaning schedule](/templates/daily-weekly-cleaning-schedule) with tasks down the side and days across the top, and a [deep clean schedule](/templates/deep-clean-schedule) for extraction, ovens and everything behind the line.

**Staff and HR.** A [new starter induction checklist](/templates/new-staff-induction-checklist), a [training record](/templates/staff-training-record) built as a matrix with certificate expiry dates, and a [probation review form](/templates/probation-review-form) that scores the things that actually matter in hospitality.

**Stock and ordering.** A [stock count sheet](/templates/stock-count-sheet) grouped by section so you can count areas in parallel, a [wastage log](/templates/wastage-log) that costs the waste out, and a [par level order sheet](/templates/par-level-order-sheet) that works out the order quantity for you.

**Bar and cellar.** A combined [cellar check and line cleaning log](/templates/cellar-check-line-cleaning-log), and a [spirit stocktake sheet](/templates/spirit-stocktake-sheet) that gets you to a variance number without a spreadsheet fight.

**Hotel and rooms.** A [housekeeping room checklist](/templates/housekeeping-room-checklist) your team can follow without asking, and a [guest incident and complaint log](/templates/guest-incident-log).

**Finance and tips.** A [daily takings sheet](/templates/daily-takings-sheet) for cashing up, and a [tips and tronc distribution sheet](/templates/tips-tronc-distribution-sheet) that splits a pool by hours worked with a signature column.

## A note on local rules

The templates are built to be used anywhere, so they don't make legal claims specific to one country. Where a threshold is genuinely standard it's printed on the sheet — 0-5°C for chilled units, -18°C or colder for frozen, 75°C core temperature for cooked food. Those figures are widely used across Europe, the UK, Ireland and Australia, and the US FDA Food Code works to the equivalent 41°F for cold holding.

But food safety, employment and record-keeping requirements vary by country and often by state or region, and they change. Treat these as recording tools, not as a compliance opinion. Check what your own local authority actually requires and adjust the sheet to match — that's exactly why the Excel versions are editable.

## Paper works, until it doesn't

There's nothing wrong with a printed sheet on a clipboard. It's cheap, it needs no training, and it works when the wifi is down. For a lot of small venues it is genuinely the right answer, and we'd rather hand you a good template than pretend otherwise.

Where paper starts to hurt is at the edges. You can't tell from a filing cabinet whether this morning's temperature check actually happened until you walk over and look. A rota on the wall doesn't tell the person who isn't in the building. Twelve months of logs in a box is not something you can search when someone asks what happened on a specific Tuesday. And a missed check only becomes visible after it matters.

That's the gap [Rotahr](/landing) fills — the same records, logged on a phone, with reminders when a check is due and a searchable history behind it. If you get to the point where the clipboard is costing you more than it saves, it's there.

Until then, take the templates. They're free, they're genuinely useful, and there's nothing to sign up for.

[Download any of the 27 free templates](/templates)`;

const FAQ = [
  {
    q: "Are these hospitality templates really free?",
    a: "Yes. All 27 templates are free to download with no email address, no account and no trial required. Click the format you want and the file downloads. You can use them in your own venue, edit them, and print as many copies as you need.",
  },
  {
    q: "What file formats are the templates available in?",
    a: "Every template comes as a printable PDF, an editable Excel (.xlsx) file and a CSV. Use the PDF if you want to print it and stick it on the wall, the Excel version if you want to change the rows or columns to match your venue, and the CSV if you want to import the structure into another system.",
  },
  {
    q: "Can I edit the templates to suit my own venue?",
    a: "Yes, that is what the Excel version is for. Rename units, add or remove rows, change the task list, adjust the target temperatures to whatever your local authority requires. Nothing is locked.",
  },
  {
    q: "Will these templates make my business compliant?",
    a: "No template can do that on its own. They are recording tools designed to be used anywhere, so they avoid claims tied to one country's law. Food safety, employment and record-keeping rules vary by country and region and they change over time. Check your local requirements and adjust the sheets to match.",
  },
  {
    q: "Which templates should a small restaurant start with?",
    a: "Start with the fridge and freezer temperature log, the kitchen opening and closing checklist, and the weekly staff rota. Those three cover the checks most likely to be asked about in an inspection and the single biggest source of day-to-day confusion. Add the cleaning schedule and wastage log once those are habit.",
  },
  {
    q: "Do you have a template that is not in the library?",
    a: "There is a request form on the template library page. Tell us what paperwork you are missing and we will build it and put it up for free alongside the rest.",
  },
];

// Tomorrow, inside the blog cron's window (cron runs 05:00 UTC daily).
function tomorrowInCronWindow(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(4, 30, 0, 0);
  return d;
}

async function main() {
  const createdAt = tomorrowInCronWindow();
  const wordCount = CONTENT.split(/\s+/).filter(Boolean).length;

  const existing = await prisma.blogPost.findUnique({ where: { slug: SLUG } });

  const data = {
    title: TITLE,
    excerpt: EXCERPT,
    content: CONTENT,
    category: "product",
    tags: TAGS,
    metaTitle: `27 Free Hospitality Templates (HACCP, Rota, Checklists) | Rotahr`,
    metaDesc: META_DESC,
    keyword: KEYWORD,
    faq: JSON.stringify(FAQ),
    wordCount,
    published: false,
    createdAt,
  };

  if (existing) {
    await prisma.blogPost.update({ where: { slug: SLUG }, data });
    console.log("updated queued article:", SLUG);
  } else {
    await prisma.blogPost.create({ data: { slug: SLUG, ...data } });
    console.log("queued article:", SLUG);
  }

  console.log("  words      :", wordCount);
  console.log("  faq        :", FAQ.length);
  console.log("  publishes  :", createdAt.toISOString(), "(cron runs 05:00 UTC)");
  console.log("  url        : https://rotahr.com/blog/" + SLUG);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
