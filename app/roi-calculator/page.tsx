import Link from "next/link";
import type { Metadata } from "next";
import RoiCalculator from "@/components/tools/RoiCalculator";
import { jsonLdProps, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "ROI Calculator — What Switching to Rotahr Could Cost or Save | Rotahr",
  description:
    "See the monthly and yearly difference between what you pay for separate rota, bookkeeping, reservations and payroll tools versus one Rotahr plan.",
  alternates: { canonical: "/roi-calculator" },
  openGraph: {
    title: "Rotahr ROI calculator",
    description: "Enter what you pay for separate tools today and see the difference against Rotahr Starter or Pro.",
    url: "/roi-calculator",
  },
};

const faq = [
  {
    q: "Where do the starting numbers come from?",
    a: "They match the typical price ranges we quote on the Rotahr homepage for standalone rota, bookkeeping, reservations and HR/payroll tools — not invented figures. Edit any of them to match what you actually pay; the result updates on your numbers, not ours.",
  },
  {
    q: "Does this guarantee I'll save money by switching?",
    a: "No. It's arithmetic on the numbers you enter. If your current tools cost less than the figures shown, or if you need a feature only one of them has, the honest answer might be that switching costs you money or isn't worth the disruption. This calculator won't tell you that — only you can weigh that against the numbers.",
  },
  {
    q: "Which Rotahr plan should I compare against?",
    a: "Starter (€49/month) covers up to 15 staff; Pro (€89/month) covers up to 30 staff and adds the restaurant CRM, in-house training records, payroll summaries and the VAT/P&L dashboard. Use whichever matches your headcount and whether you need those extras.",
  },
];

export default function RoiCalculatorPage() {
  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          faqSchema(faq),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "ROI Calculator", path: "/roi-calculator" },
          ]),
        ])}
      />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">ROI Calculator</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          What would switching actually cost — or save?
        </h1>
        <p className="text-lg text-slate-200 mb-10 max-w-2xl">
          Most venues are paying for 3–4 separate tools that don't talk to
          each other. Enter what you actually pay and see the difference
          against a single Rotahr plan.
        </p>

        <RoiCalculator />

        <h2 className="text-xl font-bold mt-14 mb-5">Questions</h2>
        <div className="space-y-6 mb-14">
          {faq.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold mb-1.5">{f.q}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/auth/register"
            className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Start free 3-month trial
          </Link>
          <Link
            href="/pricing"
            className="border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            See full pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
