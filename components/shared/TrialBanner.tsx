"use client";

/**
 * Trial countdown and read-only notice.
 *
 * Two jobs, and the second one matters more than the first:
 *
 *  1. Warn before the trial ends, in the last week only. Nagging from day one
 *     is what makes people leave a trial early.
 *  2. Once read-only, explain the state honestly and immediately. The worst
 *     version of a paywall is a save button that silently stops working, so
 *     this banner says plainly what still works — reading and exporting
 *     everything, and clocking out — and what does not.
 *
 * Session claims can lag a payment by one session poll, so the read-only
 * banner carries a "I've just paid" refresh that forces the JWT to re-read the
 * business. Without it a paying customer could sit behind a stale gate.
 */

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Clock, X, RefreshCw } from "lucide-react";
import { computeAccess } from "@/lib/billing/access";

export function TrialBanner() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const user = session?.user as
    | {
        lsStatus?: string | null;
        trialEndsAt?: string | null;
        foundingMember?: boolean;
        isPlatformAdmin?: boolean;
        businessId?: string | null;
      }
    | undefined;

  // Platform admin and business-less accounts are never gated.
  if (!user || user.isPlatformAdmin || !user.businessId) return null;

  // Don't stack on top of the billing page — they're already there.
  if (pathname?.startsWith("/settings/billing")) return null;

  const state = computeAccess({
    lsStatus: user.lsStatus,
    trialEndsAt: user.trialEndsAt,
    foundingMember: user.foundingMember,
  });

  if (!state.warn) return null;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await update();
    } finally {
      setRefreshing(false);
    }
  }

  // ---- Founding rota tier -------------------------------------------------
  // Their free months are over, but the rota, clock in/out and the staff app
  // stay free for good. Say exactly that, and say what needs a plan, because
  // the alternative is them discovering it at a save button.
  if (state.mode === "rota") {
    return (
      <div className="bg-[#0f1c35] border-b border-[#ff6b35]/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Lock className="h-5 w-5 text-[#ff6b35] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-white font-semibold">
                Your founding free months have ended &mdash; you keep the rota,
                free
              </p>
              <p className="text-slate-300 mt-0.5">
                Building and publishing rotas, staff clock in and out and the
                staff app stay free for up to 30 staff, as promised. Timesheet
                edits, messaging, time off, payroll summaries, HACCP,
                reservations and bookkeeping are now read-only &mdash; nothing
                has been deleted, and all of it stays readable and exportable.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
            <Link
              href="/settings/billing"
              className="rounded-lg bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              Unlock everything
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Already paid? Refresh your access."
              className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-300 hover:text-white hover:border-white/40 transition disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Read-only ---------------------------------------------------------
  if (state.mode === "readonly") {
    const lapsed = state.reason === "subscription_lapsed";
    return (
      <div className="bg-[#0f1c35] border-b border-[#ff6b35]/40 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Lock className="h-5 w-5 text-[#ff6b35] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-white font-semibold">
                {lapsed
                  ? "Your subscription has lapsed — Rotahr is read-only"
                  : "Your free trial has ended — Rotahr is read-only"}
              </p>
              <p className="text-slate-300 mt-0.5">
                Nothing has been deleted. Every rota, timesheet, HACCP record,
                booking and invoice stays readable and exportable, and anyone
                on shift can still clock out. Choose a plan to start adding new
                records again.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pl-8 sm:pl-0">
            <Link
              href="/settings/billing"
              className="rounded-lg bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              {lapsed ? "Restart plan" : "Choose a plan"}
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Already paid? Refresh your access."
              className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-300 hover:text-white hover:border-white/40 transition disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Countdown, final week only ----------------------------------------
  if (dismissed) return null;

  const d = state.daysLeft ?? 0;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center gap-3 text-sm">
        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
        <p className="text-amber-900 flex-1">
          <span className="font-semibold">
            {user.foundingMember
              ? d === 1
                ? "Last day of your founding free months"
                : `${d} days left in your founding free months`
              : d === 1
                ? "Last day of your free trial"
                : `${d} days left in your free trial`}
          </span>
          <span className="hidden sm:inline">
            {user.foundingMember ? (
              <>
                {" "}
                — after that you keep the rota, clock in/out and the staff app
                free for good. The rest goes read-only until you choose a plan.
              </>
            ) : (
              <>
                {" "}
                — after that Rotahr goes read-only. Your records stay, but you
                won&apos;t be able to add new ones.
              </>
            )}
          </span>
        </p>
        <Link
          href="/settings/billing"
          className="font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700 shrink-0"
        >
          Choose a plan
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 hover:text-amber-800 shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
