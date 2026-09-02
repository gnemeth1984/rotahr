"use client";

/**
 * The demo chooser.
 *
 * This is where "Explore the live demo" on the landing page now lands. It used to
 * redirect to /auth/signin, which put a cold visitor in front of a page whose
 * dominant element was a sign-in form — the demo panel was above it and open by
 * default, but the page still read "Sign in". Landing analytics said the same
 * thing from the other side: /auth/signin took 128 anonymous views in 30 days
 * against 2 for /auth/register. People wanted to look, not to sign up, and the
 * only door was a login box.
 *
 * So: no form, no password field, no "or continue with email". Pick a venue, get
 * dropped into it. The credentials are still real (seeded demo accounts) — we just
 * submit them for the visitor instead of asking them to.
 *
 * Light theme on purpose: the landing page is white, and handing off into the dark
 * navy app chrome made the demo feel like a different product.
 */

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Loader2,
  Check,
  Users,
  Building2,
} from "lucide-react";
import {
  DEMO_OWNER_ACCOUNTS,
  DEMO_STAFF_ACCOUNTS,
} from "@/lib/demo/accounts";

export default function TryClient() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function enter(email: string, password: string, next: string) {
    setPending(email);
    setError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        callbackUrl: next,
        redirect: false,
      });
      if (result?.error) {
        setError("That demo account didn't load. Try another, or refresh the page.");
        setPending(null);
        return;
      }
      // Always via the interstitial: it forwards immediately unless a scheduled
      // reset happens to be mid-flight, in which case it waits it out rather than
      // dropping the visitor into a half-rebuilt venue.
      window.location.href = `/demo/preparing?next=${encodeURIComponent(next)}`;
    } catch {
      setError("Something went wrong. Please try again.");
      setPending(null);
    }
  }

  const busy = pending !== null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header — deliberately minimal, one way back to the site */}
      <header className="border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-light.png"
              alt="Rotahr"
              width={130}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <Link
            href="/auth/signin"
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            I have an account
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Check className="w-3.5 h-3.5" />
            No signup · no card · nothing to install
          </span>
          <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
            Have a look around a real venue
          </h1>
          <p className="mt-4 text-slate-600 leading-relaxed">
            These aren&apos;t screenshots. They&apos;re live accounts with staff,
            rotas, bookings, stock and food safety records already in them — this
            week&apos;s dates, a normal trading week. Click one and you&apos;re in.
          </p>
        </div>

        {error && (
          <p className="mt-8 mx-auto max-w-md text-center text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* ── Owner view ─────────────────────────────────────────────────── */}
        <section className="mt-14">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="w-4 h-4" style={{ color: "#F97316" }} />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              You run the place
            </h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            See what a paying customer sees, on each plan.
          </p>

          <div className="grid sm:grid-cols-3 gap-4">
            {DEMO_OWNER_ACCOUNTS.map((a) => {
              const highlight = a.plan === "Pro";
              return (
                <button
                  key={a.email}
                  type="button"
                  disabled={busy}
                  onClick={() => enter(a.email, a.password, "/dashboard")}
                  className={`group relative text-left rounded-2xl border bg-white p-5 transition-all disabled:opacity-60 disabled:cursor-wait hover:-translate-y-0.5 ${
                    highlight
                      ? "border-transparent shadow-xl"
                      : "border-slate-200 hover:border-orange-300 hover:shadow-lg"
                  }`}
                  style={
                    highlight
                      ? { boxShadow: "0 16px 44px #F9731620, 0 0 0 2px #F97316" }
                      : {}
                  }
                >
                  {highlight && (
                    <span
                      className="absolute -top-3 left-5 text-[11px] font-bold text-white rounded-full px-3 py-0.5"
                      style={{
                        background: "linear-gradient(135deg, #F97316, #EC4899)",
                      }}
                    >
                      Best place to start
                    </span>
                  )}

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${a.badge}`}
                    >
                      {a.plan}
                    </span>
                    <span className="text-xs text-slate-500">{a.detail}</span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-slate-900">
                    {a.business}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {a.blurb}
                  </p>

                  <span
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: "#C2410C" }}
                  >
                    {pending === a.email ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Opening…
                      </>
                    ) : (
                      <>
                        Open this venue
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Staff view ─────────────────────────────────────────────────── */}
        <section className="mt-16">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Users className="w-4 h-4" style={{ color: "#F97316" }} />
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
              You&apos;re on the team
            </h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            The Anchor &amp; Tap — what your staff get on their phone. Same venue,
            different role.
          </p>

          <div className="flex flex-wrap gap-2.5">
            {DEMO_STAFF_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                disabled={busy}
                onClick={() => enter(a.email, a.password, "/rota")}
                className="group inline-flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white pl-3 pr-3.5 py-2.5 transition-all hover:border-orange-300 hover:shadow-md disabled:opacity-60 disabled:cursor-wait"
              >
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${a.badge}`}
                >
                  {a.role}
                </span>
                <span className="text-sm text-slate-700">{a.name}</span>
                {pending === a.email ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                ) : (
                  <ArrowRight
                    className="w-3.5 h-3.5 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all"
                  />
                )}
              </button>
            ))}
          </div>
        </section>

        <p className="mt-16 text-center text-xs text-slate-400">
          Demo data is rebuilt a few times a day, so anything you change is
          temporary — poke at whatever you like.{" "}
          <Link href="/pricing" className="underline hover:text-slate-600">
            See pricing
          </Link>
        </p>
      </main>
    </div>
  );
}
