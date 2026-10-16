import Link from "next/link";
import type { Metadata } from "next";
import {
  jsonLdProps,
  breadcrumbSchema,
  SITE_URL,
} from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Free Hospitality Tools — Labour Cost, Overtime & Break Calculators",
  description:
    "Free calculators for pubs, cafés and restaurants: labour cost percentage, overtime cost, and a break/rest-gap compliance checker for Ireland and the UK. No sign-up.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free hospitality tools from Rotahr",
    description:
      "Labour cost, overtime cost and break compliance — three free calculators, no sign-up required.",
    url: "/tools",
  },
};

const TOOLS = [
  {
    slug: "labour-cost-percentage",
    name: "Labour Cost % Calculator",
    desc: "Enter revenue and labour cost for a period and see labour cost as a percentage of revenue, with the commonly cited guideline range for context.",
  },
  {
    slug: "overtime-cost-calculator",
    name: "Overtime Cost Calculator",
    desc: "Enter hourly rate, overtime hours and your own multiplier to see the weekly, monthly and yearly cost of overtime, and how much of it is the premium itself.",
  },
  {
    slug: "break-compliance-checker",
    name: "Break / Rest-Gap Compliance Checker",
    desc: "Enter a shift length and the break actually taken, and check it against the statutory minimum break for Ireland or the UK.",
  },
];

export default function ToolsIndexPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Rotahr free hospitality tools",
    itemListElement: TOOLS.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: `${SITE_URL}/tools/${t.slug}`,
    })),
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          itemList,
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Tools", path: "/tools" },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Tools</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Free tools for running the floor
        </h1>
        <p className="text-lg text-slate-200 mb-12 max-w-2xl">
          Three small calculators, no sign-up, nothing saved. Useful whether
          or not you ever use Rotahr — these are the sums every rota ends up
          needing sooner or later.
        </p>

        <div className="grid sm:grid-cols-1 gap-4 mb-16">
          {TOOLS.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-white/25 transition-colors block"
            >
              <h2 className="font-semibold text-lg mb-2">{t.name}</h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-3">{t.desc}</p>
              <span className="text-sm text-[#FF6B35]">Open the tool →</span>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-14">
          <h2 className="text-lg font-semibold mb-2">Want this built into your rota?</h2>
          <p className="text-sm text-slate-300 mb-4">
            Rotahr already knows your actual rostered hours and rates, so
            labour cost and overtime show up automatically instead of being a
            calculator you run after the fact.
          </p>
          <Link
            href="/roi-calculator"
            className="text-sm text-[#FF6B35] hover:underline"
          >
            See what switching could save you →
          </Link>
        </div>

        <div className="flex flex-wrap gap-3">
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
        </div>

        <p className="text-sm text-slate-500 mt-10">
          Looking for templates, comparisons or the blog?{" "}
          <Link href="/resources" className="text-[#FF6B35] hover:underline">
            See all Rotahr resources →
          </Link>
        </p>
      </div>
    </main>
  );
}
