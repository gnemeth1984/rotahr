// @ts-nocheck
import Link from "next/link"
import Image from "next/image"
import { Check, Zap, ArrowRight } from "lucide-react"
// Aliased: this file already has a local `competitors` array (the
// "what you'd pay for separate tools" list), which would otherwise collide.
import { competitors as competitorPages } from "@/lib/seo/competitors"
// Plan cards live in lib/marketing/plans.ts so this section and /pricing
// cannot drift apart on price.
import { plans } from "@/lib/marketing/plans"
// Founding programme copy and the real granted-spot count. The number shown
// here is read from the database, never hardcoded — see the note in that file.
import { foundingStatus, TERM_MONTHS } from "@/lib/marketing/founding"
import { locations } from "@/lib/seo/locations"
import { features as featurePages } from "@/lib/seo/features"
import { CAPTERRA_URL, hasCapterraListing } from "@/lib/capterra"
import {
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
  jsonLdProps,
  faqSchema,
} from "@/lib/seo/structured-data"

// No `metadata` export here any more: this is a plain component, not a route.
// `/` owns the canonical URL and declares its own metadata; `/landing`
// permanently redirects to `/` (see the redirects block in next.config.mjs).

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
    icon: "🎓",
    title: "Training & Certifications",
    desc: "Thirteen in-house courses built from your own menu, equipment and logs. Pass mark, 12-month expiry, printable record. Not accredited.",
  },
  {
    icon: "🔧",
    title: "Equipment & Servicing",
    desc: "Every asset with its warranty, service history and paperwork. Warned 30 and 7 days before a service or warranty falls due.",
  },
  {
    icon: "⭐",
    title: "Guest CRM & Loyalty",
    desc: "Profiles built from your bookings, with spend history, loyalty tiers and points. Campaigns wait as drafts until you approve them.",
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

const competitors = [
  { name: "Rota & scheduling tool", price: "€80–150/mo" },
  { name: "Bookkeeping & receipt tool", price: "€35–60/mo" },
  { name: "Reservations system", price: "€100+/mo" },
  { name: "HR & payroll tool", price: "€50–80/mo" },
  { name: "Total", price: "€265–390+/mo", bold: true },
]

// Answer-shaped FAQ. Two jobs: it is the section answer engines quote when
// someone asks "how much is Rotahr" or "does it replace my POS", and it gives
// the landing page real substance beyond feature bullets.
const landingFaq = [
  {
    q: "What is Rotahr?",
    a: "Rotahr is a restaurant operations platform for hospitality venues. It combines staff rota scheduling and clock-in, HACCP software for food safety compliance, a restaurant CRM built automatically from your own reservations, table bookings, stock and recipe costing, bookkeeping and in-house staff training in a single app. It suits bars, restaurants, cafés, hotels and takeaways, and it replaces the rota spreadsheet, the paper HACCP diary and the booking diary. Plans start at €49 a month with tax included and the first month free.",
  },
  {
    q: "What does Rotahr actually replace?",
    a: "For most venues it replaces four things: the rota spreadsheet plus the staff WhatsApp group, the paper HACCP diary, the booking diary, and the carrier bag of receipts. It does not replace your POS or your payroll bureau — it feeds them.",
  },
  {
    q: "Does Rotahr work for a multi-location group?",
    a: "Yes. Every location sits under one account with its own address, clock-in geofence, timezone, capacity, equipment list and opening, closing and cleaning checklists. Shifts are assigned to a location, so labour cost and overtime break down per site. Enterprise is the multi-location plan at €215 a month for unlimited staff across your venues. One honest limit: revenue is tracked for the business as a whole rather than per site, because POS snapshots arrive business-wide.",
  },
  {
    q: "How much does Rotahr cost?",
    a: "Starter is €49 a month for up to 15 staff, Pro is €89 for up to 30, and Enterprise is €215 for unlimited staff across multiple venues. Tax is included in those prices, there are no setup fees, and the first month is free.",
  },
  {
    q: "Is it priced per member of staff?",
    a: "No. Pricing is a flat monthly fee per band, so hiring four people for the summer does not change your bill. Per-user pricing punishes exactly the churn hospitality runs on.",
  },
  {
    q: "Do my staff need to be technical?",
    a: "Staff only ever see their own shifts, their hours, their swap requests and the checks they need to log. In practice the training is showing someone the clock-in button once.",
  },
  {
    q: "Can I use Rotahr outside Ireland?",
    a: "Yes. EUR, USD, GBP, CAD and AUD are supported, and the tax wording follows the jurisdiction — VAT in Ireland and the UK, sales tax in the US, GST/HST in Canada, GST in Australia. Statutory break thresholds are currently modelled on Irish rules, so operators elsewhere should sanity-check those against local law.",
  },
  {
    q: "What happens to my data if I leave?",
    a: "You can export your expenses, guest records and HACCP history as CSV or PDF before you go. Nothing is held hostage, and there is no annual lock-in — the plans are monthly.",
  },
  {
    q: "Does it integrate with my POS?",
    a: "Square connects in a couple of clicks from Settings → POS. It is the only till we support today. A POS connection is worth having for sales-driven stock depletion and demand-aware staffing, but everything else in Rotahr works fully without one — most venues run it that way.",
  },
]

export default async function LandingPage() {
  // Async because the founding band shows the real number of spots left.
  // `/` is an async server component already, so this costs nothing extra.
  const founding = await foundingStatus()
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script
        {...jsonLdProps([
          organizationSchema(),
          websiteSchema(),
          softwareApplicationSchema(),
          faqSchema(landingFaq),
        ])}
      />
      {/* Nav */}
      <header className="border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Image src="/logo-light.png" alt="Rotahr" width={110} height={36} className="object-contain" priority />
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <Link href="/features" className="hover:text-slate-900 transition-colors">Features</Link>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">Pricing</a>
            <Link href="/compare" className="hover:text-slate-900 transition-colors">Compare</Link>
            <Link href="/templates" className="hover:text-slate-900 transition-colors">
              Templates <span className="text-emerald-600 font-medium">free</span>
            </Link>
            <Link href="/list" className="hover:text-slate-900 transition-colors">
              List your venue <span className="text-emerald-600 font-medium">free</span>
            </Link>
            <Link href="/blog" className="hover:text-slate-900 transition-colors">Blog</Link>
            <Link href="/try" className="hover:text-slate-900 transition-colors">
              Live demo <span className="text-emerald-600 font-medium">no signup</span>
            </Link>
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

      <main>
      {/* Hero */}
      <section className="relative overflow-hidden max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full opacity-10"
            style={{ background: "radial-gradient(ellipse, #F97316 0%, #EC4899 50%, transparent 70%)" }} />
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border"
          style={{ borderColor: "#F9731640", color: "#C2410C", background: "#FFF7F0" }}>
          <Zap className="w-3 h-3" />
          Built for hospitality teams
        </div>

        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
          One app to run<br />
          <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, #F97316, #EC4899)" }}>
            your entire venue
          </span>
        </h1>

        <p className="text-xl text-slate-500 max-w-2xl mx-auto mb-4">
          Rotahr is a restaurant operations platform: staff scheduling and rotas, clock-in, HACCP software, a built-in
          restaurant CRM, reservations, bookkeeping, payroll, staff training, equipment servicing and team
          messaging — all in one place.
        </p>
        <p className="text-base text-slate-600 max-w-xl mx-auto mb-10">
          Replace 4 separate tools with one. Starting at <strong className="text-slate-600">€49/month</strong> incl. VAT —{" "}
          <strong className="text-emerald-700">first month free</strong>, cancel anytime.
        </p>

        {/*
          The demo is deliberately a co-primary CTA, not a footer link.

          Why: in one 30-day window this page had ~230 views and /auth/register
          got 2 — while /auth/signin got 128. People wanted to look before
          committing, and the only door to looking was a *sign-in* page. With no
          customer logos to lean on (and we don't invent any), "see inside
          without signing up" is the strongest thing this page can offer, so it
          sits next to the primary CTA instead of at the bottom of the footer.

          /try is now a real demo chooser page (app/try/page.tsx): venue cards,
          one click to enter, no sign-in form anywhere on it. It used to redirect
          to /auth/signin, which meant this CTA landed on a page headed "Sign in".
        */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="flex items-center gap-2 text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 transition-all shadow-lg w-full sm:w-auto"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)", boxShadow: "0 8px 24px #F9731630" }}
          >
            Get Started <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/try"
            className="flex items-center justify-center gap-2 border-2 px-8 py-3.5 rounded-xl text-base font-semibold transition-colors w-full sm:w-auto"
            style={{ borderColor: "#F97316", color: "#C2410C" }}
          >
            Explore the live demo
          </Link>
        </div>
        <p className="text-sm text-slate-500 mt-4">
          The demo is a real venue with staff, rotas and bookings already in it —
          no signup, no card. Or <a href="#pricing" className="underline decoration-slate-300 underline-offset-4 hover:text-slate-700">jump to pricing</a>.
        </p>
      </section>

      {/* vs competitors */}
      <section className="py-12" style={{ background: "#FFF7F0" }}>
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-center text-sm font-semibold text-slate-600 mb-2">What you'd pay using separate tools</p>
          <p className="text-center text-xs text-slate-600 mb-6">Most venues are paying for 3–4 tools that don't talk to each other</p>
          <div className="bg-white rounded-2xl border border-orange-100 overflow-hidden shadow-sm">
            {competitors.map((c) => (
              <div
                key={c.name}
                className={`flex justify-between items-center px-6 py-4 border-b border-slate-100 last:border-0 ${c.bold ? "bg-red-50" : ""}`}
              >
                <span className={`text-sm ${c.bold ? "font-bold text-slate-900" : "text-slate-600"}`}>{c.name}</span>
                <span className={`text-sm ${c.bold ? "font-bold text-red-700" : "text-slate-500"}`}>{c.price}</span>
              </div>
            ))}
            <div className="flex justify-between items-center px-6 py-4" style={{ background: "linear-gradient(135deg, #FFF7F0, #FFF0F8)" }}>
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Image src="/logo-icon.png" alt="" width={20} height={20} className="object-contain" />
                Rotahr — everything included
              </span>
              <span className="text-sm font-bold" style={{ color: "#C2410C" }}>from €49/mo</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold mb-4">
            Everything your venue needs in one restaurant operations platform
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            12 tools in one platform. Built specifically for bars, restaurants and cafés — a single
            site or a multi-location group.
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
            <p className="text-slate-500 text-lg">All prices include VAT/tax. No setup fees. Cancel anytime.</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <Check className="w-4 h-4" />
              First month free on Starter and Pro
            </p>
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
                <div className="text-sm text-slate-600">{plan.staff}</div>
                {plan.offer ? (
                  <div className="mt-3 mb-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Check className="w-3.5 h-3.5" />
                    {plan.offer} · no card needed
                  </div>
                ) : (
                  <div className="mb-6" />
                )}
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

          <p className="text-center text-sm text-slate-600 mt-8">
            Enterprise pricing is custom — <Link href="/auth/signin" className="text-orange-700 underline">contact us</Link> to get started.
          </p>
          {/* The homepage section stays the primary conversion path; /pricing is
              the canonical page for the detail that does not fit here (flat vs
              per-head, currencies, who should not buy). */}
          <p className="text-center text-sm text-slate-600 mt-3">
            <Link href="/pricing" className="text-orange-700 underline">
              Full pricing details, currencies and what is not included
            </Link>
          </p>
        </div>
      </section>

      {/*
        Founding member band.

        Sits immediately after pricing because it answers the objection the
        price just created. The spot count is the live database number, so once
        every spot is gone this switches itself to a waiting list rather than
        dangling an offer that no longer exists.
      */}
      <section className="py-20" style={{ background: "linear-gradient(135deg, #0f1c35, #1b2b4d)" }}>
        <div className="max-w-4xl mx-auto px-6 text-center text-white">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-1.5 text-sm font-semibold text-orange-200">
            <Zap className="w-4 h-4" />
            {founding.full
              ? "All founding spots are taken"
              : `${founding.remaining} of ${founding.total} founding spots left`}
          </p>
          <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">
            {founding.full
              ? "The founding programme is full"
              : `The first ${founding.total} venues get Pro free for ${TERM_MONTHS} months`}
          </h2>
          <p className="mt-4 text-lg text-slate-300 leading-relaxed">
            {founding.full ? (
              <>
                Every spot has been granted. You can still join the waiting list
                &mdash; if one frees up, or we open a second round, you hear
                first.
              </>
            ) : (
              <>
                Rotahr is new and we would rather have {founding.total} venues
                using it properly than a pile of signups that never log in. So
                the first {founding.total} get the full Pro plan free for a
                year. In return: a 20 minute call once a month, and tell us what
                breaks.
              </>
            )}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/founding"
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
            >
              {founding.full ? "Join the waiting list" : "Apply for a founding spot"}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/founding"
              className="text-sm text-slate-300 underline hover:text-white"
            >
              What we ask in return, and what Rotahr still cannot do
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            No card, no contract, no auto-charge at the end. You keep every
            record you enter either way.
          </p>
        </div>
      </section>

      {/*
        Free venue listing.
        Placed directly after pricing on purpose: this is the moment a visitor
        has just decided the monthly cost is more than they want to commit to,
        and it converts that no into a free page plus an email address.
      */}
      <section id="free-listing" className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm">
            <span className="inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
              Free — no card, no subscription
            </span>
            <h2 className="text-3xl font-extrabold mb-4">
              Not ready for the software? Claim your venue page for free.
            </h2>
            <p className="text-slate-600 mb-6 max-w-2xl">
              Every venue gets a free public page on Rotahr — your opening hours, menu,
              location and a booking button, on a link you can put in your Instagram bio.
              It costs nothing, works whether or not you ever subscribe, and takes
              about two minutes to claim.
            </p>
            <ul className="grid gap-3 sm:grid-cols-3 mb-8 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                Your own page on rotahr.com
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                Takes bookings straight away
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                Upgrade later, or never
              </li>
            </ul>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/list"
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                List your venue — free
              </Link>
              <span className="text-sm text-slate-500">No card required, ever.</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold mb-4 text-center">Questions people actually ask</h2>
          <p className="text-slate-600 text-center mb-12">
            Straight answers, including the ones where the answer is no.
          </p>
          <div className="space-y-6">
            {landingFaq.map((item) => (
              <div key={item.q} className="bg-white rounded-2xl border border-slate-200 p-6">
                <h3 className="font-bold mb-2">{item.q}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
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
            Set your venue up in an evening. First month free, no card needed — or look
            around the live demo first and decide after.
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
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-10">
        {/* Internal links. Without these the comparison and location pages are
            orphaned — reachable only via the sitemap, which crawls far slower
            and passes no internal link equity. */}
        <div className="max-w-6xl mx-auto px-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10 text-sm">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Features</h3>
            <ul className="space-y-2 text-slate-500">
              {featurePages.map((f) => (
                <li key={f.slug}>
                  <Link href={`/features/${f.slug}`} className="hover:text-slate-900">
                    {f.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/features" className="hover:text-slate-900">
                  All features
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">Compare</h3>
            <ul className="space-y-2 text-slate-500">
              {competitorPages.slice(0, 5).map((c) => (
                <li key={c.slug}>
                  <Link href={`/compare/${c.slug}`} className="hover:text-slate-900">
                    Rotahr vs {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/compare" className="hover:text-slate-900">
                  All comparisons
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">By area</h3>
            <ul className="space-y-2 text-slate-500">
              {locations.map((l) => (
                <li key={l.slug}>
                  <Link href={`/rota-software/${l.slug}`} className="hover:text-slate-900">
                    Rota software {l.city}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 mb-3">More</h3>
            <ul className="space-y-2 text-slate-500">
              <li><Link href="/pricing" className="hover:text-slate-900">Pricing</Link></li>
              <li><Link href="/about" className="hover:text-slate-900">About</Link></li>
              <li><Link href="/blog" className="hover:text-slate-900">Blog</Link></li>
              {/* Sitewide link to the template library. Its 27 pages are the
                  top of the funnel — a visitor downloading a temperature log is
                  the exact person who later needs the HACCP module. */}
              <li><Link href="/templates" className="hover:text-slate-900">Free templates</Link></li>
              <li><Link href="/list" className="hover:text-slate-900">List your venue — free</Link></li>
              {/* Sitewide link to the directory, so the 81 venue pages it links
                  are two clicks from the landing page instead of unreachable. */}
              <li><Link href="/venues-directory" className="hover:text-slate-900">Venue directory</Link></li>
              <li><Link href="/partners" className="hover:text-slate-900">Partner programme</Link></li>
              <li><Link href="/try" className="hover:text-slate-900">Live demo</Link></li>
              {hasCapterraListing() && (
                <li>
                  {/* Outbound to the directory profile. rel="noopener" because
                      target="_blank" without it hands the opened tab a handle
                      on this window. Not nofollow — this is a link we want
                      associated with the brand. */}
                  <a
                    href={CAPTERRA_URL!}
                    target="_blank"
                    rel="noopener"
                    className="hover:text-slate-900"
                  >
                    Rotahr on Capterra
                  </a>
                </li>
              )}
              <li><Link href="/privacy" className="hover:text-slate-900">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-slate-900">Terms</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-8 text-sm text-slate-500 leading-relaxed">
          <p>
            Rotahr is a restaurant operations platform for hospitality — rota and scheduling software,
            HACCP software for food safety compliance, a restaurant CRM built from your own bookings,
            table reservations, stock, bookkeeping and in-house staff training in one app.
          </p>
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-8 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <Image src="/logo-light.png" alt="Rotahr" width={80} height={26} className="object-contain" />
          <span>© 2026 Rotahr. All rights reserved.</span>
          <span>EUR, USD, GBP, CAD &amp; AUD supported — VAT/tax included in all prices</span>
        </div>
      </footer>
    </div>
  )
}
