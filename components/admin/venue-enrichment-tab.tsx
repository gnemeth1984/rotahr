"use client";

/**
 * Review queue for public venue pages.
 *
 * "Read sites" fetches each venue's own website and proposes facts. It publishes
 * nothing. You tick the fields you believe and press Publish; everything you did
 * not tick stays off the page.
 *
 * The comparison is deliberately side by side. The whole reason this screen
 * exists is that 84 of these pages once published an invented Mon-Sat
 * 12:00-23:00 week as fact for venues that never asked for a page.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Globe,
  UtensilsCrossed,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface HoursEntry {
  day: number;
  closed: boolean;
  open: string;
  close: string;
}

interface Dish {
  name: string;
  description: string | null;
  price: number | null;
  category: string;
}

interface Provenance {
  sourceUrl: string;
  fetchedAt: string;
  needsReview: boolean;
}

interface Row {
  id: string;
  slug: string;
  name: string;
  status: string;
  hasHours: boolean;
  dishCount: number;
  warningCount: number;
  pagesFetched: number;
  createdAt: string;
  reviewedBy: string | null;
  current: {
    openingHours: HoursEntry[] | null;
    about: string | null;
    cuisine: string | null;
    dishCount: number;
    website: string | null;
  };
  proposed: {
    openingHours: HoursEntry[] | null;
    about: string | null;
    cuisine: string | null;
    dishes: Dish[];
    pagesFetched: string[];
    provenance: Record<string, Provenance>;
    warnings: string[];
    error?: string;
  };
}

/** Group sessions so split lunch/dinner service reads correctly. */
function hoursLines(hours: HoursEntry[] | null): string[] {
  if (!hours?.length) return [];
  const days = [...new Set(hours.map((h) => h.day))].sort((a, b) => a - b);
  return days.map((d) => {
    const rows = hours.filter((h) => h.day === d);
    const label = rows.every((h) => h.closed)
      ? "Closed"
      : rows
          .filter((h) => !h.closed)
          .map((h) => `${h.open}–${h.close}`)
          .join(", ");
    return `${DAY_SHORT[d]}  ${label}`;
  });
}

