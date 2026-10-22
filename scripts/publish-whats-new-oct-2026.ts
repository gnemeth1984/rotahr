/**
 * Queue the October 2026 product-update article ("Meet the Manager Copilot")
 * for tomorrow's blog slot.
 *
 * Inserts it unpublished with a createdAt in tomorrow's cron window. The
 * generate-blog cron picks up any due unpublished post and publishes it
 * instead of generating an AI article that day. Re-running updates the queued
 * row in place (same slug) and pushes the slot to the following day.
 *
 * The article is checked with checkRotahrFacts before anything is written, so
 * a wrong price or a per-employee claim stops the script instead of shipping.
 *
 * Run: bun run scripts/publish-whats-new-oct-2026.ts
 *      (DATABASE_URL must point at the database the blog reads from)
 */
import { prisma } from "../lib/prisma";
import { checkRotahrFacts } from "../lib/seo/product-facts";

const SLUG = "manager-copilot-daily-brief-whats-new";

const TITLE =
  "Meet the Manager Copilot: Your Venue's Daily Brief, Plus What Else Is New in Rotahr";

const EXCERPT =
  "Rotahr now reads your rota, bookings, stock and logs every morning and puts what needs you on one page: five priorities, tonight's covers and five read-only checks. Here's what it does, where it stops, and the other updates that shipped with it.";

const META_TITLE = "Manager Copilot: A Daily Brief for Restaurant Managers | Rotahr";

const META_DESC =
  "New in Rotahr: the Manager Copilot. A daily brief with five priorities, tonight's covers, margin alerts on supplier price rises, a booking forecast against the rota and no-show warnings. Included on every plan.";

const KEYWORD = "AI copilot for restaurant managers";

const TAGS =
  "product update,manager copilot,gross profit,supplier prices,rota,bookings,no-shows,multi-site";

const COVER = "/evidence/whats-new-oct-2026.png";

const CONTENT = `The first twenty minutes of a manager's shift usually go the same way. Check the bookings. Check who's on. Look at the fridge log to see whether last night's close actually happened. Notice a delivery invoice that looks higher than last week and make a note to look at it later. Later rarely comes.

All of that information was already in Rotahr. It was just in six different places. So we built a page that reads it for you.

## Meet the Manager Copilot

The [Manager Copilot](/features/manager-copilot) is a single page that opens with a short brief for the day, written in plain sentences. Underneath it you get:

- **Today's five priorities**, ranked, each linking straight to the screen where you fix it.
- **A Tonight panel**: covers, number of bookings, the busiest hour, tables with allergies, and occasions or regulars worth knowing about before service.
- **An Ask box**, where you can type a question like "are we short-staffed this weekend?", "which dishes lost margin?" or "who might not show tonight?" and get an answer built from your own venue's data.

![The Manager Copilot daily brief in the Anchor & Tap demo venue](/evidence/copilot.png)

The screenshot above is from our demo venue, so the names and numbers are made up. What you'll see is your own.

## The five checks behind it

The brief is put together from five checks, each of which looks at one part of the business. They're read-only: they look, they don't touch.

**Compliance Monitor.** Fridge and freezer readings, opening and closing checks and other scheduled tasks that weren't logged yesterday. Rostered staff whose food-safety or alcohol certificate has expired, and certificates expiring in the next 30 days. Shifts that leave less rest between them than the minimum for your region (11 hours in Ireland, the UK and the EU).

**Margin Guard.** When a supplier's pack price goes up, every dish that uses that item is re-costed and compared with your target gross profit. The target defaults to 70% and you can change it on the Copilot page. Instead of finding out at the end of the month that the ribeye special stopped making money three weeks ago, you see it the morning after the invoice lands, with the dishes affected and how many GP points each one lost.

**Stock Waste Advisor.** What's been binned over the last four weeks, what it cost, and which items are being over-ordered. If a third of the salmon you buy keeps expiring, that shows up as a line, not a hunch.

**Booking Forecast.** Covers for the next seven days, forecast from how fast bookings came in on the same weekday in previous weeks, then compared with the kitchen, floor and bar staff you've rostered at the peak hour. "Short 2 floor at the 19:00 peak" on a Tuesday morning is a lot more useful than discovering it on Friday night.

**No-show Guard.** The bookings most likely not to turn up, scored from the guest's own history, party size and how far ahead they booked. It shows you the reason, and drafts a confirmation message you can copy and send yourself.

## What it won't do

This is the part we care about most, so it's worth being direct.

**Nothing is sent or changed automatically.** The Copilot can suggest a menu price, draft a confirmation text or flag a short-staffed hour. It can't change a price, message a guest or edit your rota. You do that, if you agree with it.

**Your guests' and staff's details stay out of the AI.** The checks themselves run inside Rotahr on your data. The AI is only used to word the brief and answer typed questions. Before anything is sent to it, names, email addresses, phone numbers and record IDs are stripped out, and if anything that looks like personal data slips through, the request is blocked. If the AI is unavailable, you get the same findings as plain text.

**It's a second pair of eyes, not a compliance opinion.** The rest-period and certificate checks are there to catch gaps early. They don't replace knowing the rules that apply to your venue.

## Who can use it, and what it costs

Admins and managers see it by default. You can also give it to an individual member of staff, say a head chef who should see Margin Guard, from the Employees page. If you'd rather not use it at all, it can be switched off or restricted in Settings → Features, under "AI & Tools".

It's included on every plan. There's no add-on and no AI surcharge. [Pricing](/pricing) stays as it was: Rotahr is a flat €49, €89 or €215 a month depending on the plan, never per employee, and your first 3 months are free.

## Also new this month

A few other updates shipped alongside the Copilot. The full list is on the [What's new](/whats-new) page.

- **Supplier price history.** Every change to a stock item's pack price is now recorded with the date and where it came from: a stock edit, a scanned receipt, a delivery note, a supplier statement or an order. It's what Margin Guard reads, and it's useful on its own when a supplier asks why you're querying an invoice.
- **Revenue and labour % per venue.** For groups with more than one site, each POS connection can now be assigned to a venue in Settings → POS. Daily takings are kept per venue, and the labour report shows revenue and labour % for each site with a venue filter. Takings from a POS that hasn't been assigned show as unattributed rather than being lumped in with one site.
- **Staff invites by email.** Invite a new starter by email and they set their own password from a link that's valid for 7 days.
- **Private staff contact details.** In the staff directory, team members now see only their own phone number and email. Managers still see the whole team.
- **Clock-in geofence checked on the server.** Where a venue has a geofence, the location check now happens on the server rather than only in the app. Clocking out is never blocked.
- **Consistent no-show status** across bookings, the guest CRM and the dashboard, and **a separate webhook signing secret for each business**.

## Try it

If you already use Rotahr, open **Manager Copilot** in the sidebar under Daily. If you run more than one site, assign your POS connections to venues in Settings → POS first so the per-venue numbers fill in.

If you don't, the quickest way to see it is the demo venue: [try Rotahr](/try) and open the Copilot page, or read [how the Manager Copilot works](/features/manager-copilot) first.`;

