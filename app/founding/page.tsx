import Link from "next/link";
import { Check, Clock, MessageSquare, ArrowRight } from "lucide-react";
import FoundingForm from "@/components/marketing/FoundingForm";
import {
  jsonLdProps,
  breadcrumbSchema,
  faqSchema,
} from "@/lib/seo/structured-data";
import {
  FOUNDING_ASKS,
  FOUNDING_CAVEATS,
  FOUNDING_GETS,
  FOUNDING_KEEPS,
  FOUNDING_LOCKED,
  TERM_MONTHS,
  TOTAL_SPOTS,
  foundingStatus,
} from "@/lib/marketing/founding";

/**
 * /founding — the founding member programme.
 *
 * WHY THIS PAGE EXISTS
 *
 * Rotahr has no customers yet, so it has no logos, no reviews and no case
 * studies. That is the actual obstacle, not the price. This page trades three
 * months of Pro, plus the rota free forever after that, for the thing the
 * product needs more than revenue right now: real venues using it daily, and a
 * monthly conversation about where it breaks.
 *
 * TONE RULES FOR THIS PAGE
 *
 * It says outright that we are new and have no customers. That is not modesty,
 * it is the only honest reason a free offer makes sense, and an operator can
 * smell a fake scarcity play immediately. The spot counter is read from the
 * database — see lib/marketing/founding.ts. The limitations section is not
 * optional: someone finding out about the missing importer on day three is a
 * refund conversation, and finding out here is a qualified lead.
 */

/**
 * The spot counter is cached for five minutes in lib/marketing/founding.ts and
 * a grant calls revalidateTag("founding"), so the number is normally correct
 * the moment it changes. This ceiling exists so a missed tag revalidation
 * self-heals instead of freezing the count at whatever it was on deploy day.
 */
export const revalidate = 300;

export const metadata = {
  title: "Founding Members — 3 Months Free, Then Keep the Rota Free",
  description:
    "The first 20 venues get Rotahr Pro free for 3 months, then keep rotas, clock in/out and the staff app free forever. In exchange, a monthly call about what needs fixing. No card.",
  alternates: { canonical: "/founding" },
};

const foundingFaq = [
  {
    q: "What is the Rotahr founding member programme?",
    a: `The first ${TOTAL_SPOTS} venues to join get Rotahr Pro free for ${TERM_MONTHS} months. When those months end you keep the rota free forever, whether you pay or not. In exchange they agree to a 20 minute call once a month about what is working and what is not, and a testimonial at the end if they genuinely like it by then. There is no card and nothing to cancel.`,
  },
  {
    q: "Why is it free?",
    a: "Rotahr is new and does not have customers yet. What it needs first is venues using it every day and telling us where it gets in the way, which is worth more at this stage than the monthly fee. The honest trade is free months for your time and your feedback.",
  },
  {
    q: `What happens after the ${TERM_MONTHS} months?`,
    a: `You decide whether to pay, and if you do nothing you are not thrown out. Building and publishing rotas, staff clocking in and out, and the staff app on iOS and Android stay free forever for up to 30 staff. Editing timesheets by hand, payroll summaries, team messaging, time off, HACCP, reservations and bookkeeping need a plan from then on — but you keep every record you entered and can read and export all of it, forever. We never delete or lock your records to make you subscribe, because HACCP logs and timesheets are evidence you may legally need.`,
  },
  {
    q: "Is there a catch?",
    a: "No card and no minimum term, but be clear about what you are joining: Rotahr is young. There is no importer yet, so your staff and rota get typed in. The app is English only. Break-time rules are modelled on Irish law. If you would rather wait for a finished product, waiting is a reasonable choice.",
  },
  {
    q: "Do I have to give a testimonial?",
    a: "Only if you actually like it. A review promised before someone has used the product is worthless to the next person reading it, so it is not a condition of the free months.",
  },
];

