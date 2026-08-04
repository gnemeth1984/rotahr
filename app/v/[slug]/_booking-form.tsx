"use client";

import { useState } from "react";

const CATEGORY_TIMES = ["12:00", "12:30", "13:00", "13:30", "14:00", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

export function BookingForm({ slug, accent }: { slug: string; accent: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Must be the guest's LOCAL date. toISOString() converts to UTC first, so
  // between midnight and 01:00 Irish summer time (UTC+1) it returned
  // yesterday — the picker then pre-filled and floored to the wrong day, and
  // "today" was unselectable. Same class of bug anywhere east of UTC.
  const today = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          partySize: Number(fd.get("partySize")),
          date: fd.get("date"),
          time: fd.get("time"),
          notes: fd.get("notes"),
          marketingConsent: fd.get("marketingConsent") === "on",
          // Honeypot — bots fill hidden fields, humans never see this.
          // Deliberately meaningless name: anything resembling a real field
          // ("company", "organization", "address") gets filled by browser
          // autofill, which silently killed genuine bookings.
          hp_ref: fd.get("hp_ref"),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong. Please call us instead.");
        setState("error");
        return;
      }
      setState("done");
    } catch {
      setError("Couldn't reach the server. Please call us instead.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="text-lg font-semibold text-emerald-900">Request received</p>
        <p className="mt-2 text-sm text-emerald-800">
          We&apos;ll be in touch shortly to confirm your table. This is a request, not a
          confirmed booking yet.
        </p>
      </div>
    );
  }

  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Honeypot. No label, no autofill-recognisable name, and marked
          off-limits to autofill so real guests can never trip it. */}
      <div className="absolute left-[-9999px] top-[-9999px]" aria-hidden="true">
        <input
          id="hp_ref"
          name="hp_ref"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-form-type="other"
          aria-hidden="true"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">Name *</label>
          <input id="name" name="name" required maxLength={100} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="phone">Phone *</label>
          <input id="phone" name="phone" required maxLength={40} type="tel" className={field} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" maxLength={120} className={field} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={label} htmlFor="date">Date *</label>
          <input id="date" name="date" type="date" required min={today} defaultValue={today} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="time">Time *</label>
          <select id="time" name="time" required defaultValue="19:00" className={field}>
            {CATEGORY_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="partySize">Guests *</label>
          <select id="partySize" name="partySize" required defaultValue="2" className={field}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={label} htmlFor="notes">Anything we should know?</label>
        <textarea
          id="notes" name="notes" rows={3} maxLength={500} className={field}
          placeholder="Allergies, high chair, celebrating something…"
        />
      </div>

      <label className="flex items-start gap-2.5 text-sm text-slate-600">
        <input type="checkbox" name="marketingConsent" className="mt-0.5 h-4 w-4 rounded border-slate-300" />
        <span>Email me occasional news and offers. You can unsubscribe any time.</span>
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={state === "sending"}
        style={{ backgroundColor: accent }}
        className="w-full rounded-lg px-5 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Request a table"}
      </button>
      <p className="text-center text-xs text-slate-500">
        We&apos;ll confirm by phone or email. Your details are only used to manage this booking.
      </p>
    </form>
  );
}
