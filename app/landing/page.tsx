// @ts-nocheck
import Link from "next/link"
import { Check } from "lucide-react"

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
          <span className="text-xl font-bold tracking-tight">Rotahr</span>
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
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          Built for Irish hospitality
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
          One app to run<br />
          <span className="text-slate-400">your entire venue</span>
        </h1>
        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-10">
          Staff rotas, table reservations, bookkeeping and HR — all in one place. Replace three tools with one. Starting at €49.99/month.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/signin"
            className="bg-slate-900 text-white px-8 py-3.5 rounded-lg text-base font-medium hover:bg-slate-700 transition-colors w-full sm:w-auto"
          >
            Start Free Trial
          </Link>
          <a
            href="#pricing"
            className="border border-slate-200 text-slate-700 px-8 py-3.5 rounded-lg text-base font-medium hover:border-slate-400 transition-colors w-full sm:w-auto"
          >
            View Pricing
          </a>
        </div>
      </section>

      {/* vs competitors */}
      <section className="bg-slate-50 py-12">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-center text-sm text-slate-500 mb-6">What you would pay using separate tools</p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {competitors.map((c) => (
              <div
                key={c.name}
                className={`flex justify-between items-center px-6 py-4 border-b border-slate-100 last:border-0 ${c.bold ? "bg-red-50" : ""}`}
              >
                <span className={`text-sm ${c.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>{c.name}</span>
                <span className={`text-sm ${c.bold ? "font-bold text-red-600" : "text-slate-500"}`}>{c.price}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-6 py-4 bg-green-50">
              <span className="text-sm font-bold text-slate-900">Rotahr (all-in-one)</span>
              <span className="text-sm font-bold text-green-600">from 49.99/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold mb-4">Everything your venue needs</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Built specifically for bars, restaurants and cafes in Ireland.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-xl border border-slate-100 hover:border-slate-300 transition-colors">
              <div className="text-3xl mb-4">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-500 text-lg">All prices include 23% Irish VAT. No setup fees. Cancel anytime.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 bg-white ${
                  plan.highlight
                    ? "border-slate-900 shadow-xl scale-105"
                    : "border-slate-200"
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-semibold bg-slate-900 text-white rounded-full px-3 py-1 inline-block mb-4">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-slate-500 text-sm mb-4">{plan.desc}</p>
                <div className="mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-slate-500 text-sm ml-1">{plan.period}</span>
                </div>
                <div className="text-sm text-slate-500 mb-6">{plan.staff}</div>
                <Link
                  href="/auth/signin"
                  className={`block text-center py-3 rounded-lg text-sm font-medium transition-colors mb-8 ${
                    plan.highlight
                      ? "bg-slate-900 text-white hover:bg-slate-700"
                      : "border border-slate-300 text-slate-700 hover:border-slate-500"
                  }`}
                >
                  {plan.cta}
                </Link>
                <ul className="space-y-3">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to simplify your operations?</h2>
        <p className="text-slate-500 text-lg mb-8 max-w-xl mx-auto">
          Join hospitality businesses across Ireland already using Rotahr to manage their teams.
        </p>
        <Link
          href="/auth/signin"
          className="bg-slate-900 text-white px-10 py-4 rounded-lg text-base font-medium hover:bg-slate-700 transition-colors inline-block"
        >
          Get Started Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span className="font-semibold text-slate-600">Rotahr</span>
          <span>2026 Rotahr. All rights reserved.</span>
          <span>Ireland - VAT included in all prices</span>
        </div>
      </footer>
    </div>
  )
}
