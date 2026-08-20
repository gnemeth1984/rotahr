import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  freeTemplates,
  getTemplate,
  getCategory,
  relatedTemplates,
} from "@/lib/templates";
import {
  jsonLdProps,
  breadcrumbSchema,
  faqSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";
import DownloadButtons from "./DownloadButtons";

export function generateStaticParams() {
  return freeTemplates.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) return { title: "Not found" };

  return {
    title: t.title,
    description: t.metaDescription,
    alternates: { canonical: `/templates/${t.slug}` },
    openGraph: {
      title: t.h1,
      description: t.metaDescription,
      url: `/templates/${t.slug}`,
    },
  };
}

const KIND_LABEL: Record<string, string> = {
  log: "Log sheet — blank rows to fill in",
  checklist: "Checklist — pre-printed tasks in sections",
  form: "Form — one record per sheet",
  guide: "Reference sheet — nothing to fill in",
};

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = getTemplate(slug);
  if (!t) notFound();

  const cat = getCategory(t.category);
  const related = relatedTemplates(t.slug);
  const sheet = t.sheet;

  // DigitalDocument rather than SoftwareApplication: what's being offered on
  // this page is the file, and the price is genuinely zero with no gate, so the
  // Offer says so rather than implying a trial.
  const documentSchema = {
    "@context": "https://schema.org",
    "@type": "DigitalDocument",
    name: t.h1,
    description: t.metaDescription,
    url: `${SITE_URL}/templates/${t.slug}`,
    inLanguage: "en",
    encodingFormat: ["application/pdf", "application/vnd.ms-excel", "text/csv"],
    isAccessibleForFree: true,
    license: `${SITE_URL}/templates`,
    publisher: { "@id": `${SITE_URL}/#organization` },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
      availability: "https://schema.org/InStock",
    },
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to use the ${t.name.toLowerCase()}`,
    description: t.answer,
    totalTime: "PT10M",
    step: t.howToUse.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: `Step ${i + 1}`,
      text: s,
    })),
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          documentSchema,
          howToSchema,
          faqSchema(t.faqs),
          breadcrumbSchema([
            { name: "Rotahr", path: "/landing" },
            { name: "Free templates", path: "/templates" },
            { name: t.name, path: `/templates/${t.slug}` },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/landing" className="hover:text-white">
            Rotahr
          </Link>
          <span className="mx-2">/</span>
          <Link href="/templates" className="hover:text-white">
            Free templates
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{t.name}</span>
        </nav>

        {cat && (
          <Link
            href={`/templates#${cat.id}`}
            className="inline-block text-xs uppercase tracking-widest text-[#FF6B35] mb-4 hover:underline"
          >
            {cat.name}
          </Link>
        )}

        <h1 className="text-3xl md:text-5xl font-bold mb-5 leading-tight">
          {t.h1}
        </h1>

        {/* The answer line comes first and names the formats — this is the
            sentence an answer engine lifts. */}
        <p className="text-lg text-slate-200 mb-8 max-w-2xl leading-relaxed">
          {t.answer}
        </p>

        <DownloadButtons slug={t.slug} name={t.name} />

        <div className="space-y-4 mb-12 max-w-2xl">
          {t.body.map((p, i) => (
            <p key={i} className="text-base text-slate-300 leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">What&apos;s on the sheet</h2>
          <p className="text-sm text-slate-400 mb-5">
            {KIND_LABEL[sheet.kind]} ·{" "}
            {sheet.orientation === "landscape" ? "Landscape" : "Portrait"} A4 ·
            PDF, Excel and CSV
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Header fields
            </h3>
            <p className="text-sm text-slate-300">
              {sheet.headerFields.join(" · ")}
            </p>
          </div>

          {sheet.columns && sheet.columns.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Columns
              </h3>
              <ul className="space-y-2">
                {sheet.columns.map((c) => (
                  <li key={c.name} className="text-sm text-slate-300">
                    <span className="font-semibold text-white">{c.name}</span>
                    {c.hint && (
                      <span className="text-slate-400"> — {c.hint}</span>
                    )}
                  </li>
                ))}
              </ul>
              {sheet.extraColumns && sheet.extraColumns.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mt-6 mb-3">
                    Extra columns in the Excel version
                  </h3>
                  <ul className="space-y-2">
                    {sheet.extraColumns.map((c) => (
                      <li key={c.name} className="text-sm text-slate-300">
                        <span className="font-semibold text-white">
                          {c.name}
                        </span>
                        {c.hint && (
                          <span className="text-slate-400"> — {c.hint}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-slate-500 mt-3">
                    These are left off the printable version so the columns stay
                    wide enough to write in by hand.
                  </p>
                </>
              )}
              {sheet.rowCount ? (
                <p className="text-xs text-slate-500 mt-3">
                  {sheet.rowCount} blank rows per sheet.
                </p>
              ) : null}
            </div>
          )}

          {sheet.sections && sheet.sections.length > 0 && (
            <div className="space-y-4">
              {sheet.sections.map((s) => (
                <div
                  key={s.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6"
                >
                  <h3 className="font-semibold mb-3">{s.title}</h3>
                  <ul className="space-y-2">
                    {s.rows.map((r, i) => (
                      <li
                        key={i}
                        className="text-sm text-slate-300 leading-relaxed flex gap-2"
                      >
                        <span className="text-[#FF6B35]">·</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">What you get</h2>
          <ul className="space-y-2 max-w-2xl">
            {t.whatsIncluded.map((w, i) => (
              <li
                key={i}
                className="text-base text-slate-300 leading-relaxed flex gap-3"
              >
                <span className="text-[#FF6B35]">✓</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-5">How to use it</h2>
          <ol className="space-y-4 max-w-2xl">
            {t.howToUse.map((s, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-none w-7 h-7 rounded-full bg-gradient-to-br from-[#ff6b35] to-[#e8365d] text-white text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-base text-slate-300 leading-relaxed pt-0.5">
                  {s}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-5">Questions</h2>
          <div className="space-y-5 max-w-2xl">
            {t.faqs.map((f, i) => (
              <div key={i}>
                <h3 className="font-semibold mb-1.5">{f.q}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-12">
          <h2 className="text-2xl font-bold mb-3">
            Or stop printing it altogether
          </h2>
          <p className="text-sm text-slate-300 mb-5 max-w-2xl leading-relaxed">
            Rotahr does this check on a phone — timestamped, with the person who
            did it attached, reminders when one is due, and a PDF export when
            somebody asks for a month of records. Same job, no folder to search
            through.
          </p>
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

        {related.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-5">Templates that go with it</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/templates/${r.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/25 transition-colors"
                >
                  <h3 className="font-semibold mb-1.5">{r.name}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {r.answer}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="text-sm text-slate-500 max-w-2xl leading-relaxed mb-8">
          Free to print, copy and use in your venue — no attribution required.
          Written for an international audience: where a threshold is a widely
          used figure it is printed as one, but food safety and employment rules
          differ by country and change. Check yours before relying on this sheet.
        </p>

        <Link
          href="/templates"
          className="text-sm text-[#FF6B35] hover:underline"
        >
          ← All free templates
        </Link>
      </div>
    </main>
  );
}
