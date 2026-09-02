import Link from "next/link";
import {
  jsonLdProps,
  breadcrumbSchema,
  organizationSchema,
  faqSchema,
} from "@/lib/seo/structured-data";

/**
 * /about — who builds Rotahr and what it actually is.
 *
 * Two jobs. For a human it answers the question every small buyer asks about a
 * young product: who is behind this and will they still be here next year. For
 * an answer engine it is the page that ties the brand to the entity phrases and
 * to a named founder, which is what `organizationSchema` asserts in markup —
 * including a Person node for him whose `@id` is anchored to this page, so this
 * is the canonical URL for the founder entity as well as the company story.
 *
 * HARD RULE, do not relax it: there are no customers to speak of yet. Nothing on
 * this page may claim a customer count, revenue, traction, an award or "trusted
 * by X venues". The credibility here comes from being specific and honest about
 * being small, not from invented social proof.
 */

export const metadata = {
  title: "About Rotahr — Built by a Chef, for Hospitality",
  description:
    "Rotahr is a restaurant operations platform combining rota scheduling, HACCP software and a restaurant CRM. Built and self-funded in Ireland by former chef Gabor Nemeth.",
  alternates: { canonical: "/about" },
};

const aboutFaq = [
  {
    q: "Who makes Rotahr?",
    a: "Rotahr is built by Gabor Nemeth, a former chef who moved from Hungary to Ireland and spent years working in professional kitchens before writing the software. It is independent and self-funded, based in Ireland, and used by venues in Ireland, the UK, the United States, Canada and Australia.",
  },
  {
    q: "What is Rotahr?",
    a: "Rotahr is a restaurant operations platform for hospitality venues. It combines staff rota scheduling and clock-in, HACCP software for food safety records, a restaurant CRM built from your own reservations, table bookings, stock and recipe costing, bookkeeping and in-house staff training in one app, instead of four separate subscriptions.",
  },
  {
    q: "Is Rotahr only for Ireland?",
    a: "No. It started in Ireland and Irish rules like the 15 and 30 minute break entitlements are built in, but Rotahr bills in EUR, GBP, USD, CAD and AUD and adapts tax labelling and overtime rules per region. Venues in the UK, the US, Canada and Australia use the same product.",
  },
  {
    q: "Is Rotahr training accredited?",
    a: "No. The in-house training module is exactly that: in-house. It lets you deliver and record your own training and keep a printable completion record showing that you instructed and supervised your staff. It is not an accredited qualification and it is not a substitute for one.",
  },
];

export default function AboutPage() {
  return (
    <main className="bg-white text-slate-900">
      <script
        {...jsonLdProps([
          organizationSchema(),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "About", path: "/about" },
          ]),
          faqSchema(aboutFaq),
        ])}
      />

      <section className="max-w-3xl mx-auto px-6 pt-20 pb-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600 mb-4">
          About
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">
          Built by a chef who got sick of the spreadsheet
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Rotahr is a restaurant operations platform for hospitality: staff rotas and clock-in,
          HACCP software for food safety records, a restaurant CRM built from your own bookings,
          table reservations, stock, bookkeeping and in-house staff training in one app. It is
          independent, self-funded and made in Ireland.
        </p>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-16">
        <h2 className="text-2xl font-extrabold mb-5">Why it exists</h2>
        <div className="space-y-4 text-slate-600 leading-relaxed">
          <p>
            Gabor Nemeth grew up in Hungary, moved to Ireland and spent years working as a chef.
            The admin around the cooking was always the same: the rota in a spreadsheet that
            broke every time somebody swapped a shift, the fridge temperatures written into a
            paper diary that got filled in from memory at the end of the week, the booking
            diary by the phone, and a carrier bag of receipts for the accountant.
          </p>
          <p>
            Every one of those had software available for it. The problem was that buying all
            four meant four subscriptions, four logins and four bills, most of them priced per
            employee so the cost climbed every time the kitchen took someone on. For a single
            independent venue that maths never worked.
          </p>
          <p>
            Rotahr is the version that would have been useful from inside the kitchen: one app,
            one flat monthly fee per venue, and the food safety paperwork treated as a first
            class part of the product rather than an add-on.
          </p>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-extrabold mb-5">How we work</h2>
          <ul className="space-y-4 text-slate-600 leading-relaxed">
            <li>
              <strong className="text-slate-900">Flat pricing, never per head.</strong> One fee
              per venue. Hiring does not change your bill until you cross a plan limit. Full
              detail on the{" "}
              <Link href="/pricing" className="text-orange-700 underline">
                pricing page
              </Link>
              .
            </li>
            <li>
              <strong className="text-slate-900">Small and independent.</strong> No investors,
              no sales team, no enterprise procurement process. That means quick changes and
              direct answers, and it also means we are a young product rather than a suite with
              a decade of integrations behind it. Both are true.
            </li>
            <li>
              <strong className="text-slate-900">Useful before you pay.</strong> The{" "}
              <Link href="/templates" className="text-orange-700 underline">
                template library
              </Link>{" "}
              is completely ungated: no email address, no sign-up, download the HACCP logs and
              rota sheets and use them on paper forever if that suits you better.
            </li>
            <li>
              <strong className="text-slate-900">Honest about the gaps.</strong> Our{" "}
              <Link href="/compare" className="text-orange-700 underline">
                comparison pages
              </Link>{" "}
              say where a competitor is the better choice, and the pricing page says who
              shouldn&apos;t buy. A page that claims to win every comparison is not worth
              reading.
            </li>
          </ul>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-extrabold mb-5">Where Rotahr works</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          Rotahr started in Ireland, and Irish specifics are built in: the 15 minute break at
          four and a half hours and the 30 minute break at six, public holiday detection on the
          rota, and VAT handling that matches how Irish venues actually file.
        </p>
        <p className="text-slate-600 leading-relaxed">
          It is not Ireland only. Billing runs in EUR, GBP, USD, CAD and AUD, the tax label
          changes to Sales Tax, GST/HST or GST depending on the country, and overtime rules
          follow the region. Venues in the UK, the United States, Canada and Australia run on
          the same product.
        </p>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-extrabold mb-5">A note on training</h2>
          <p className="text-slate-600 leading-relaxed">
            Rotahr includes in-house staff training and certification tracking, and we are
            deliberately plain about what that is. It lets you deliver your own training, record
            who completed what and when, track expiry dates on outside certificates, and print a
            completion record showing that you instructed and supervised your staff. It is{" "}
            <strong className="text-slate-900">not an accredited qualification</strong> and it
            does not replace one.
          </p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-extrabold mb-8">Common questions</h2>
        <div className="space-y-4">
          {aboutFaq.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-slate-200 bg-white p-6"
            >
              <summary className="cursor-pointer list-none font-semibold text-slate-900 flex items-center justify-between gap-4">
                {f.q}
                <span className="text-orange-500 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 text-slate-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 pb-24">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-sm text-center">
          <h2 className="text-2xl font-extrabold mb-3">Talk to us</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Questions, feature requests, or you want a look at how it would handle your venue.
            Mail{" "}
            <a href="mailto:sales@rotahr.com" className="text-orange-700 underline">
              sales@rotahr.com
            </a>{" "}
            and it comes to us, not to a queue.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/try"
              className="px-8 py-3 rounded-xl text-white font-semibold hover:opacity-90 transition-all"
              style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
            >
              Explore the live demo
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-500 transition-all"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
