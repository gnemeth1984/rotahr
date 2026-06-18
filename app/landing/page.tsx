// @ts-nocheck
import Link from "next/link"
import Image from "next/image"
import { Check, Zap, ArrowRight } from "lucide-react"

const features = [
  {
    icon: "📅",
    title: "Shift Scheduling",
    desc: "Build and publish rotas in minutes. Staff get notified instantly. No more WhatsApp chaos.",
  },
  {
    icon: "🍽️",
    title: "Reservations",
    desc: "Manage table bookings, party sizes and customer details. Notify staff about specific covers.",
  },
  {
    icon: "💸",
    title: "Bookkeeping",
    desc: "Snap a receipt, AI reads it automatically. Track expenses, VAT, P&L and export to CSV.",
  },
  {
    icon: "🏖️",
    title: "Time-Off Management",
    desc: "Staff submit requests, managers approve. AI suggests cover when someone is out.",
  },
  {
    icon: "👥",
    title: "Employee Profiles",
    desc: "Store contacts, emergency info, PPS numbers and medical details securely in one place.",
  },
  {
    icon: "🤖",
    title: "AI Assistant",
    desc: "Ask about schedules, parse booking requests and forecast staffing needs.",
  },
]

const plans = [
  {
    name: "Starter",
    price: "€49.99",
    period: "/month incl. VAT",
    desc: "Perfect for small venues getting started.",
    staff: "Up to 10 staff",
    highlight: false,
    cta: "Get Started",
    features: [
      "Shift scheduling & publishing",
      "Reservations & table management",
      "Time-off requests & approvals",
      "Employee profiles",
      "Expense tracking & receipt upload",
      "AI assistant",
      "Email notifications",
    ],
  },
  {
    name: "Pro",
    price: "€69.99",
    period: "/month incl. VAT",
    desc: "For growing venues with larger teams.",
    staff: "Up to 30 staff",
    highlight: true,
    cta: "Start Free Trial",
    features: [
      "Everything in Starter",
      "Up to 30 staff members",
      "Department management",
      "Staffing forecast reports",
      "VAT & P&L dashboard",
      "CSV export",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "pricing",
    desc: "For multi-venue groups and franchises.",
    staff: "Unlimited staff",
    highlight: false,
    cta: "Contact Us",
    features: [
      "Everything in Pro",
      "Unlimited staff & venues",
      "Multi-location management",
      "Custom onboarding",
      "Dedicated account manager",
      "SLA guarantee",
      "Custom integrations",
    ],
  },
]

const competitors = [
  { name: "Rotaready (scheduling)", price: "€80–150/mo" },
  { name: "Xero (bookkeeping)", price: "€35–50/mo" },
  { name: "ResDiary (reservations)", price: "€100+/mo" },
  { name: "Total", price: "€215–300+/mo", bold: true },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image src="/logo-light.png" alt="Rotahr" width={110} height={36} className="object-contain" priority />
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link
              href="/auth/signin"
              className="text-sm px-4 py-2 rounded-lg font-medium text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        {/* background glow */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-10"
            style={{ background: "radial-gradient(ellipse, #F97316 0%, #EC4899 50%, transparent 70%)" }} />
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border"
          style={{ borderColor: "#F9731640", color: "#F97316", background: "#FFF7F0" }}>
          <Zap className="w-3 h-3" />
          Built for Irish hospitality
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          One app to run<br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #F97316, #EC4899)" }}>
            your entire venue
          </span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
          Staff rotas, table reservations, bookkeeping and HR — all in one place. Replace three tools with one. Starting at €49.99/month.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/signin"
            className="flex items-center gap-2 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all shadow-lg w-full sm:w-auto"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)", boxShadow: "0 8px 24px #F9731630" }}
          >
            Start Free Trial <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#pricing"
            className="border border-slate-200 text-slate-700 px-8 py-3.5 rounded-xl text-base font-medium hover:border-slate-400 transition-colors w-full sm:w-auto"
          >
            View Pricing
          </a>
        </div>
      </section>

      {/* vs competitors */}
      <section className="py-12" style={{ background: "#FFF7F0" }}>
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-center text-sm text-slate-500 mb-6">What you'd pay using separate tools</p>
          <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm">
            {competitors.map((c) => (
              <div
                key={c.name}
                className={`flex justify-between items-center px-6 py-4 border-b border-slate-100 last:border-0 ${c.bold ? "bg-red-50" : ""}`}
              >
                <span className={`text-sm ${c.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>{c.name}</span>
                <span className={`text-sm ${c.bold ? "font-bold text-red-500" : "text-slate-500"}`}>{c.price}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-6 py-4" style={{ background: "linear-gradient(135deg, #FFF7F0, #FFF0F8)" }}>
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Image src="/logo-icon.png" alt="" width={20} height={20} className="object-contain" />
                Rotahr (all-in-one)
              </span>
              <span className="text-sm font-bold" style={{ color: "#F97316" }}>from €49.99/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold mb-4">Everything your venue needs</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Built specifically for bars, restaurants and cafes in Ireland.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title}
              className="p-6 rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-md transition-all group"
            >
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-bold text-lg mb-2 group-hover:text-orange-500 transition-colors">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-500 text-lg">All prices include 23% Irish VAT. No setup fees. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 bg-white transition-all ${
                  plan.highlight
                    ? "border-transparent shadow-2xl scale-105 relative"
                    : "border-slate-200 hover:border-orange-200"
                }`}
                style={plan.highlight ? { boxShadow: "0 20px 60px #F9731620, 0 0 0 2px #F97316" } : {}}
              >
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-xs font-bold text-white rounded-full px-4 py-1"
                    style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}>
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{plan.desc}</p>
                <div className="mb-2">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-1">{plan.period}</span>
                </div>
                <div className="text-sm text-slate-400 mb-6">{plan.staff}</div>
                <Link
                  href="/auth/signin"
                  className={`block text-center py-3 rounded-xl text-sm font-semibold transition-all mb-8 ${
                    plan.highlight
                      ? "text-white hover:opacity-90"
                      : "border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-500"
                  }`}
                  style={plan.highlight ? { background: "linear-gradient(135deg, #F97316, #EC4899)" } : {}}
                >
                  {plan.cta}
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#F97316" }} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="rounded-3xl px-8 py-16 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E1035 100%)" }}>
          {/* glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 120%, #F9731630 0%, transparent 60%)" }} />
          <Image src="/logo-dark.png" alt="Rotahr" width={130} height={42} className="object-contain mx-auto mb-8" />
          <h2 className="text-3xl font-extrabold text-white mb-4">Ready to simplify your operations?</h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join hospitality businesses across Ireland already using Rotahr to manage their teams.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-2 text-white px-10 py-4 rounded-xl text-base font-semibold hover:opacity-90 transition-all"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)", boxShadow: "0 8px 32px #F9731640" }}
          >
            Get Started Free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <Image src="/logo-light.png" alt="Rotahr" width={80} height={26} className="object-contain" />
          <span>© 2026 Rotahr. All rights reserved.</span>
          <span>Ireland — VAT included in all prices</span>
        </div>
      </footer>
    </div>
  )
}