const FAQ = [
  {
    q: "What is the Rotahr Manager Copilot?",
    a: "It is a page in Rotahr that reads your rota, bookings, stock, recipes and compliance logs and puts what needs attention on one screen: a short daily brief, today's five priorities, a Tonight panel with covers and allergies, and an Ask box for questions about your own venue.",
  },
  {
    q: "Does the Manager Copilot cost extra?",
    a: "No. It is included on every Rotahr plan with no add-on or AI surcharge. Plans are a flat monthly price, never per employee, and the first 3 months are free.",
  },
  {
    q: "Will it message guests or change my prices automatically?",
    a: "No. All five checks are read-only. The Copilot can suggest a menu price, draft a confirmation message or flag a short-staffed hour, but nothing is sent or changed until you do it yourself.",
  },
  {
    q: "Does the AI see guest or staff personal data?",
    a: "The checks run inside Rotahr. The AI is only used to word the summary and answer typed questions, and names, emails, phone numbers and record IDs are removed before anything is sent to it. If anything that looks like personal data remains, the request is blocked and you get the plain-text findings instead.",
  },
  {
    q: "How does Margin Guard know a supplier price went up?",
    a: "Rotahr now keeps a price history for every stock item. A change is recorded whenever the pack price is edited, or updated from a scanned receipt, a delivery note, a supplier statement or an order. Margin Guard re-costs the dishes that use that item against your target gross profit, which defaults to 70%.",
  },
  {
    q: "Can I turn the Manager Copilot off?",
    a: "Yes. It can be switched off or limited to certain roles in Settings → Features, under AI & Tools. By default admins and managers can use it, and individual staff can be given access from the Employees page.",
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
  // Fact guard first: refuse to write anything that misstates pricing.
  const problems = [
    ...checkRotahrFacts(CONTENT),
    ...checkRotahrFacts(EXCERPT),
    ...checkRotahrFacts(META_DESC),
    ...checkRotahrFacts(FAQ.map((f) => `${f.q}\n${f.a}`).join("\n")),
  ];
  if (problems.length) {
    console.error("checkRotahrFacts failed, nothing written:");
    for (const p of problems) console.error("  -", p);
    process.exit(1);
  }

  const createdAt = tomorrowInCronWindow();
  const wordCount = CONTENT.split(/\s+/).filter(Boolean).length;

  const existing = await prisma.blogPost.findUnique({ where: { slug: SLUG } });
  if (existing?.published) {
    console.log("already published, leaving it alone:", SLUG);
    return;
  }

  const data = {
    title: TITLE,
    excerpt: EXCERPT,
    content: CONTENT,
    category: "product",
    tags: TAGS,
    metaTitle: META_TITLE,
    metaDesc: META_DESC,
    coverImage: COVER,
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

  console.log("  facts      : ok (checkRotahrFacts)");
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
