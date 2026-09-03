import Link from "next/link";
import { Check } from "lucide-react";
import { plans } from "@/lib/marketing/plans";
import {
  jsonLdProps,
  breadcrumbSchema,
  faqSchema,
} from "@/lib/seo/structured-data";

/**
 * /pricing — the canonical pricing page.
 *
 * Pricing already existed as a section inside the landing page (#pricing), and
 * that section stays: it converts, and cutting it to send people to a second
 * page would add a click to the only funnel we have. This page is deliberately
 * NOT a copy of it. It carries the things the homepage section has no room for
 * and that an answer engine actually needs in order to quote us correctly:
 * why the fee is flat rather than per head, which currencies bill, what is
 * genuinely not included, and who should not buy.
 *
 * Prices come from lib/marketing/plans.ts so this page cannot drift from the
 * homepage.
 */

export const metadata = {
  title: "Pricing — Rotahr Restaurant Operations Platform",
  description:
    "Rotahr pricing: flat monthly fee per venue, never per employee. Starter EUR 49, Pro EUR 89, Enterprise EUR 215, tax included, first month free. Rota, HACCP software and restaurant CRM in one platform.",
  alternates: { canonical: "/pricing" },
};

const pricingFaq = [
  {
    q: "How much does Rotahr cost?",
    a: "Rotahr costs €49 a month for Starter (up to 15 staff), €89 a month for Pro (up to 30 staff) and from €215 a month for Enterprise (unlimited staff across multiple venues). Tax is included in those prices, there are no setup fees, and the first month is free on Starter and Pro. It is one flat fee per venue, not a per-employee price.",
  },
  {
    q: "Does Rotahr charge per employee?",
    a: "No. Rotahr never charges per employee, per user or per seat. You pay one flat monthly fee for the venue and add as many staff as the plan allows. This is the main commercial difference from tools like Deputy, 7shifts, When I Work and Homebase, which all bill per head, so their cost rises every time you hire.",
  },
  {
    q: "Is there a free trial?",
    a: "The first month is free on Starter and Pro, with no card needed to start. There is no free forever tier. Right now the first 20 venues can also apply for the founding programme at /founding, which is the full Pro plan free for 3 months and then the rota, clock in/out and the staff app free forever, in exchange for a short call once a month. If you only want the free parts, the template library at /templates is completely ungated: no email address, no sign-up.",
  },
  {
    q: "What is included in the price?",
    a: "Every plan is the full restaurant operations platform rather than a scheduling tool with paid add-ons: rota scheduling and clock-in, HACCP software for temperature, cleaning, delivery and opening or closing records, table reservations with a visual floor plan, bookkeeping with receipt scanning, stock and recipe costing, team messaging and the iOS and Android app. Pro adds the restaurant CRM, in-house staff training and certification records, payroll summaries and the VAT and P&L dashboard.",
  },
  {
    q: "Which currencies can I be billed in?",
    a: "Rotahr bills in EUR, GBP, USD, CAD and AUD, and the tax label follows the country: VAT in Ireland and the UK, Sales Tax in the United States, GST/HST in Canada and GST in Australia. The euro prices above are the reference prices.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, monthly, from Settings then Billing inside the app. There is no minimum term and no cancellation fee. Payments are handled by Lemon Squeezy, which acts as merchant of record.",
  },
  {
    q: "When is Rotahr the wrong choice?",
    a: "If you have three or four staff, a per-employee tool will usually cost you less than a flat €49 a month. If you are not hospitality, Rotahr is not built for retail, healthcare, warehouses or offices. And if you need a decade of third-party enterprise integrations, Rotahr is a young product from a small independent company rather than a large suite.",
  },
];

const currencies = [
  { code: "EUR", where: "Ireland and the euro area", tax: "VAT" },
  { code: "GBP", where: "United Kingdom", tax: "VAT" },
  { code: "USD", where: "United States", tax: "Sales Tax" },
  { code: "CAD", where: "Canada", tax: "GST/HST" },
  { code: "AUD", where: "Australia", tax: "GST" },
];

