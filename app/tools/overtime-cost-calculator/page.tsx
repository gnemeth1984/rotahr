import Link from "next/link";
import type { Metadata } from "next";
import OvertimeCostCalculator from "@/components/tools/OvertimeCostCalculator";
import { jsonLdProps, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Overtime Cost Calculator — Free Hospitality Tool | Rotahr",
  description:
    "See the weekly, monthly and yearly cost of overtime for your pub, café or restaurant. Free, no sign-up, nothing saved.",
  alternates: { canonical: "/tools/overtime-cost-calculator" },
  openGraph: {
    title: "Overtime cost calculator",
    description: "Hourly rate, overtime hours and your multiplier in — weekly, monthly and yearly cost out.",
    url: "/tools/overtime-cost-calculator",
  },
};

const faq = [
  {
    q: "What overtime multiplier should I use?",
    a: "That depends on the contract and any sector agreement that applies to the role — 1.5x is a common default in a lot of hospitality rostering, but it isn't a legal minimum everywhere and it isn't something Rotahr sets for you. Check the actual contract.",
  },
  {
    q: "Does this account for Irish or UK overtime law specifically?",
    a: "No. Neither Ireland nor the UK sets a blanket statutory overtime premium in law the way some other countries do — overtime pay comes from the contract, a collective agreement, or company policy. This tool just multiplies the numbers you give it.",
  },
  {
    q: "Why does it show a monthly and yearly figure if I only entered weekly hours?",
    a: "It annualises the weekly figure using 4.33 weeks per month and 52 weeks per year, so you can see what a recurring weekly pattern actually costs over a longer period. If your overtime is irregular, the weekly figure is the more honest one to use.",
  },
];

export default function OvertimeCostToolPage() {
  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          faqSchema(faq),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: "Overtime Cost Calculator", path: "/tools/overtime-cost-calculator" },
          ]),
        ])}
      />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <Link href="/tools" className="hover:text-white">Tools</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Overtime Cost</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Overtime cost calculator
        </h1>
        <p className="text-lg text-slate-200 mb-10 max-w-2xl">
          Enter the base rate, the overtime hours and the multiplier that
          actually applies, and see what that overtime costs weekly, monthly
          and yearly.
        </p>

        <OvertimeCostCalculator />

        <h2 className="text-xl font-bold mt-14 mb-5">Questions</h2>
        <div className="space-y-6 mb-14">
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold mb-1.5">{f.q}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 mb-10">
          <h2 className="text-lg font-semibold mb-2">
            See overtime before it happens, not after
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            Rotahr flags projected overtime while you're still building the
            rota, so it's a decision you make on purpose rather than a line
            you spot on the payroll run.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register"
              className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              Start free 3-month trial
            </Link>
            <Link
              href="/tools/break-compliance-checker"
              className="border border-white/15 px-5 py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors"
            >
              Try the break compliance checker →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
