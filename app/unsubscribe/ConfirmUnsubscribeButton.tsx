"use client";

import { useState } from "react";
import { ResubscribeButton } from "./ResubscribeButton";

/**
 * The opt-out is written by this button, not by loading the page.
 *
 * It used to be written on GET, on the reasoning that a one-click opt-out is
 * the kind one actually completes. Measured 17 Aug 2026: of 123 recorded
 * opt-outs, 80 were addresses that were never on our list and 37 of the
 * remaining 43 landed within 60 seconds of the send — corporate mail security
 * gateways fetching every link in the message, and fetching a second, scrambled
 * copy of it to test whether the endpoint validates its input. One opt-out in
 * that whole set looked like a person. So the link now needs a real click,
 * which no scanner performs, and the RFC 8058 POST header still gives Gmail and
 * Outlook their genuine one-click path.
 */
export function ConfirmUnsubscribeButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  if (state === "done") {
    return (
      <div>
        <p className="text-sm text-white/70 leading-relaxed">
          Done — no more marketing emails to{" "}
          <span className="text-white/90 font-medium break-all">{email}</span>. It takes effect
          immediately.
        </p>
        <p className="text-sm text-white/60 leading-relaxed mt-3">
          If you have a Rotahr account, this doesn&apos;t touch the emails your account needs — rota
          changes, shift alerts, receipts. Only the marketing.
        </p>
        <div className="mt-6 pt-5 border-t border-white/10">
          <p className="text-xs text-white/40 mb-3">Changed your mind?</p>
          <ResubscribeButton email={email} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={async () => {
          setState("loading");
          try {
            const res = await fetch(`/api/unsubscribe?email=${encodeURIComponent(email)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            setState(res.ok ? "done" : "error");
          } catch {
            setState("error");
          }
        }}
        disabled={state === "loading"}
        className="w-full text-sm font-semibold rounded-lg px-4 py-3 bg-gradient-to-r from-[#FF6B35] to-[#E8365D] text-white disabled:opacity-60"
      >
        {state === "loading" ? "Unsubscribing…" : "Yes — unsubscribe me"}
      </button>
      {state === "error" && (
        <p className="text-xs text-white/50 mt-2">
          That didn&apos;t work. Email sales@rotahr.com and we&apos;ll take you off by hand.
        </p>
      )}
    </div>
  );
}
