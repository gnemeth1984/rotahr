"use client";

import { useState } from "react";

export function RemoveForm({ token, name }: { token: string; name: string }) {
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setState("busy");
    setError(null);
    const res = await fetch("/api/listing/takedown", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setState("done");
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
        <p className="font-semibold mb-1">Done — the page is gone.</p>
        <p className="text-sm text-slate-300 leading-relaxed">
          {name} has been removed and won&apos;t be listed again. Sorry for the
          bother, and thanks for telling us rather than just ignoring it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="reason" className="block text-sm text-slate-300 mb-1.5">
          Anything you want to tell us? <span className="text-slate-500">(optional)</span>
        </label>
        <textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Not necessary — but it helps us not annoy the next place."
          className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#FF6B35]"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        onClick={remove}
        disabled={state === "busy"}
        className="w-full bg-white/10 border border-white/20 font-semibold px-6 py-3 rounded-xl hover:bg-white/15 transition-colors disabled:opacity-50"
      >
        {state === "busy" ? "Removing…" : "Remove this page"}
      </button>
      <p className="text-xs text-slate-500 text-center">
        This can&apos;t be undone, but you can always list again later at /list.
      </p>
    </div>
  );
}
