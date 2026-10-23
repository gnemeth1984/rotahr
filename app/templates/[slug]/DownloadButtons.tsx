"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONSENT_DEFAULT_CHECKED,
  CONSENT_TEXT,
  LEAD_STORAGE_KEY,
  VENUE_TYPES,
  guessVenueType,
} from "@/lib/templates/lead-consent";

/**
 * Download buttons with an email step.
 *
 * The first download asks for an email address (plus the follow-up checkbox),
 * then the file downloads on the spot — the email copy is a bonus, never the
 * only way to get the file. Once someone has given an address it's remembered
 * in localStorage, so every later download on any template is one click.
 *
 * The links are still real <a href> files, so crawlers index the PDFs and the
 * page works with JS off; the email step is a click handler on top.
 */
type Format = "pdf" | "xlsx" | "csv";
const LABEL: Record<Format, string> = { pdf: "PDF", xlsx: "Excel", csv: "CSV" };

interface Stored {
  email: string;
  consent: boolean;
  venueType?: string;
}

function readStored(): Stored | null {
  try {
    const raw = localStorage.getItem(LEAD_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return typeof v?.email === "string" ? v : null;
  } catch {
    return null;
  }
}

function startDownload(href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export default function DownloadButtons({
  slug,
  name,
  category,
}: {
  slug: string;
  name: string;
  category: string;
}) {
  const [pending, setPending] = useState<Format | null>(null);
  const [email, setEmail] = useState("");
  const [venueType, setVenueType] = useState<string>(guessVenueType(category));
  const [consent, setConsent] = useState(CONSENT_DEFAULT_CHECKED);
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ format: Format; emailed: boolean; email: string } | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const href = (f: Format) => `/templates/${slug}.${f}`;

  useEffect(() => {
    if (pending) emailRef.current?.focus();
  }, [pending]);

  function recordKnown(f: Format, stored: Stored) {
    try {
      fetch("/api/templates/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, format: f, email: stored.email, consent: stored.consent, venueType: stored.venueType }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // never block the download
    }
  }

  // The library index and blog posts link here as /templates/<slug>?download=pdf
  // so every download goes through this one email step. Read the param from
  // window (not useSearchParams) so the page stays statically generated.
  useEffect(() => {
    let f: string | null = null;
    try {
      f = new URLSearchParams(window.location.search).get("download");
    } catch {
      return;
    }
    if (f !== "pdf" && f !== "xlsx" && f !== "csv") return;
    const fmt = f as Format;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("download");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch {
      // cosmetic only
    }
    const stored = readStored();
    if (stored) {
      recordKnown(fmt, stored);
      startDownload(href(fmt));
      setDone({ format: fmt, emailed: false, email: stored.email });
      return;
    }
    setPending(fmt);
    rootRef.current?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onClick(e: React.MouseEvent, f: Format) {
    const stored = readStored();
    if (stored) {
      // Known visitor: let the link download as normal, record it in the background.
      recordKnown(f, stored);
      return;
    }
    e.preventDefault();
    setDone(null);
    setError("");
    setPending(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pending) return;
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) {
      setError("Enter a valid email address.");
      return;
    }
    setState("sending");
    setError("");
    let emailed = false;
    try {
      const res = await fetch("/api/templates/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, format: pending, email: addr, consent, venueType: venueType || null, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 400) {
        setError(data?.error || "That email address doesn't look right.");
        setState("idle");
        return;
      }
      emailed = !!data?.emailed;
    } catch {
      // Network trouble: still give them the file.
    }
    try {
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify({ email: addr.toLowerCase(), consent, venueType }));
    } catch {
      // private mode — they'll just be asked again next time
    }
    startDownload(href(pending));
    setDone({ format: pending, emailed, email: addr });
    setPending(null);
    setState("idle");
  }

  return (
    <div className="mb-10" data-testid="template-download" ref={rootRef}>
      <div className="flex flex-wrap gap-3">
        <a
          href={href("pdf")}
          download
          onClick={(e) => onClick(e, "pdf")}
          className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-5 py-3 font-semibold text-white"
        >
          Download PDF
        </a>
        <a
          href={href("xlsx")}
          download
          onClick={(e) => onClick(e, "xlsx")}
          className="rounded-xl border border-white/25 px-5 py-3 font-semibold text-white hover:border-white/50"
        >
          Download Excel
        </a>
        <a
          href={href("csv")}
          download
          onClick={(e) => onClick(e, "csv")}
          className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 hover:border-white/35 hover:text-white"
        >
          CSV
        </a>
      </div>

      {pending && (
        <form
          onSubmit={submit}
          className="mt-4 max-w-xl rounded-2xl border border-white/15 bg-white/[0.04] p-5"
          data-testid="template-gate"
          noValidate
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="font-semibold">Enter your email to download the {name.toLowerCase()}</p>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="text-slate-400 hover:text-white text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="tpl-email" className="sr-only">
              Email address
            </label>
            <input
              id="tpl-email"
              ref={emailRef}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourvenue.com"
              className="flex-1 rounded-xl border border-white/20 bg-[#0A1427] px-4 py-3 text-white placeholder:text-slate-500 focus:border-[#ff6b35] focus:outline-none"
              data-testid="template-gate-email"
            />
            <button
              type="submit"
              disabled={state === "sending"}
              className="rounded-xl bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-5 py-3 font-semibold text-white disabled:opacity-60 whitespace-nowrap"
              data-testid="template-gate-submit"
            >
              {state === "sending" ? "Preparing…" : `Download ${LABEL[pending]}`}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-400" role="alert" data-testid="template-gate-error">
              {error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor="tpl-venue" className="text-slate-400">
              Your venue
            </label>
            <select
              id="tpl-venue"
              value={venueType}
              onChange={(e) => setVenueType(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#0A1427] px-2 py-1.5 text-slate-200"
            >
              <option value="">Choose (optional)</option>
              {VENUE_TYPES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <label className="mt-3 flex items-start gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#ff6b35]"
              data-testid="template-gate-consent"
            />
            <span>{CONSENT_TEXT}</span>
          </label>
          {/* Honeypot — hidden from people, irresistible to form bots. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />
          <p className="mt-3 text-xs text-slate-500">
            Your file downloads straight away. We never share your address.{" "}
            <a href="/privacy" className="underline hover:text-slate-300">
              Privacy policy
            </a>
            .
          </p>
        </form>
      )}

      {done && (
        <p className="mt-4 text-sm text-emerald-300" data-testid="template-gate-done">
          Your {LABEL[done.format]} is downloading.
          {done.emailed ? ` A copy is on its way to ${done.email}.` : ""}{" "}
          <a href={href(done.format)} download className="underline hover:text-white">
            Didn&apos;t start? Download again
          </a>
        </p>
      )}

      {!pending && !done && (
        <p className="text-xs text-slate-500 mt-3">
          Free — just enter your email and the {name.toLowerCase()} downloads straight away.
        </p>
      )}
    </div>
  );
}