export default async function FoundingPage() {
  const { taken, remaining, full } = await foundingStatus();

  return (
    <main className="bg-white text-slate-900">
      <script
        {...jsonLdProps([
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: "Founding Members", path: "/founding" },
          ]),
          faqSchema(foundingFaq),
        ])}
      />

      {/* Header */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            Rotahr
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/pricing" className="transition-colors hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/about" className="transition-colors hover:text-slate-900">
              About
            </Link>
            <Link href="/auth/signin" className="transition-colors hover:text-slate-900">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-16 text-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white"
          style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
        >
          Founding members
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl">
          {TERM_MONTHS} months free. Then keep the rota free, forever.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          The first {TOTAL_SPOTS} venues get everything on Pro free for {TERM_MONTHS} months. After
          that, rotas, clock in/out and the staff app stay free whether you pay or not. What we want
          back is not your money, it&apos;s 20 minutes on a call once a month telling us
          what&apos;s getting in your way.
        </p>

        <div className="mt-8 inline-flex flex-col items-center gap-3">
          {full ? (
            <span className="rounded-full bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700">
              All {TOTAL_SPOTS} founding spots are taken
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-5 py-2 text-sm font-semibold text-emerald-700">
              {remaining} of {TOTAL_SPOTS} spots left
              {taken > 0 ? ` · ${taken} venue${taken === 1 ? "" : "s"} joined` : ""}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-sm text-slate-500">
            <Check className="h-4 w-4" /> No card needed
            <span className="text-slate-300">·</span> Nothing to cancel
          </span>
        </div>
      </section>

      {/* The honest reason */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8">
          <h2 className="text-xl font-bold">Why we&apos;re giving this away</h2>
          <p className="mt-4 text-slate-600">
            Because Rotahr is new and doesn&apos;t have customers yet. That&apos;s the plain
            version. It was built by a chef who spent years doing rotas on paper and payroll on a
            Sunday night, and it works &mdash; but a product that has never been run through a
            busy Saturday service by someone other than its author has blind spots, and I&apos;d
            rather find them with you than sell around them.
          </p>
          <p className="mt-4 text-slate-600">
            So the trade is straightforward. You get {TERM_MONTHS} months of the complete platform
            for nothing, and the rota for nothing after that, for good. I get to watch real venues
            use it and hear what&apos;s annoying before I have
            hundreds of customers and it&apos;s expensive to change. That&apos;s worth more to me
            right now than {TOTAL_SPOTS} monthly subscriptions.
          </p>
          <p className="mt-4 text-sm font-medium text-slate-500">
            &mdash; Gabor Nemeth, founder.{" "}
            <Link href="/about" className="text-orange-700 underline">
              More about why I built this
            </Link>
          </p>
        </div>
      </section>

      {/* Get / give */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-8">
            <div className="mb-5 flex items-center gap-2">
              <Check className="h-5 w-5" style={{ color: "#F97316" }} />
              <h2 className="text-lg font-bold">What you get</h2>
            </div>
            <ul className="space-y-3">
              {FOUNDING_GETS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#F97316" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 p-8">
            <div className="mb-5 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" style={{ color: "#EC4899" }} />
              <h2 className="text-lg font-bold">What we ask</h2>
            </div>
            <ul className="space-y-3">
              {FOUNDING_ASKS.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#EC4899" }} />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
              That&apos;s the whole deal. No card, no minimum term, no clause that turns into a
              subscription while you aren&apos;t looking.
            </p>
          </div>
        </div>
      </section>

      {/* After the term — the part every free offer hides. Stated plainly. */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="rounded-2xl border-2 border-slate-900 p-8">
          <h2 className="text-2xl font-extrabold">
            And after the {TERM_MONTHS} months?
          </h2>
          <p className="mt-3 text-slate-600">
            You are not thrown out and nothing is deleted. The rota is yours to keep, free, whether
            you ever pay us or not &mdash; because a venue that stops being able to publish next
            week&apos;s rota has to go back to paper, and we are not doing that to you to win an
            argument about &euro;89.
          </p>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-emerald-700">
                Free forever
              </h3>
              <ul className="mt-4 space-y-3">
                {FOUNDING_KEEPS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                Needs a plan
              </h3>
              <ul className="mt-4 space-y-3">
                {FOUNDING_LOCKED.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            No card at any point, so nothing starts charging you when the {TERM_MONTHS} months end.
            If you want the rest, you choose a plan yourself.
          </p>
        </div>
      </section>

      {/* Limitations — before the form on purpose */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <div className="mb-6 flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            <h2 className="text-2xl font-extrabold">What&apos;s not finished yet</h2>
          </div>
          <p className="mb-6 text-slate-600">
            You should know this before you sign up rather than on day three. None of it is a
            roadmap promise, it&apos;s just where the product actually is today.
          </p>
          <ul className="space-y-4">
            {FOUNDING_CAVEATS.map((item) => (
              <li
                key={item}
                className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-slate-500">
            If any of those are dealbreakers, say so on the call and we&apos;ll tell you honestly
            whether it&apos;s coming or not.
          </p>
        </div>
      </section>

      {/* Form */}
      <section id="apply" className="py-20">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-2xl font-extrabold">
            {full ? "Join the waiting list" : "Apply for a founding spot"}
          </h2>
          <p className="mb-8 mt-3 text-slate-600">
            {full
              ? `All ${TOTAL_SPOTS} spots are taken. Leave your details and you'll be first in line if one frees up or we open a second round.`
              : "Takes a minute. Three fields are required, the rest just makes the first call more useful."}
          </p>
          <FoundingForm />
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-10 text-2xl font-extrabold">Questions</h2>
          <div className="space-y-6">
            {foundingFaq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="font-bold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-slate-600">
            Not interested in the programme?{" "}
            <Link href="/pricing" className="text-orange-700 underline">
              See normal pricing
            </Link>{" "}
            &mdash; the first month is free on Starter and Pro either way.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row">
          <span>Rotahr &mdash; built by a chef, for hospitality.</span>
          <nav className="flex items-center gap-5">
            <Link href="/" className="hover:text-slate-900">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
            <Link href="/founding#apply" className="inline-flex items-center gap-1 font-semibold text-orange-700">
              Apply <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
