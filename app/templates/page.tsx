import Link from "next/link";
import type { Metadata } from "next";
import {
  freeTemplates,
  templateCategories,
  templatesByCategory,
} from "@/lib/templates";
import {
  jsonLdProps,
  breadcrumbSchema,
  softwareApplicationSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";
import TemplateRequestForm from "./TemplateRequestForm";

export const metadata: Metadata = {
  title: "Free Hospitality Templates — PDF & Excel | Rotahr",
  description:
    "Free restaurant, bar and hotel templates in PDF and Excel — HACCP temperature logs, staff rotas, opening and closing checklists, cleaning schedules, stock counts and tips sheets. No email required.",
  alternates: { canonical: "/templates" },
  openGraph: {
    title: "Free hospitality templates — PDF & Excel",
    description:
      "The paperwork a restaurant, bar or hotel actually runs on. Free to download, no email required.",
    url: "/templates",
  },
};

export default function TemplatesHubPage() {
  // One ItemList for the whole library so the 27 pages read as a collection
  // rather than 27 unrelated downloads.
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free hospitality templates",
    numberOfItems: freeTemplates.length,
    itemListElement: freeTemplates.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: `${SITE_URL}/templates/${t.slug}`,
    })),
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          softwareApplicationSchema(),
          itemList,
          breadcrumbSchema([
            { name: "Rotahr", path: "/landing" },
            { name: "Free templates", path: "/templates" },
          ]),
        ])}
      />

      <div className="max-w-5xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/landing" className="hover:text-white">
            Rotahr
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Free templates</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Free hospitality templates
        </h1>
        <p className="text-lg text-slate-200 mb-6 max-w-2xl">
          {freeTemplates.length} templates for the paperwork a restaurant, bar,
          café or hotel actually runs on — temperature logs, rotas, opening and
          closing checklists, cleaning schedules, stock counts, induction records
          and tips sheets. Every one comes as a printable PDF and an editable
          Excel sheet.
        </p>
        <p className="text-base text-slate-300 mb-4 max-w-2xl leading-relaxed">
          Free, one click, no email address, no sign-up. Print them, edit them,
          put your own logo on them, use them in your venue for as long as you
          like. We build them because we build the app that replaces them — but
          paper works, and a working paper system beats a spreadsheet nobody
          fills in.
        </p>
        <p className="text-sm text-slate-400 mb-12 max-w-2xl leading-relaxed">
          These are written for an international audience. Where a temperature or
          a break threshold is a widely used figure it is printed as one, but
          food safety and employment rules differ by country and change — check
          yours before you rely on any sheet here.
        </p>

        {templateCategories.map((cat) => {
          const items = templatesByCategory(cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} id={cat.id} className="mb-14">
              <h2 className="text-2xl font-bold mb-1">{cat.name}</h2>
              <p className="text-sm text-slate-400 mb-5 max-w-2xl leading-relaxed">
                {cat.blurb}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {items.map((t) => (
                  <div
                    key={t.slug}
                    className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col"
                  >
                    <h3 className="font-semibold text-lg mb-2">
                      <Link
                        href={`/templates/${t.slug}`}
                        className="hover:text-[#FF6B35] transition-colors"
                      >
                        {t.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4 flex-1">
                      {t.answer}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <a
                        href={`/templates/${t.slug}.pdf`}
                        download
                        className="rounded-lg bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-3 py-1.5 font-semibold text-white"
                      >
                        PDF
                      </a>
                      <a
                        href={`/templates/${t.slug}.xlsx`}
                        download
                        className="rounded-lg border border-white/20 px-3 py-1.5 font-semibold text-white hover:border-white/40"
                      >
                        Excel
                      </a>
                      <Link
                        href={`/templates/${t.slug}`}
                        className="text-[#FF6B35] hover:underline"
                      >
                        How to use it →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        <section id="request" className="mb-16">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-2xl font-bold mb-2">
              Need one that isn&apos;t here?
            </h2>
            <p className="text-sm text-slate-300 mb-6 max-w-2xl leading-relaxed">
              Tell us what paperwork you&apos;re missing. We read every request,
              build the ones that come up more than once, and email you when
              yours is live. No newsletter, no sales sequence — one email about
              the template you asked for.
            </p>
            <TemplateRequestForm />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-16">
          <h2 className="text-2xl font-bold mb-3">
            When paper stops being enough
          </h2>
          <p className="text-sm text-slate-300 mb-4 max-w-2xl leading-relaxed">
            A folder of printed sheets works until you need to answer a question
            it can&apos;t: was that fridge in range every day last month, who
            actually worked the hours you&apos;re paying for, which supplier
            price moved. That means reading 30 sheets. Rotahr does the same
            checks on a phone and gives you the answer.
          </p>
          <ul className="text-sm text-slate-300 space-y-2 mb-6 max-w-2xl">
            <li>
              • HACCP checks logged on a phone, with reminders when one is due
              and a PDF export for an inspection.
            </li>
            <li>
              • Rotas built once, published to staff, with hours flowing into
              payroll instead of being retyped.
            </li>
            <li>
              • Stock counts, wastage and supplier prices feeding recipe costs
              automatically.
            </li>
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/landing#pricing"
              className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-5 py-2.5 font-semibold text-white"
            >
              See pricing
            </Link>
            <Link
              href="/features"
              className="rounded-xl border border-white/20 px-5 py-2.5 font-semibold text-white hover:border-white/40"
            >
              What Rotahr does
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
