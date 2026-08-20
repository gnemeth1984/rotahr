"use client";

import { useState } from "react";

/**
 * Public template request form. Deliberately three fields — the download itself
 * is ungated, so this is the only place we ask for anything, and a long form
 * here would just mean no requests.
 */
export default function TemplateRequestForm() {
  const [request, setRequest] = useState("");
  const [email, setEmail] = useState("");
  const [venue, setVenue] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (request.trim().length < 3) {
      setError("Tell us which template you need.");
      setState("error");
      return;
    }
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/templates/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, email, venue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Could not send that. Try again in a moment.");
        setState("error");
        return;
      }
      setState("done");
      setRequest("");
      setEmail("");
      setVenue("");
    } catch {
      setError("Could not send that. Check your connection and try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-[#FF6B35]/40 bg-[#FF6B35]/10 p-5">
        <p className="font-semibold mb-1">Got it — thanks.</p>
        <p className="text-sm text-slate-300">
          If you left an email we&apos;ll tell you the moment that template is
          live. Nothing else will land in your inbox.
        </p>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="mt-3 text-sm text-[#FF6B35] hover:underline"
        >
          Request another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      <div>
        <label
          htmlFor="tpl-request"
          className="block text-sm font-medium mb-1.5"
        >
          Which template do you need?
        </label>
        <textarea
          id="tpl-request"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          rows={3}
          required
          maxLength={1000}
          placeholder="e.g. an allergen matrix for our menu, or a weekly gas safety check sheet"
          className="w-full rounded-xl border border-white/15 bg-[#0f1c35] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#FF6B35] focus:outline-none"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="tpl-email" className="block text-sm font-medium mb-1.5">
            Email <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="tpl-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            placeholder="you@venue.com"
            className="w-full rounded-xl border border-white/15 bg-[#0f1c35] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#FF6B35] focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="tpl-venue" className="block text-sm font-medium mb-1.5">
            Venue type <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="tpl-venue"
            type="text"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            maxLength={200}
            placeholder="Restaurant, bar, hotel, café…"
            className="w-full rounded-xl border border-white/15 bg-[#0f1c35] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#FF6B35] focus:outline-none"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-5 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Request this template"}
      </button>
      <p className="text-xs text-slate-500">
        We only use an email address you give here to tell you that template is
        ready. See our{" "}
        <a href="/privacy" className="underline hover:text-slate-300">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
