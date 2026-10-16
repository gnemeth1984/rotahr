"use client";

/**
 * 3-month-free trial banner for public acquisition pages.
 *
 * Phase 1 growth scope. Deliberately separate from
 * `components/shared/TrialBanner.tsx`, which is the authenticated-app trial
 * COUNTDOWN banner shown inside the dashboard once someone has already signed
 * up. This one is the opposite moment: it is shown to anonymous visitors on
 * marketing/acquisition pages to state the offer before signup, and is never
 * rendered inside `/(app)` — see each page's own import rather than a global
 * layout, so there is no risk of this showing up next to the real countdown.
 *
 * Dismissible, storage-safe (fails silently with no `window`/localStorage,
 * e.g. during static generation) and accessible: a labelled region with a
 * reachable, keyboard-operable close button.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "rotahr-trial-banner-dismissed";

export function AcquisitionBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      // Storage can throw in locked-down browsers/privacy modes — treat that
      // the same as "not dismissed yet" rather than crashing the page.
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to persist to; the banner still hides for this page view.
    }
  }

  return (
    <div
      role="region"
      aria-label="Trial offer"
      className="relative"
      style={{ background: "linear-gradient(135deg, #0f1c35, #1b2b4d)" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-center gap-3 text-center">
        <p className="text-sm text-white">
          <strong className="font-semibold">
            Every new Rotahr account gets 3 months free.
          </strong>{" "}
          <span className="text-slate-300">No credit card required.</span>{" "}
          <Link
            href="/auth/register"
            className="underline decoration-slate-500 underline-offset-4 hover:text-[#FF9A6B] whitespace-nowrap"
          >
            Start free trial →
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss trial offer banner"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
