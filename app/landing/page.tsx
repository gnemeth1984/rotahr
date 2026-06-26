// @ts-nocheck
import Link from "next/link"
import Image from "next/image"
import { Check, Zap, ArrowRight } from "lucide-react"
import PageTracker from "@/components/shared/page-tracker"

const features = [
  {
    icon: "📅",
    title: "Rota & Scheduling",
    desc: "Build and publish weekly rotas in minutes. Staff get notified instantly. No more WhatsApp chaos.",
  },
  {
    icon: "🕐",
    title: "Clock In / Out",
    desc: "GPS geofencing ensures staff can only clock in when they're on-site. Full time tracking built in.",
  },
  {
    icon: "🍽️",
    title: "Reservations",
    desc: "Manage table bookings, party sizes and special requests. Notify staff automatically about covers.",
  },
  {
    icon: "🍋",
    title: "Menu & Specials Board",
    desc: "Post daily specials, 86'd items, menu changes and announcements. Every team member sees it instantly.",
  },
  {
    icon: "💸",
    title: "Bookkeeping",
    desc: "Snap a receipt and AI reads it automatically. Track expenses, VAT, P&L and export to CSV.",
  },
  {
    icon: "💼",
    title: "Payroll",
    desc: "Automatic payroll summaries based on hours worked. Reduce manual calculations and errors.",
  },
  {
    icon: "🏖️",
    title: "Time-Off Management",
    desc: "Staff submit requests, managers approve in one tap. AI suggests cover when someone is out.",
  },
  {
    icon: "📆",
    title: "Availability",
    desc: "Staff set their availability preferences. Build rotas that actually work around your team.",
  },
  {
    icon: "💬",
    title: "Team Messaging",
    desc: "In-app messaging for the whole team. No need to share personal numbers.",
  },
  {
    icon: "👥",
    title: "Employee Profiles",
    desc: "Store contacts, emergency info, PPS numbers and medical details securely in one place.",
  },
  {
    icon: "🤖",
    title: "AI Assistant",
    desc: "Ask about schedules, parse booking requests, forecast staffing needs and detect shift conflicts.",
  },
  {
    icon: "📱",
    title: "Mobile App",
    desc: "Native iOS & Android app. Push notifications for shifts, bookings, time-off and messages.",
  },
]

const plans = [
  {
    name: "Starter",
    price: "€49",
    period: "/month incl. VAT",
    desc: "Perfect for small cafés and independent restaurants.",
    staff: "Up to 10 staff",
    highlight: false,
    cta: "Get Started",
    features: [
      "Rota scheduling & publishing",
      "Clock in/out with geofencing",
      "Reservations & table management",
      "Menu & specials board",
      "Bookkeeping & AI receipt scanning",
      "Time-off requests & approvals",
      "Team messaging",
      "Employee profiles",
      "AI booking assistant",
      "Mobile app (iOS & Android)",
      "Email & push notifications",
    ],
  },
  {
    name: "Pro",
    price: "€99",
    period: "/month incl. VAT",
    desc: "For busy restaurants and bars with larger teams.",
    staff: "Up to 30 staff",
    highlight: true,
    cta: "Get Started",
    features: [
      "Everything in Starter",
      "Up to 30 staff members",
      "Department management",
      "Staff availability management",
      "Payroll summaries",
      "Staffing forecast & AI insights",
      "VAT & P&L dashboard",
      "CSV & data export",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "€179+",
    period: "/month incl. VAT",
    desc: "For multi-venue groups, hotel F&B, and franchises.",
    staff: "Unlimited staff",
    highlight: false,
    cta: "Talk to Us",
    features: [
      "Everything in Pro",
      "Unlimited staff & venues",
      "Multi-location management",
      "Custom onboarding & training",
      "Dedicated account manager",
      "Priority support",
      "Custom integrations",
      "Volume discounts available",
    ],
  },
]

const competitors = [
  { name: "Rota & scheduling tool", price: "€80–150/mo" },
  { name: "Bookkeeping & receipt tool", price: "€35–60/mo" },
  { name: "Reservations system", price: "€100+/mo" },
  { name: "HR & payroll tool", price: "€50–80/mo" },
  { name: "Total", price: "€265–390+/mo", bold: true },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <PageTracker />

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
              href="/auth/register"
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

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-4">
          Rotas, clock-in, reservations, bookkeeping, payroll, team messaging and more — all in one place.
        </p>
        <p className="text-base text-slate-400 max-w-xl mx-auto mb-10">
          Replace 4 separate tools with one. Starting at <strong className="text-slate-600">€49/month</strong> incl. VAT.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="flex items-center gap-2 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all shadow-lg w-full sm:w-auto"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)", boxShadow: "0 8px 24px #F9731630" }}
          >
            Get Started <ArrowRight className="w-4 h-4" />
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
          <p className="text-center text-sm font-semibold text-slate-600 mb-2">What you'd pay using separate tools</p>
          <p className="text-center text-xs text-slate-400 mb-6">Most Irish venues are paying for 3–4 tools that don't talk to each other</p>
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
                Rotahr — everything included
              </span>
              <span className="text-sm font-bold" style={{ color: "#F97316" }}>from €49/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold mb-4">Everything your venue needs</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            12 tools in one platform. Built specifically for bars, restaurants and cafés in Ireland.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.title}
              className="p-5 rounded-2xl border border-slate-100 hover:border-orange-200 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-base mb-1.5 group-hover:text-orange-500 transition-colors">{f.title}</h3>
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
                  href={plan.name === "Enterprise" ? "/auth/signin" : "/auth/register"}
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

          <p className="text-center text-sm text-slate-400 mt-8">
            Enterprise pricing is custom — <Link href="/auth/signin" className="text-orange-500 hover:underline">contact us</Link> to get started.
          </p>
        </div>
      </section>

      {/* CTA banner */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="rounded-3xl px-8 py-16 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E1035 100%)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 120%, #F9731630 0%, transparent 60%)" }} />
          <Image src="/logo-dark.png" alt="Rotahr" width={130} height={42} className="object-contain mx-auto mb-8" />
          <h2 className="text-3xl font-extrabold text-white mb-4">Ready to simplify your operations?</h2>
          <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
            Join hospitality businesses across Ireland already using Rotahr to manage their teams and venues.
          </p>
          <Link
            href="/auth/register"
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
