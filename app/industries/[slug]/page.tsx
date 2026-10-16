import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { industries, getIndustry } from "@/lib/seo/industries";
import { getFeature } from "@/lib/seo/features";
import { getTemplate } from "@/lib/templates";
import { AcquisitionBanner } from "@/components/marketing/AcquisitionBanner";
import {
  jsonLdProps,
  breadcrumbSchema,
  faqSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export function generateStaticParams() {
  return industries.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ind = getIndustry(slug);
  if (!ind) return { title: "Not found" };

  return {
    title: ind.title,
    description: ind.metaDescription,
    alternates: { canonical: `/industries/${ind.slug}` },
    openGraph: {
      title: ind.heading,
      description: ind.metaDescription,
      url: `/industries/${ind.slug}`,
    },
  };
}

export default async function IndustryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ind = getIndustry(slug);
  if (!ind) notFound();

  const relatedFeatures = ind.relevantFeatures
    .map((s) => getFeature(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const relatedTemplates = ind.relevantTemplates
    .map((s) => getTemplate(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const others = industries.filter((x) => x.slug !== ind.slug);

  return (
    <>
    <AcquisitionBanner />
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: ind.heading,
            description: ind.metaDescription,
            url: `${SITE_URL}/industries/${ind.slug}`,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            about: { "@id": `${SITE_URL}/#software` },
          },
          faqSchema(ind.faq),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Industries", path: "/industries" },
            { name: ind.name, path: `/industries/${ind.slug}` },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <Link href="/industries" className="hover:text-white">Industries</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{ind.name}</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          {ind.heading}
        </h1>

        <p className="text-lg text-slate-200 mb-8 max-w-2xl">{ind.answer}</p>

        {ind.body.map((p) => (
          <p key={p.slice(0, 40)} className="text-base text-slate-300 mb-5 max-w-2xl leading-relaxed">
            {p}
          </p>
        ))}

        <div className="flex flex-wrap gap-3 mt-10 mb-16">
          <Link
            href="/auth/register"
            className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Start free 3-month trial
          </Link>
          <Link
            href="/try"
            className="border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            Try live demo
          </Link>
          <Link
            href="/templates"
            className="border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            View free templates
          </Link>
        </div>

        <h2 className="text-2xl font-bold mb-6">
          Where this actually bites, for a {ind.name.toLowerCase()}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-16">
          {ind.painPoints.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h3 className="font-semibold mb-2">{p.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{p.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-16">
          <h2 className="text-xl font-bold mb-3">Who this is for</h2>
          <p className="text-slate-300">{ind.bestFor}</p>
        </div>

        {relatedFeatures.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-6">The modules that matter most</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-16">
              {relatedFeatures.map((f) => (
                <Link
                  key={f.slug}
                  href={`/features/${f.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/25 transition-colors"
                >
                  <h3 className="font-semibold mb-2">{f.name}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{f.answer}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        {relatedTemplates.length > 0 && (
          <>
            <h2 className="text-2xl font-bold mb-6">Free templates to start with</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-16">
              {relatedTemplates.map((t) => (
                <Link
                  key={t.slug}
                  href={`/templates/${t.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/25 transition-colors"
                >
                  <h3 className="font-semibold mb-2">{t.name}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{t.answer}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className="text-2xl font-bold mb-6">Common questions</h2>
        <div className="space-y-5 mb-16">
          {ind.faq.map((q) => (
            <div key={q.q} className="border-b border-white/10 pb-5">
              <h3 className="font-semibold mb-2">{q.q}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{q.a}</p>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-bold mb-6">Other venue types</h2>
        <div className="flex flex-wrap gap-3">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/industries/${o.slug}`}
              className="border border-white/15 px-4 py-2 rounded-xl text-sm hover:bg-white/5 transition-colors"
            >
              {o.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
    </>
  );
}
