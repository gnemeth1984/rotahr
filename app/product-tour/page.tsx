import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  jsonLdProps,
  breadcrumbSchema,
  softwareApplicationSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

/**
 * app/product-tour/page.tsx
 *
 * Public, no-login screenshot tour of the signed-in app.
 *
 * Two audiences, one page:
 *
 *  1. Buyers, who will not book a call on the strength of a feature list.
 *  2. Software directory category reviewers (G2, Capterra, Software Advice,
 *     GetApp). Category requests get refused when the reviewer cannot verify a
 *     capability from the public site — and every screen that proves inventory,
 *     ordering, reservations and scheduling lives behind a login. So the
 *     capability map near the bottom of this page names those criteria in their
 *     vocabulary and states plainly which one Rotahr does not meet.
 *
 * Screenshots are real captures from the live demo venue ("The Anchor & Tap"),
 * taken by scripts/shots.py. They are not mockups. Re-run that script whenever
 * the UI changes materially — a stale tour is worse than none, because a
 * reviewer who spots a screen that no longer exists discounts the whole page.
 */

const TITLE = "Rotahr Product Tour — Real Screens From Inside the App";
const DESCRIPTION =
  "Actual screenshots of Rotahr in use: rota and labour cost, table floor plan and reservations, HACCP records, stock levels, supplier purchase orders and statement reconciliation, and recipe costing.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/product-tour" },
  openGraph: {
    title: "Rotahr product tour — real screens, no mockups",
    description: DESCRIPTION,
    url: "/product-tour",
    images: [{ url: "/evidence/rota.png", width: 2880, height: 1800 }],
  },
};

type Shot = {
  file: string;
  heading: string;
  /** The directory/category term this screen is evidence of. */
  criterion: string;
  body: string;
  /** Bullet points a reviewer can tick off against what is visible. */
  points: string[];
};

const SHOTS: Shot[] = [
  {
    file: "rota.png",
    heading: "Rota and labour cost",
    criterion: "Employee scheduling · labour cost management",
    body:
      "The week for one venue, staff down the side and days across. Wage cost recalculates as shifts move, so going over budget is something you find out while you can still change it, not on payday.",
    points: [
      "Shifts assigned per employee per day, with roles",
      "Running labour cost against the schedule",
      "Publish to staff phones; swaps and time off route to a manager",
    ],
  },
  {
    file: "floor-plan.png",
    heading: "Table floor plan",
    criterion: "Table management · reservations",
    body:
      "Tables laid out to match the actual room — placed, shaped, sized and given a capacity. Colour is live status for the date you are looking at. Clicking a free table opens a booking already assigned to it.",
    points: [
      "Named tables with covers and shape (round, square, rectangle, bar seating)",
      "Free / upcoming / confirmed / seated shown per table",
      "Click-to-book against a specific table",
    ],
  },
  {
    file: "bookings-list.png",
    heading: "Reservations",
    criterion: "Reservations management",
    body:
      "The same day as a list, which is what you want on a busy service. Reservations come in from the public booking page, by phone, or from a walk-in, and guest profiles build themselves as people return.",
    points: [
      "Party size, time, table, contact details and notes per booking",
      "Status flow through the service",
      "Guest history and no-show record carried forward",
    ],
  },
  {
    file: "haccp.png",
    heading: "HACCP food safety records",
    criterion: "Food safety compliance",
    body:
      "Temperature checks against your own named fridges, freezers and hot holding units. Cooking and cooling records with the thresholds built in. Reminders follow the shift and repeat until the check is logged, and the inspection pack exports as a PDF.",
    points: [
      "Per-equipment temperature logs with pass/fail thresholds",
      "Opening, closing and cleaning checklists, editable per venue",
      "Compliance rate and outstanding checks visible at a glance",
    ],
  },
  {
    file: "stock-items.png",
    heading: "Stock list",
    criterion: "Inventory management",
    body:
      "Every stock item with its supplier, pack size, last paid price, reorder level and current level. Pack size matters: a 5kg box at €98 is €19.60 a kilo, and that is the number recipe costing uses.",
    points: [
      "Current stock against reorder level per item",
      "Last price paid, per supplier, with pack size and unit",
      "Categories, SKUs and price variance tracking",
    ],
  },
  {
    file: "supplier-orders.png",
    heading: "Supplier purchase orders",
    criterion: "Order management (purchase orders to suppliers)",
    body:
      "Order lists built per supplier off what is actually low, with quantities, unit prices and an estimated total. Each one moves draft to sent to received, and can be emailed to the supplier from here.",
    points: [
      "Line items with quantity, unit price and order total",
      "Status lifecycle: draft, sent, received",
      "Email to supplier and export",
    ],
  },
  {
    file: "suppliers.png",
    heading: "Suppliers",
    criterion: "Vendor management",
    body:
      "Your supplier list with the contact who actually answers, tied to the stock items and orders that belong to each one.",
    points: [
      "Contact name, email and phone per supplier",
      "Linked stock items and order history",
    ],
  },
  {
    file: "supplier-statements.png",
    heading: "Supplier statement reconciliation",
    criterion: "Accounting · accounts payable",
    body:
      "Upload a supplier statement and it is read and matched against what you ordered and received. Discrepancies are flagged rather than found three months later.",
    points: [
      "Statement lines matched to orders",
      "Status per statement: pending, matched, discrepancy, accepted",
      "Feeds the expense record, profit and loss, and tax summary",
    ],
  },
  {
    file: "recipe-costing.png",
    heading: "Recipe costing and gross margin",
    criterion: "Recipe and menu costing",
    body:
      "Each dish built from stock items, costed on the prices that actually landed. When a delivery comes in dearer, the gross margin on the dish moves the same day — so the specials board is priced on this week's beef, not last quarter's.",
    points: [
      "Cost per portion, sell price and GP% per dish",
      "Ingredient quantities with their individual costs",
      "Low-GP dishes surfaced automatically",
    ],
  },
];

