"use client";

/**
 * Founding member application form.
 *
 * Six fields, only three required. Every extra field on a form like this costs
 * completions, and venue name, a human name and an email are all we actually
 * need to have the first conversation. The rest makes the first call better if
 * they choose to fill it in.
 */

import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

const VENUE_TYPES = [
  "Restaurant",
  "Bar or pub",
  "Cafe",
  "Hotel",
  "Gastropub",
  "Takeaway or deli",
  "Multi-site group",
  "Other",
];

const inputClass =
  "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 " +
  "placeholder:text-slate-400 focus:border-orange-400 focus:outline-none " +
  "focus:ring-2 focus:ring-orange-100 transition-colors";

const labelClass = "block text-sm font-semibold text-slate-700 mb-1.5";

export default function FoundingForm() {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      venueName: form.get("venueName"),
      contactName: form.get("contactName"),
      email: form.get("email"),
      phone: form.get("phone"),
      venueType: form.get("venueType"),
      staffCount: form.get("staffCount"),
      currentTool: form.get("currentTool"),
      notes: form.get("notes"),
    };

    try {
      const res = await fetch("/api/founding/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong. Try again in a moment.");
        setSending(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-6 w-6 text-emerald-700" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">That&apos;s in.</h3>
        <p className="mt-2 text-sm text-slate-600">
          Gabor reads these himself and replies from sales@rotahr.com, usually within a day.
          If the venue looks like a fit he&apos;ll send you a login and book the first call.
          No card, nothing to cancel.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="venueName">
            Venue name <span className="text-orange-500">*</span>
          </label>
          <input
            id="venueName"
            name="venueName"
            required
            maxLength={200}
            className={inputClass}
            placeholder="The Anchor &amp; Tap"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactName">
            Your name <span className="text-orange-500">*</span>
          </label>
          <input
            id="contactName"
            name="contactName"
            required
            maxLength={150}
            className={inputClass}
            placeholder="Sarah Connolly"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="email">
            Email <span className="text-orange-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            maxLength={200}
            className={inputClass}
            placeholder="you@yourvenue.com"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">
            Phone <span className="font-normal text-slate-400">optional</span>
          </label>
          <input id="phone" name="phone" maxLength={60} className={inputClass} placeholder="087 123 4567" />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="venueType">
            Type of venue <span className="font-normal text-slate-400">optional</span>
          </label>
          <select id="venueType" name="venueType" className={inputClass} defaultValue="">
            <option value="">Choose one</option>
            {VENUE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="staffCount">
            How many staff <span className="font-normal text-slate-400">optional</span>
          </label>
          <input
            id="staffCount"
            name="staffCount"
            type="number"
            min={0}
            max={10000}
            className={inputClass}
            placeholder="14"
          />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="currentTool">
          What do you use for rotas now?{" "}
          <span className="font-normal text-slate-400">optional</span>
        </label>
        <input
          id="currentTool"
          name="currentTool"
          maxLength={200}
          className={inputClass}
          placeholder="WhatsApp and a printed sheet"
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="notes">
          What is the most annoying part of running your rota?{" "}
          <span className="font-normal text-slate-400">optional</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={2000}
          className={inputClass}
          placeholder="Tell us the thing that wastes your time every week. This is the bit we actually want."
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-60 sm:w-auto"
        style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
      >
        {sending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending
          </>
        ) : (
          <>
            Apply for a founding spot <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <p className="text-xs text-slate-500">
        We use your details to reply about the founding programme and nothing else. No card, no
        automatic marketing list, and you can ask us to delete the application at any time.
      </p>
    </form>
  );
}
