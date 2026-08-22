import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { features, getFeature } from "@/lib/seo/features";
import { competitors } from "@/lib/seo/competitors";
import {
  jsonLdProps,
  breadcrumbSchema,
  faqSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export function generateStaticParams() {
  return features.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) return { title: "Not found" };

  return {
    title: f.title,
    description: f.metaDescription,
    alternates: { canonical: `/features/${f.slug}` },
    openGraph: {
      title: f.heading,
      description: f.metaDescription,
      url: `/features/${f.slug}`,
    },
  };
}

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) notFound();

  const related = f.related
    .map((s) => getFeature(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const others = features.filter((x) => x.slug !== f.slug);

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: f.heading,
            description: f.metaDescription,
            url: `${SITE_URL}/features/${f.slug}`,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            about: { "@id": `${SITE_URL}/#software` },
          },
          faqSchema(f.faq),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Features", path: "/features" },
            { name: f.name, path: `/features/${f.slug}` },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <Link href="/features" className="hover:text-white">Features</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">{f.name}</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          {f.heading}
        </h1>

        {/* Answer first, in one quotable sentence — this is what answer engines
            lift, and what the site audit's answer-shape check looks for. */}
        <p className="text-lg text-slate-200 mb-8 max-w-2xl">{f.answer}</p>

        {f.body.map((p) => (
          <p key={p.slice(0, 40)} className="text-base text-slate-300 mb-5 max-w-2xl leading-relaxed">
            {p}
          </p>
        ))}

        <div className="flex flex-wrap gap-3 mt-10 mb-16">
          <Link
            href="/try"
            className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Try the live demo
          </Link>
          <Link
            href="/#pricing"
            className="border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            See pricing
          </Link>
        </div>

        <h2 className="text-2xl font-bold mb-6">What it does</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-16">
          {f.capabilities.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <h3 className="font-semibold mb-2">{c.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{c.detail}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-8">
          <h2 className="text-xl font-bold mb-3">Who this is for</h2>
          <p className="text-slate-300">{f.bestFor}</p>
        </div>

        {/* Stated limits, deliberately. Prospects trust a page that admits what
            it does not do, and it filters out the wrong customers early. */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-16">
          <h2 className="text-xl font-bold mb-3">What it doesn&apos;t do</h2>
          <ul className="space-y-3">
            {f.limits.map((l) => (
              <li key={l} className="flex gap-3 text-slate-300 text-sm">
                <span className="text-[#FF6B35] mt-0.5">—</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>

        <h2 className="text-2xl font-bold mb-6">Common questions</h2>
        <div className="space-y-5 mb-16">
          {f.faq.map((q) => (
            <div key={q.q} className="border-b border-white/10 pb-5">
              <h3 className="font-semibold mb-2">{q.q}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{q.a}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E8365D] p-8 text-center mb-16">
          <h2 className="text-2xl font-bold mb-3">See it with real data</h2>
          <p className="mb-6 text-white/90">
            A full demo venue, nothing to sign up for. First month free if you keep it.
          </p>
          <Link
            href="/try"
            className="inline-block bg-white text-[#0F1C35] font-semibold px-7 py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Open the demo
          </Link>
        </div>

        {related.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mb-4">Works with</h2>
            <div className="grid sm:grid-cols-2 gap-4 mb-12">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/features/${r.slug}`}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 hover:border-white/25 transition-colors"
                >
                  <h3 className="font-semibold mb-1">{r.name}</h3>
                  <p className="text-sm text-slate-400">{r.metaDescription}</p>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 className="text-lg font-semibold mb-4">Everything else in Rotahr</h2>
        <div className="flex flex-wrap gap-2 mb-10">
          {others.map((o) => (
            <Link
              key={o.slug}
              href={`/features/${o.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              {o.name}
            </Link>
          ))}
        </div>

        <h2 className="text-lg font-semibold mb-4">Comparing options?</h2>
        <div className="flex flex-wrap gap-2">
          {competitors.slice(0, 5).map((o) => (
            <Link
              key={o.slug}
              href={`/compare/${o.slug}`}
              className="text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:border-white/25 transition-colors"
            >
              Rotahr vs {o.name}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
