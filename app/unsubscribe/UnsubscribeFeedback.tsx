"use client";

import { useState } from "react";
import { UNSUB_COMMENT_MAX, UNSUB_REASONS } from "@/lib/email/unsubscribe-feedback";

/**
 * Optional "why are you leaving?" — rendered only after the opt-out is done.
 * One tap saves the reason; the comment box is extra and can be ignored.
 */
export function UnsubscribeFeedback({ email }: { email: string }) {
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "thanks" | "error">("idle");

  async function save(r: string, c: string) {
    setState("saving");
    try {
      const res = await fetch("/api/unsubscribe/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason: r, comment: c }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  if (state === "thanks") {
    return (
      <div className="mt-6 pt-5 border-t border-white/10" data-testid="unsub-feedback-thanks">
        <p className="text-sm text-white/70">Thanks — that genuinely helps.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-5 border-t border-white/10" data-testid="unsub-feedback">
      <p className="text-sm text-white/80 font-medium">
        Mind telling us why? <span className="text-white/40 font-normal">(optional)</span>
      </p>
      <p className="text-xs text-white/40 mt-1 mb-3">
        You&apos;re already unsubscribed — this just helps us send better emails.
      </p>
      <div className="flex flex-wrap gap-2">
        {UNSUB_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={state === "saving"}
            onClick={async () => {
              setReason(r.id);
              const ok = await save(r.id, comment);
              setState(ok ? "saved" : "error");
            }}
            className={`text-xs rounded-full border px-3 py-1.5 transition-colors ${
              reason === r.id
                ? "border-[#FF6B35] bg-[#FF6B35]/15 text-white"
                : "border-white/15 text-white/70 hover:border-white/35 hover:text-white"
            }`}
            data-testid={`unsub-reason-${r.id}`}
            aria-pressed={reason === r.id}
          >
            {r.label}
          </button>
        ))}
      </div>

      {reason && (
        <div className="mt-4">
          <label htmlFor="unsub-comment" className="text-xs text-white/50">
            Anything else you&apos;d like to tell us?
          </label>
          <textarea
            id="unsub-comment"
            value={comment}
            maxLength={UNSUB_COMMENT_MAX}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="What would have made these emails worth keeping?"
            className="mt-1 w-full rounded-lg border border-white/15 bg-[#0A1427] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#FF6B35] focus:outline-none"
            data-testid="unsub-comment"
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              disabled={state === "saving"}
              onClick={async () => {
                const ok = await save(reason, comment);
                setState(ok ? "thanks" : "error");
              }}
              className="text-sm font-semibold rounded-lg px-4 py-2 bg-white/10 hover:bg-white/15 text-white disabled:opacity-60"
              data-testid="unsub-feedback-send"
            >
              {state === "saving" ? "Sending…" : "Send"}
            </button>
            {state === "saved" && (
              <span className="text-xs text-emerald-300" data-testid="unsub-feedback-saved">
                Saved — thank you.
              </span>
            )}
          </div>
        </div>
      )}
      {state === "error" && (
        <p className="text-xs text-white/50 mt-2">Couldn&apos;t save that — no problem, you&apos;re still unsubscribed.</p>
      )}
    </div>
  );
}