/** What the directory categories check for, and where Rotahr stands. */
const CRITERIA: { name: string; met: boolean; where: string }[] = [
  { name: "Employee management and scheduling", met: true, where: "Rota, clock-in, time off, payroll hours" },
  { name: "Inventory management", met: true, where: "Stock list, levels, reorder points, wastage" },
  { name: "Order management (supplier purchase orders)", met: true, where: "Order lists, draft → sent → received" },
  { name: "Reservations and table management", met: true, where: "Floor plan, bookings, guest CRM" },
  { name: "Accounting", met: true, where: "Expenses, supplier statements, P&L, tax summary" },
  { name: "Point of sale", met: false, where: "Not built. Rotahr sits alongside your till" },
];

export default function ProductTourPage() {
  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          softwareApplicationSchema(),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Product tour", path: "/product-tour" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ImageGallery",
            name: "Rotahr product tour",
            description: DESCRIPTION,
            url: `${SITE_URL}/product-tour`,
            image: SHOTS.map((s) => ({
              "@type": "ImageObject",
              name: s.heading,
              caption: s.body,
              contentUrl: `${SITE_URL}/evidence/${s.file}`,
            })),
          },
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Product tour</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          What Rotahr actually looks like
        </h1>
        <p className="text-lg text-slate-200 mb-6 max-w-2xl">
          Real screens from a live venue, not mockups. This is the demo site
          &ldquo;The Anchor &amp; Tap&rdquo; — a 20-seat gastropub with ten staff, a
          full week of shifts, a service worth of bookings, stock, suppliers and
          food safety records already in it.
        </p>
        <p className="text-base text-slate-300 mb-8 max-w-2xl leading-relaxed">
          You can walk the whole thing yourself without giving us anything. The
          demo resets itself, so nothing you click matters.
        </p>

        <div className="flex flex-wrap gap-3 mb-16">
          <Link
            href="/auth/signin"
            className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-6 py-3 font-semibold text-white hover:opacity-90 transition"
          >
            Open the live demo
          </Link>
          <Link
            href="/features"
            className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-slate-100 hover:bg-white/5 transition"
          >
            Read the module detail
          </Link>
        </div>

        <div className="space-y-20">
          {SHOTS.map((s, i) => (
            <section key={s.file} id={s.file.replace(".png", "")}>
              <p className="text-xs uppercase tracking-widest text-[#ff8a5c] font-semibold mb-2">
                {String(i + 1).padStart(2, "0")} · {s.criterion}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">{s.heading}</h2>
              <p className="text-slate-300 leading-relaxed mb-5 max-w-2xl">{s.body}</p>

              <ul className="mb-6 space-y-2">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-3 text-sm text-slate-200">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff6b35]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>

              <figure className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <Image
                  src={`/evidence/${s.file}`}
                  alt={`Rotahr — ${s.heading}`}
                  width={2880}
                  height={1800}
                  className="w-full h-auto"
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority={i === 0}
                />
              </figure>
            </section>
          ))}
        </div>

        {/* Capability map. Written for directory reviewers, useful to buyers. */}
        <section className="mt-24">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Capability map
          </h2>
          <p className="text-slate-300 leading-relaxed mb-8 max-w-2xl">
            Software directories check restaurant and hospitality products
            against a fixed list. Here is that list against Rotahr, including the
            one Rotahr does not meet — it is easier for everyone to have that on
            the page.
          </p>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-semibold">Capability</th>
                  <th className="px-4 py-3 font-semibold">In Rotahr</th>
                  <th className="px-4 py-3 font-semibold">Where</th>
                </tr>
              </thead>
              <tbody>
                {CRITERIA.map((c) => (
                  <tr key={c.name} className="border-t border-white/10">
                    <td className="px-4 py-3 text-slate-100">{c.name}</td>
                    <td className="px-4 py-3">
                      {c.met ? (
                        <span className="font-semibold text-emerald-400">Yes</span>
                      ) : (
                        <span className="font-semibold text-slate-400">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{c.where}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold mb-3">What Rotahr is not</h3>
            <p className="text-slate-300 leading-relaxed">
              Rotahr is not a point of sale. It does not process customer
              payments and it does not take orders at the table.
              &ldquo;Order management&rdquo; above means purchase orders to your
              suppliers, not customer orders. Rotahr runs the back of house
              around whatever till you already use.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              Rotahr does host training content, but it is in-house training
              only: thirteen courses generated from your own menu, equipment
              register, stock list and HACCP units, with a pass mark, a 12-month
              expiry and a printable record. Rotahr is not an awarding body and
              none of it is accredited. Where accredited certification is
              legally required, you buy it elsewhere and Rotahr tracks when it
              expires.
            </p>
          </div>
        </section>

        <section className="mt-20 border-t border-white/10 pt-10">
          <h2 className="text-2xl font-bold mb-3">See it with your own data</h2>
          <p className="text-slate-300 mb-6 max-w-2xl leading-relaxed">
            First month is free and there is no card required. Support comes from
            the founder — a former chef — not a ticket queue.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/#pricing"
              className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-6 py-3 font-semibold text-white hover:opacity-90 transition"
            >
              Start free
            </Link>
            <Link
              href="/auth/signin"
              className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-slate-100 hover:bg-white/5 transition"
            >
              Open the demo
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
