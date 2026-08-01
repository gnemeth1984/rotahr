"use client";

import { useEffect, useState } from "react";
import { DAY_SHORT, validateSlug, type OpeningHoursEntry } from "@/lib/public-page/types";

interface Settings {
  name: string;
  publicPageEnabled: boolean;
  publicSlug: string | null;
  publicTagline: string | null;
  publicAbout: string | null;
  publicPhone: string | null;
  publicEmail: string | null;
  publicAddress: string | null;
  publicWebsite: string | null;
  publicInstagram: string | null;
  publicFacebook: string | null;
  publicBookingUrl: string | null;
  publicOpeningHours: OpeningHoursEntry[];
  publicShowMenu: boolean;
  publicShowSpecials: boolean;
  publicShowPrices: boolean;
  publicShowBooking: boolean;
  publicNoIndex: boolean;
  suggestedSlug: string;
  dishCount: number;
  specialCount: number;
}

const card = "rounded-xl border border-slate-200 bg-white p-6";
const label = "block text-sm font-medium text-slate-700 mb-1.5";
const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function Toggle({
  checked, onChange, title, description,
}: { checked: boolean; onChange: (v: boolean) => void; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 flex-shrink-0 rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

export default function PublicPageSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/business/public-page")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setS(d);
      })
      .catch((e) => setMsg({ type: "err", text: e.message }))
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev));
    setMsg(null);
  }

  function setHour(day: number, patch: Partial<OpeningHoursEntry>) {
    setS((prev) =>
      prev
        ? {
            ...prev,
            publicOpeningHours: prev.publicOpeningHours.map((h) =>
              h.day === day ? { ...h, ...patch } : h
            ),
          }
        : prev
    );
  }

  async function save(overrides: Partial<Settings> = {}) {
    if (!s) return;
    const payload = { ...s, ...overrides };

    if (payload.publicSlug) {
      const check = validateSlug(payload.publicSlug);
      if (!check.ok) {
        setMsg({ type: "err", text: check.error });
        return;
      }
    }

    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/business/public-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't save");
      setS((prev) => (prev ? { ...prev, ...json } : prev));
      setMsg({ type: "ok", text: "Saved" });
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Couldn't save" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!s) return <p className="text-sm text-red-600">{msg?.text ?? "Couldn't load settings."}</p>;

  const liveUrl = s.publicSlug ? `https://rotahr.com/v/${s.publicSlug}` : null;
  const isEmpty = s.dishCount === 0 && s.specialCount === 0;

  return (
    <div className="max-w-3xl space-y-6 pb-16">
      {/* Status */}
      <div className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Public page</h2>
            <p className="mt-1 text-sm text-slate-500">
              A free public page for {s.name}, built automatically from your menu, specials and
              opening hours. Nothing is visible until you publish it.
            </p>
          </div>
          <span
            className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
              s.publicPageEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
            }`}
          >
            {s.publicPageEnabled ? "Live" : "Not published"}
          </span>
        </div>

        {s.publicPageEnabled && liveUrl && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 p-3">
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 underline underline-offset-4"
            >
              {liveUrl}
            </a>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(liveUrl)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium hover:border-slate-400"
            >
              Copy link
            </button>
          </div>
        )}

        {isEmpty && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            You have no dishes or specials yet, so the page will look bare. Add some in Recipes or
            Menu Specials first.
          </p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-2">
          <Toggle
            checked={s.publicPageEnabled}
            onChange={(v) => {
              set("publicPageEnabled", v);
              save({ publicPageEnabled: v });
            }}
            title="Publish this page"
            description="Makes the page visible to anyone with the link."
          />
        </div>
      </div>

      {/* Address */}
      <div className={card}>
        <h3 className="font-semibold text-slate-900">Page address</h3>
        <div className="mt-4">
          <label className={label} htmlFor="slug">Web address</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">rotahr.com/v/</span>
            <input
              id="slug"
              className={input}
              value={s.publicSlug ?? ""}
              placeholder={s.suggestedSlug}
              onChange={(e) => set("publicSlug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
          </div>
          {!s.publicSlug && (
            <button
              type="button"
              onClick={() => set("publicSlug", s.suggestedSlug)}
              className="mt-2 text-xs font-medium text-blue-600 underline underline-offset-4"
            >
              Use “{s.suggestedSlug}”
            </button>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Lowercase letters, numbers and hyphens. Changing this breaks any links you&apos;ve
            already shared.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className={card}>
        <h3 className="font-semibold text-slate-900">About</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className={label} htmlFor="tagline">Tagline</label>
            <input
              id="tagline" className={input} maxLength={120}
              value={s.publicTagline ?? ""}
              onChange={(e) => set("publicTagline", e.target.value)}
              placeholder="Seasonal cooking in the heart of the city"
            />
          </div>
          <div>
            <label className={label} htmlFor="about">Description</label>
            <textarea
              id="about" className={input} rows={5} maxLength={2000}
              value={s.publicAbout ?? ""}
              onChange={(e) => set("publicAbout", e.target.value)}
              placeholder="Tell guests what makes the place special."
            />
            <p className="mt-1 text-xs text-slate-500">{(s.publicAbout ?? "").length}/2000</p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className={card}>
        <h3 className="font-semibold text-slate-900">Contact &amp; links</h3>
        <p className="mt-1 text-sm text-slate-500">
          Leave blank to use the details from your default venue.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {([
            ["publicPhone", "Phone", "+353 1 234 5678"],
            ["publicEmail", "Email", "hello@yourvenue.com"],
            ["publicWebsite", "Website", "yourvenue.com"],
            ["publicInstagram", "Instagram", "instagram.com/yourvenue"],
            ["publicFacebook", "Facebook", "facebook.com/yourvenue"],
            ["publicBookingUrl", "External booking link", "opentable.com/..."],
          ] as const).map(([key, lbl, ph]) => (
            <div key={key}>
              <label className={label} htmlFor={key}>{lbl}</label>
              <input
                id={key} className={input} placeholder={ph}
                value={(s[key] as string | null) ?? ""}
                onChange={(e) => set(key, e.target.value as never)}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className={label} htmlFor="publicAddress">Address</label>
            <textarea
              id="publicAddress" className={input} rows={2} maxLength={300}
              value={s.publicAddress ?? ""}
              onChange={(e) => set("publicAddress", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Hours */}
      <div className={card}>
        <h3 className="font-semibold text-slate-900">Opening hours</h3>
        <div className="mt-4 space-y-2">
          {s.publicOpeningHours.map((h) => (
            <div key={h.day} className="flex items-center gap-3">
              <span className="w-12 text-sm font-medium text-slate-700">{DAY_SHORT[h.day]}</span>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={!h.closed}
                  onChange={(e) => setHour(h.day, { closed: !e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Open
              </label>
              <input
                type="time" value={h.open} disabled={h.closed}
                onChange={(e) => setHour(h.day, { open: e.target.value })}
                className={`${input} w-32 disabled:bg-slate-100 disabled:text-slate-400`}
              />
              <span className="text-slate-400">–</span>
              <input
                type="time" value={h.close} disabled={h.closed}
                onChange={(e) => setHour(h.day, { close: e.target.value })}
                className={`${input} w-32 disabled:bg-slate-100 disabled:text-slate-400`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className={card}>
        <h3 className="font-semibold text-slate-900">What to show</h3>
        <div className="mt-2 divide-y divide-slate-100">
          <Toggle
            checked={s.publicShowMenu} onChange={(v) => set("publicShowMenu", v)}
            title="Menu" description="Your active dishes from Recipes. Cost prices are never shown."
          />
          <Toggle
            checked={s.publicShowPrices} onChange={(v) => set("publicShowPrices", v)}
            title="Menu prices" description="Show the sell price next to each dish."
          />
          <Toggle
            checked={s.publicShowSpecials} onChange={(v) => set("publicShowSpecials", v)}
            title="Specials &amp; news"
            description="Current specials and announcements. Internal notes and 86'd items are never shown."
          />
          <Toggle
            checked={s.publicShowBooking} onChange={(v) => set("publicShowBooking", v)}
            title="Booking form"
            description="Guests can request a table. Requests arrive as pending in Bookings for you to confirm."
          />
          <Toggle
            checked={s.publicNoIndex} onChange={(v) => set("publicNoIndex", v)}
            title="Hide from search engines"
            description="Page stays reachable by link but won't appear in Google."
          />
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <button
          onClick={() => save()}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {liveUrl && (
          <a
            href={liveUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:border-slate-400"
          >
            Preview
          </a>
        )}
        {msg && (
          <span className={`text-sm ${msg.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
