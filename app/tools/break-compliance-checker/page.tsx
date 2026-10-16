import Link from "next/link";
import type { Metadata } from "next";
import BreakComplianceChecker from "@/components/tools/BreakComplianceChecker";
import { jsonLdProps, breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  title: "Break / Rest-Gap Compliance Checker — Ireland & UK | Rotahr",
  description:
    "Check a shift length and break taken against the statutory minimum rest break for Ireland or the UK. Free, no sign-up, nothing saved.",
  alternates: { canonical: "/tools/break-compliance-checker" },
  openGraph: {
    title: "Break / rest-gap compliance checker",
    description: "Shift length and break taken in — a pass/fail against the statutory minimum for Ireland or the UK.",
    url: "/tools/break-compliance-checker",
  },
};

const faq = [
  {
    q: "What's the minimum break for a 6-hour shift in Ireland?",
    a: "Under the Organisation of Working Time Act 1997, a shift of 6 hours or more entitles the worker to a 30-minute break, which may include the earlier 15-minute break that applies from 4.5 hours.",
  },
  {
    q: "What's the minimum break for a 6-hour shift in the UK?",
    a: "Under the Working Time Regulations 1998 (Great Britain) and the Working Time Regulations (Northern Ireland) 2016, a 20-minute break applies once a shift exceeds 6 hours. Exactly 6 hours does not yet trigger it — it's shifts over 6 hours.",
  },
  {
    q: "Does this check rest between shifts, not just breaks within a shift?",
    a: "No — this tool checks only the in-shift rest break tied to shift length. Daily rest between shifts (11 hours in both Ireland and the UK, with some exceptions) and weekly rest are separate rules this tool doesn't check.",
  },
  {
    q: "Is this legal advice?",
    a: "No. It's a general guide based on the published statutory minimums, for a standard adult worker. Young workers, night workers and some sectors have different or additional rules. For anything that actually matters, confirm with the Workplace Relations Commission (Ireland) or Acas / GOV.UK (UK).",
  },
];

export default function BreakComplianceToolPage() {
  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          faqSchema(faq),
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: "Break Compliance Checker", path: "/tools/break-compliance-checker" },
          ]),
        ])}
      />

      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <Link href="/tools" className="hover:text-white">Tools</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">Break Compliance Checker</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
          Break / rest-gap compliance checker
        </h1>
        <p className="text-lg text-slate-200 mb-10 max-w-2xl">
          Enter a shift length and the break actually taken, pick Ireland or
          the UK, and see whether it meets the statutory minimum.
        </p>

        <BreakComplianceChecker />

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
            Build the rota so this is never a question
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            Rotahr's clock in/out tracks breaks against the Irish statutory
            thresholds automatically and reminds staff when one is due. If
            you're in the UK, you still get break tracking and reminders —
            just check the thresholds yourself using this tool until UK rules
            are built in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/register"
              className="bg-gradient-to-r from-[#FF6B35] to-[#E8365D] font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              Start free 3-month trial
            </Link>
            <Link
              href="/tools/labour-cost-percentage"
              className="border border-white/15 px-5 py-2.5 rounded-xl text-sm hover:bg-white/5 transition-colors"
            >
              Try the labour cost calculator →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