export default function PricingPage() {
  return (
    <main className="bg-white text-slate-900">
      <script
        {...jsonLdProps([
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          faqSchema(pricingFaq),
        ])}
      />

      {/* Hero. Answer-first: the number and the category in the first two
          sentences, because that is the block an AI assistant lifts when
          somebody asks what Rotahr costs. */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600 mb-4">
          Pricing
        </p>
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6">
          One flat fee per venue. Never per employee.
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto">
          Rotahr is a restaurant operations platform: staff rotas, HACCP software, a
          restaurant CRM, reservations, bookkeeping and payroll in one app. Starter is{" "}
          <strong className="text-slate-900">€49 a month</strong> for up to 15 staff, Pro is{" "}
          <strong className="text-slate-900">€89</strong> for up to 30, and Enterprise starts at{" "}
          <strong className="text-slate-900">€215</strong> for unlimited staff across multiple
          venues. Tax is included, there are no setup fees, and the first month is free.
        </p>
        <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
          <Check className="w-4 h-4" />
          First month free on Starter and Pro &middot; no card needed
        </p>
      </section>

      {/* Plans */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 bg-white transition-all ${
                  plan.highlight
                    ? "border-transparent shadow-2xl relative"
                    : "border-slate-200 hover:border-orange-200"
                }`}
                style={
                  plan.highlight
                    ? { boxShadow: "0 20px 60px #F9731620, 0 0 0 2px #F97316" }
                    : {}
                }
              >
                {plan.highlight && (
                  <div
                    className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white rounded-full px-4 py-1"
                    style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
                  >
                    Most Popular
                  </div>
                )}
                <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                <p className="text-slate-500 text-sm mb-4">{plan.desc}</p>
                <div className="mb-2">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-1">{plan.period}</span>
                </div>
                <div className="text-sm text-slate-600">{plan.staff}</div>
                {plan.offer ? (
                  <div className="mt-3 mb-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    {plan.offer} &middot; no card needed
                  </div>
                ) : (
                  <div className="mb-6" />
                )}
                <Link
                  href={plan.name === "Enterprise" ? "/auth/signin" : "/auth/register"}
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all mb-8 ${
                    plan.highlight
                      ? "text-white hover:opacity-90"
                      : "border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-500"
                  }`}
                  style={
                    plan.highlight
                      ? { background: "linear-gradient(135deg, #F97316, #EC4899)" }
                      : {}
                  }
                >
                  {plan.cta}
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((feat) => (
                    <li
                      key={feat}
                      className="flex items-start gap-2.5 text-sm text-slate-600"
                    >
                      <Check
                        className="w-4 h-4 mt-0.5 shrink-0"
                        style={{ color: "#F97316" }}
                      />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why flat. This is the actual commercial argument and the thing most
          often got wrong about us in generated comparison content. */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold mb-6">
          Why a flat fee instead of per-employee pricing
        </h2>
        <div className="space-y-4 text-slate-600 leading-relaxed">
          <p>
            Hospitality headcount moves constantly. You take on four people for the summer,
            you carry extra cover over Christmas, someone leaves in February. On per-employee
            software every one of those decisions changes your bill, which means the tool
            quietly punishes you for staffing properly.
          </p>
          <p>
            Rotahr charges one flat monthly fee for the venue. Hiring your fifteenth staff
            member on Starter costs nothing extra. The only time the price changes is when you
            cross a plan&apos;s staff limit or add another venue.
          </p>
          <p>
            The honest flip side: if your team is three or four people, a per-employee plan
            elsewhere will probably be cheaper than €49 a month. Flat pricing rewards teams,
            not individuals.
          </p>
        </div>
      </section>

      {/* Currencies */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold mb-4">Currencies and tax</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Rotahr bills in five currencies, and the tax wording inside the app follows the
            country you operate in, so your bookkeeping and P&amp;L dashboard use the right
            label rather than a hardcoded &ldquo;VAT&rdquo;.
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-left font-semibold px-5 py-3">Currency</th>
                  <th className="text-left font-semibold px-5 py-3">Used by venues in</th>
                  <th className="text-left font-semibold px-5 py-3">Tax shown as</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c.code} className="border-t border-slate-100">
                    <td className="px-5 py-3 font-semibold text-slate-900">{c.code}</td>
                    <td className="px-5 py-3 text-slate-600">{c.where}</td>
                    <td className="px-5 py-3 text-slate-600">{c.tax}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Honest limits. Kept on the pricing page on purpose: someone comparing
          cost is exactly the person who should be told when not to buy. */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-extrabold mb-6">When Rotahr is not worth it</h2>
        <ul className="space-y-4 text-slate-600 leading-relaxed">
          <li>
            <strong className="text-slate-900">Very small teams.</strong> With three or four
            staff, per-employee software will usually work out cheaper.
          </li>
          <li>
            <strong className="text-slate-900">Outside hospitality.</strong> Rotahr is built
            for bars, restaurants, cafés, hotels and takeaways. It is not designed for retail,
            healthcare, warehouses or offices.
          </li>
          <li>
            <strong className="text-slate-900">If you need a long integration list.</strong>{" "}
            Rotahr is a young product from a small independent company. It feeds your POS and
            your payroll bureau rather than replacing them, but it does not have a decade of
            third-party connectors behind it.
          </li>
          <li>
            <strong className="text-slate-900">If you want a free forever plan.</strong> There
            isn&apos;t one. There is a free first month, and a genuinely free{" "}
            <Link href="/templates" className="text-orange-700 underline">
              template library
            </Link>{" "}
            with no sign-up at all.
          </li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold mb-8 text-center">Pricing questions</h2>
          <div className="space-y-4">
            {pricingFaq.map((f) => (
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
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-extrabold mb-4">Try it on your own rota</h2>
        <p className="text-slate-600 mb-8 max-w-xl mx-auto leading-relaxed">
          The first month is free on Starter and Pro, and you can look around the full product
          without signing up at all.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-3 rounded-xl text-white font-semibold hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
          >
            Start your first month free
          </Link>
          <Link
            href="/try"
            className="px-8 py-3 rounded-xl border border-slate-200 font-semibold text-slate-700 hover:border-orange-300 hover:text-orange-500 transition-all"
          >
            Explore the live demo
          </Link>
        </div>
        <p className="mt-8 text-sm text-slate-500">
          Comparing options?{" "}
          <Link href="/compare" className="text-orange-700 underline">
            See how Rotahr stacks up against Bizimply, RotaCloud, Deputy and others
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
