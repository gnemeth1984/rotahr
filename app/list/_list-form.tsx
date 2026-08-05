"use client";

import { useState } from "react";

const VENUE_TYPES = [
  "Restaurant",
  "Bar / Pub",
  "Cafe",
  "Hotel",
  "Gastropub",
  "Takeaway",
  "Bakery",
  "Other",
];

export function ListForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [town, setTown] = useState("");
  const [venueType, setVenueType] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [nickname, setNickname] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/list-venue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, town, venueType, phone, website, nickname }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Something went wrong.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="text-4xl mb-4">📬</div>
        <h2 className="text-xl font-bold mb-3">Check your inbox</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-2">
          We&apos;ve sent a link to <span className="text-white">{email}</span>. Open it and
          your page goes live — then you can add a cover photo and edit your details.
        </p>
        <p className="text-slate-500 text-xs">
          Nothing appears publicly until you open that link.
        </p>
      </div>
    );
  }

  const label = "block text-sm font-medium text-slate-200 mb-1.5";
  const input =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-slate-500 " +
    "focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35] transition-colors";

  return (
    <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 space-y-5">
      <div>
        <label className={label} htmlFor="name">
          Venue name <span className="text-[#ff6b35]">*</span>
        </label>
        <input
          id="name"
          className={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Anchor & Tap"
          required
          maxLength={120}
        />
      </div>

      <div>
        <label className={label} htmlFor="email">
          Your email <span className="text-[#ff6b35]">*</span>
        </label>
        <input
          id="email"
          type="email"
          className={input}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@yourvenue.ie"
          required
          maxLength={200}
        />
        <p className="text-xs text-slate-500 mt-1.5">
          We send the link here. It&apos;s how we know the page is yours.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className={label} htmlFor="town">
            Town / address
          </label>
          <input
            id="town"
            className={input}
            value={town}
            onChange={(e) => setTown(e.target.value)}
            placeholder="Castleisland, Co. Kerry"
            maxLength={300}
          />
        </div>
        <div>
          <label className={label} htmlFor="venueType">
            Type of venue
          </label>
          <select
            id="venueType"
            className={input}
            value={venueType}
            onChange={(e) => setVenueType(e.target.value)}
          >
            <option value="">Choose…</option>
            {VENUE_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0f1c35]">
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label className={label} htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            className={input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="066 123 4567"
            maxLength={40}
          />
        </div>
        <div>
          <label className={label} htmlFor="website">
            Website
          </label>
          <input
            id="website"
            className={input}
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="yourvenue.ie"
            maxLength={300}
          />
        </div>
      </div>

      {/* Honeypot: hidden from people, tempting to bots. Never blocks a submission. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="nickname">Nickname</label>
        <input
          id="nickname"
          tabIndex={-1}
          autoComplete="off"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
      </div>

      {error && (
        <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-6 py-3.5 font-semibold text-white
                   hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {busy ? "Sending…" : "List my venue — free"}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Free listing. No card, no commission, no per-cover fee.
      </p>
    </form>
  );
}