export function VenueEnrichmentTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending");
  const [running, setRunning] = useState(false);
  const [runNote, setRunNote] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ticks, setTicks] = useState<
    Record<string, { hours: boolean; about: boolean; cuisine: boolean; dishes: Set<string> }>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/venue-enrichment?status=${status}`);
    const data = await res.json();
    const next: Row[] = data.rows ?? [];
    setRows(next);
    // Default: nothing ticked. Approval has to be an action, not a default.
    setTicks(
      Object.fromEntries(
        next.map((r) => [r.id, { hours: false, about: false, cuisine: false, dishes: new Set<string>() }])
      )
    );
    setLoading(false);
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(limit: number) {
    setRunning(true);
    setRunNote(null);
    try {
      const res = await fetch("/api/admin/venue-enrichment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "run", limit }),
      });
      const data = await res.json();
      setRunNote(
        `Read ${data.ran ?? 0} sites — ${data.queued ?? 0} with something to review, ${data.empty ?? 0} with nothing usable.`
      );
      await load();
    } catch {
      setRunNote("The batch failed. Nothing was published.");
    } finally {
      setRunning(false);
    }
  }

  async function publish(row: Row) {
    const t = ticks[row.id];
    if (!t) return;
    if (!t.hours && !t.about && !t.cuisine && t.dishes.size === 0) return;
    setBusyId(row.id);
    await fetch("/api/admin/venue-enrichment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "publish",
        id: row.id,
        approved: {
          openingHours: t.hours,
          about: t.about,
          cuisine: t.cuisine,
          dishes: [...t.dishes],
        },
      }),
    });
    setBusyId(null);
    await load();
  }

  async function reject(row: Row) {
    setBusyId(row.id);
    await fetch("/api/admin/venue-enrichment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "reject", id: row.id }),
    });
    setBusyId(null);
    await load();
  }

  function toggle(id: string, key: "hours" | "about" | "cuisine") {
    setTicks((prev) => ({ ...prev, [id]: { ...prev[id], [key]: !prev[id]?.[key] } }));
  }

  function toggleDish(id: string, name: string) {
    setTicks((prev) => {
      const cur = prev[id] ?? { hours: false, about: false, cuisine: false, dishes: new Set<string>() };
      const dishes = new Set(cur.dishes);
      if (dishes.has(name)) dishes.delete(name);
      else dishes.add(name);
      return { ...prev, [id]: { ...cur, dishes } };
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => run(5)} disabled={running} size="sm">
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
            Read 5 sites
          </Button>
          <Button onClick={() => run(15)} disabled={running} size="sm" variant="outline">
            Read 15
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="pending">Awaiting review</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="empty">Nothing found</option>
              <option value="all">All</option>
            </select>
            <Button onClick={() => void load()} size="sm" variant="outline" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Reading a site publishes nothing. Tick the fields you believe, then press Publish — anything
          unticked stays off the page. These pages carry other businesses&apos; names, so a guessed opening
          time is worse than a blank one.
        </p>
        {runNote && <p className="mt-2 text-sm font-medium text-slate-700">{runNote}</p>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing here. Press “Read 5 sites” to queue some.</p>
      ) : (
        rows.map((row) => {
          const t = ticks[row.id] ?? {
            hours: false,
            about: false,
            cuisine: false,
            dishes: new Set<string>(),
          };
          const proposedHours = hoursLines(row.proposed.openingHours);
          const currentHours = hoursLines(row.current.openingHours);
          const nothingTicked = !t.hours && !t.about && !t.cuisine && t.dishes.size === 0;

          return (
            <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{row.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <a
                      className="inline-flex items-center gap-1 underline"
                      href={`https://rotahr.com/v/${row.slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      /v/{row.slug} <ExternalLink className="h-3 w-3" />
                    </a>
                    {row.current.website && (
                      <a
                        className="inline-flex items-center gap-1 underline"
                        href={row.current.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        their site <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <span>{row.pagesFetched} pages read</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{row.status}</span>
                  </div>
                </div>
                {row.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => void publish(row)}
                      disabled={busyId === row.id || nothingTicked}
                    >
                      {busyId === row.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Publish ticked
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void reject(row)}
                      disabled={busyId === row.id}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </div>

              {row.proposed.warnings.length > 0 && (
                <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
                  {row.proposed.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {/* Hours */}
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`h-${row.id}`}
                      checked={t.hours}
                      disabled={!proposedHours.length || row.status !== "pending"}
                      onChange={() => toggle(row.id, "hours")}
                      className="h-4 w-4"
                    />
                    <label htmlFor={`h-${row.id}`} className="flex items-center gap-1.5 text-sm font-semibold">
                      <Clock className="h-3.5 w-3.5" /> Opening hours
                    </label>
                  </div>
                  <div className="mt-2 grid gap-3 text-xs sm:grid-cols-2">
                    <div>
                      <p className="mb-1 font-medium text-slate-400">Live now</p>
                      {currentHours.length ? (
                        <pre className="whitespace-pre-wrap font-mono text-slate-600">
                          {currentHours.join("\n")}
                        </pre>
                      ) : (
                        <p className="text-slate-400">not confirmed</p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 font-medium text-slate-400">Found on their site</p>
                      {proposedHours.length ? (
                        <pre className="whitespace-pre-wrap font-mono text-slate-900">
                          {proposedHours.join("\n")}
                        </pre>
                      ) : (
                        <p className="text-slate-400">nothing stated</p>
                      )}
                    </div>
                  </div>
                  {row.proposed.provenance.openingHours && (
                    <p className="mt-2 truncate text-[11px] text-slate-400">
                      source: {row.proposed.provenance.openingHours.sourceUrl}
                    </p>
                  )}
                </div>

                {/* About + cuisine */}
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`a-${row.id}`}
                        checked={t.about}
                        disabled={!row.proposed.about || row.status !== "pending"}
                        onChange={() => toggle(row.id, "about")}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`a-${row.id}`} className="text-sm font-semibold">
                        About
                      </label>
                    </div>
                    <p className="mt-2 text-xs text-slate-900">
                      {row.proposed.about ?? <span className="text-slate-400">nothing usable</span>}
                    </p>
                    {row.current.about && (
                      <p className="mt-2 text-[11px] text-slate-400">
                        live now: {row.current.about.slice(0, 140)}
                        {row.current.about.length > 140 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`c-${row.id}`}
                        checked={t.cuisine}
                        disabled={!row.proposed.cuisine || row.status !== "pending"}
                        onChange={() => toggle(row.id, "cuisine")}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`c-${row.id}`} className="text-sm font-semibold">
                        Cuisine
                      </label>
                      <span className="text-xs text-slate-900">
                        {row.proposed.cuisine ?? <span className="text-slate-400">none</span>}
                      </span>
                      {row.current.cuisine && (
                        <span className="text-[11px] text-slate-400">(live: {row.current.cuisine})</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dishes */}
              {row.proposed.dishes.length > 0 && (
                <div className="mt-4 rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <UtensilsCrossed className="h-3.5 w-3.5" />
                    <span className="text-sm font-semibold">
                      Menu items ({row.proposed.dishes.length} found, {t.dishes.size} ticked)
                    </span>
                    <button
                      className="text-xs underline"
                      onClick={() =>
                        setTicks((prev) => ({
                          ...prev,
                          [row.id]: {
                            ...prev[row.id],
                            dishes:
                              prev[row.id]?.dishes.size === row.proposed.dishes.length
                                ? new Set<string>()
                                : new Set(row.proposed.dishes.map((d) => d.name)),
                          },
                        }))
                      }
                    >
                      tick all / none
                    </button>
                    {row.current.dishCount > 0 && (
                      <span className="text-[11px] text-amber-700">
                        publishing replaces the {row.current.dishCount} item(s) already on this page
                      </span>
                    )}
                  </div>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {row.proposed.dishes.map((d) => (
                      <li key={d.name} className="flex items-start gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={t.dishes.has(d.name)}
                          disabled={row.status !== "pending"}
                          onChange={() => toggleDish(row.id, d.name)}
                          className="mt-0.5 h-3.5 w-3.5"
                        />
                        <span>
                          <span className="font-medium">{d.name}</span>
                          {d.price !== null && <span className="text-slate-500"> €{d.price}</span>}
                          <span className="text-slate-400"> · {d.category}</span>
                          {d.description && <span className="block text-slate-500">{d.description}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {row.proposed.error && (
                <p className="mt-3 text-xs text-slate-500">note: {row.proposed.error}</p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
