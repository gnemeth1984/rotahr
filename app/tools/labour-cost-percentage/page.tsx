import Link from "next/link";
import type { Metadata } from "next";
import LabourCostCalculator from "@/components/tools/LabourCostCalculator";
import { jsonLdProps, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Labour Cost % Calculator — Free Hospitality Tool | Rotahr",
  description:
    "Work out labour cost as a percentage of revenue for your pub, café or restaurant. Free, no sign-up, nothing saved.",
  alternates: { canonical: "/tools/labour-cost-percentage" },
  openGraph: {
    title: "Labour cost % calculator",
    description: "Revenue in, labour cost in, percentage out — with the commonly cited guideline range for context.",
    url: "/tools/labour-cost-percentage",
  },
};

const faq = [
  {
    q: "What's a good labour cost percentage for a restaurant or café?",
    a: "There's no single right number — it depends on service style, margin and what you count as labour cost. Many operators treat roughly 25–35% of revenue as a common guideline range, but a fine-dining room and a counter-service café can both be healthy at very different percentages.",
  },
  {
    q: "Should I include employer PRSI/NI in labour cost?",
    a: "That's your call, but it's more useful if you do — the real cost of a staff hour includes employer PRSI (Ireland) or employer NI (UK), not just the wage. Using gross wages alone will understate your true cost.",
  },
  {
    q: "Does this calculator save or send my numbers anywhere?",
    a: "No. The calculation runs in your browser only — nothing is saved, logged or sent to Rotahr.",
  },
];

export default function LabourCostToolPage() {
  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          faqSchema(faq),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: "Labour Cost % Calculator", path: "/tools/labour-cost-percentage" },
          ]),
        ])}
      />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <Link href="/tools" className="hover:text-white">Tools</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Labour Cost %</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Labour cost % calculator
        </h1>
        <p className="text-lg text-slate-200 mb-10 max-w-2xl">
          Enter revenue and total labour cost for the same period — a week,
          a month, whatever you've got the numbers for — and see labour cost
          as a percentage of revenue.
        </p>

        <LabourCostCalculator />

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
            Rotahr calculates this automatically
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            Because Rotahr already knows rostered hours, rates and your actual
            revenue, labour cost percentage shows up on its own — no monthly
            spreadsheet exercise.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register"
              className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              Start free 3-month trial
            </Link>
            <Link
              href="/tools/overtime-cost-calculator"
              className="border border-white/15 px-5 py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors"
            >
              Try the overtime calculator →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
