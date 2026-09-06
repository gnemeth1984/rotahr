"use client";

/**
 * Admin -> Lead Finder tab.
 *
 * Finds restaurants, bars and cafes with NO website anywhere in the world,
 * using OpenStreetMap, so they can be called.
 *
 * Two views. "Search" runs a fresh OSM lookup and lets you tick rows into the
 * call list. "Call list" is the saved CallLead table: work it, log the
 * outcome, export it to CSV.
 *
 * Honest caveat that belongs on screen, not just in a doc comment: OSM is
 * volunteer maintained, so "no website tag" often means nobody added one yet.
 * Treat every row as a venue to qualify on the phone, not a proven fact.
 *
 * OSM data is ODbL, so the attribution line at the bottom is a licence
 * condition, not decoration. Do not remove it.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  Phone,
  MapPin,
  Download,
  Import,
  RefreshCw,
  Trash2,
  Info,
  Mail,
  ExternalLink,
} from "lucide-react";

const VENUE_TYPES = ["restaurant", "bar", "cafe", "pub", "fast_food"] as const;

const TYPE_LABEL: Record<string, string> = {
  restaurant: "Restaurants",
  bar: "Bars",
  cafe: "Cafes",
  pub: "Pubs",
  fast_food: "Takeaways",
};

const CALL_STATUSES = [
  "new",
  "called",
  "no_answer",
  "callback",
  "not_interested",
  "signed",
];

const STATUS_LABEL: Record<string, string> = {
  new: "Not called",
  called: "Called",
  no_answer: "No answer",
  callback: "Call back",
  not_interested: "Not interested",
  signed: "Signed up",
};

const STATUS_STYLE: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  called: "bg-blue-100 text-blue-700",
  no_answer: "bg-amber-100 text-amber-700",
  callback: "bg-purple-100 text-purple-700",
  not_interested: "bg-rose-100 text-rose-700",
  signed: "bg-emerald-100 text-emerald-700",
};

interface Candidate {
  osmKey: string;
  osmType: string;
  osmId: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  region: string;
  country: string;
  lat: number | null;
  lng: number | null;
  facebook: string | null;
  instagram: string | null;
  missing: string[];
  score: number;
  alreadySaved?: boolean;
}

interface Outcome {
  place: string;
  resolvedPlace: string;
  country: string;
  radiusKm: number | null;
  totalFound: number;
  candidates: Candidate[];
  dropped: { hasWebsite: number; chain: number; noContact: number; unnamed: number };
  attribution: string;
  alreadySavedCount: number;
}

interface SavedLead {
  id: string;
  name: string;
  category: string;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  country: string;
  facebook: string | null;
  instagram: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  osmKey: string;
  createdAt: string;
}

export function LeadFinderTab() {
  const [view, setView] = useState<"search" | "list">("search");

  // Search state
  const [place, setPlace] = useState("");
  const [types, setTypes] = useState<string[]>([...VENUE_TYPES]);
  const [radiusKm, setRadiusKm] = useState(8);
  const [searching, setSearching] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  // Call list state
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(false);

  const toggleType = (t: string) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const runSearch = async () => {
    if (place.trim().length < 2) {
      setError("Type a town, city or area to search.");
      return;
    }
    setSearching(true);
    setError("");
    setImportMsg("");
    setOutcome(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/admin/lead-finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place, types, radiusKm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed.");
      setOutcome(json);
      // Pre-tick everything that is not already in the call list.
      setSelected(
        new Set(
          (json.candidates as Candidate[])
            .filter((c) => !c.alreadySaved)
            .map((c) => c.osmKey),
        ),
      );
    } catch (e: any) {
      setError(e?.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const toggleRow = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const importSelected = async () => {
    if (!outcome || !selected.size) return;
    setImporting(true);
    setImportMsg("");
    try {
      const chosen = outcome.candidates.filter((c) => selected.has(c.osmKey));
      const res = await fetch("/api/admin/lead-finder/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: chosen, source: `osm:${outcome.place}` }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed.");
      setImportMsg(
        `Added ${json.imported} to the call list${
          json.skipped ? `, skipped ${json.skipped} already there` : ""
        }.`,
      );
      setOutcome((prev) =>
        prev
          ? {
              ...prev,
              candidates: prev.candidates.map((c) =>
                selected.has(c.osmKey) ? { ...c, alreadySaved: true } : c,
              ),
            }
          : prev,
      );
      setSelected(new Set());
    } catch (e: any) {
      setImportMsg(e?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/admin/lead-finder?${params.toString()}`);
      const json = await res.json();
      if (res.ok) {
        setLeads(json.leads ?? []);
        setCounts(json.counts ?? {});
        setTotal(json.total ?? 0);
      }
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    if (view === "list") loadList();
  }, [view, loadList]);

  const updateLead = async (id: string, patch: Partial<SavedLead>) => {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    await fetch("/api/admin/lead-finder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    loadList();
  };

  const deleteLead = async (id: string) => {
    if (!confirm("Remove this venue from the call list?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    await fetch("/api/admin/lead-finder", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    loadList();
  };

  const withPhone = useMemo(
    () => (outcome ? outcome.candidates.filter((c) => c.phone).length : 0),
    [outcome],
  );

  return (
    <div className="space-y-4">
      {/* View switch */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setView("search")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            view === "search"
              ? "bg-emerald-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" /> Search
          </span>
        </button>
        <button
          onClick={() => setView("list")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            view === "list"
              ? "bg-emerald-600 text-white"
              : "bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" /> Call list{total ? ` (${total})` : ""}
          </span>
        </button>
      </div>

      {view === "search" && (
        <>
          {/* Search panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Town, city or area
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Galway, Ireland"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={runSearch}
                  disabled={searching}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                >
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {searching ? "Searching" : "Find venues"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Anywhere in the world. Add the county or country if the name is
                a common one, eg &ldquo;Richmond, London&rdquo;.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {VENUE_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                    types.includes(t)
                      ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
              <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                Radius if no boundary
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="border border-slate-200 rounded-md px-2 py-1 text-xs"
                >
                  {[3, 5, 8, 15, 25].map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>

          {/* Honest caveat */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              These are venues with no website <em>on OpenStreetMap</em>. OSM is
              volunteer maintained, so some will have a site nobody has added
              yet. Qualify on the call. And a venue with no website is a weak
              buying signal on its own &mdash; the phone number is the asset
              here, not the missing site.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {/* Results */}
          {outcome && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 p-3 text-xs text-slate-600">
                <span className="font-medium text-slate-900">
                  {outcome.candidates.length} lead
                  {outcome.candidates.length === 1 ? "" : "s"}
                </span>
                <span>{withPhone} with a phone number</span>
                <span className="text-slate-400">
                  from {outcome.totalFound} venues in {outcome.resolvedPlace}
                  {outcome.radiusKm ? ` (within ${outcome.radiusKm} km)` : ""}
                </span>
                <span className="text-slate-400">
                  dropped: {outcome.dropped.hasWebsite} have a website,{" "}
                  {outcome.dropped.chain} chains, {outcome.dropped.noContact} no
                  contact details
                </span>
              </div>

              {outcome.candidates.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Nothing here matched. Every venue either had a website, was a
                  chain, or had no phone and no address.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                    <label className="flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={selected.size > 0 && selected.size === outcome.candidates.filter((c) => !c.alreadySaved).length}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? new Set(
                                  outcome.candidates
                                    .filter((c) => !c.alreadySaved)
                                    .map((c) => c.osmKey),
                                )
                              : new Set(),
                          )
                        }
                      />
                      {selected.size} selected
                    </label>
                    <button
                      onClick={importSelected}
                      disabled={!selected.size || importing}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {importing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Import className="h-3.5 w-3.5" />
                      )}
                      Add to call list
                    </button>
                  </div>

                  {importMsg && (
                    <p className="border-b border-slate-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      {importMsg}
                    </p>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-8 px-3 py-2" />
                          <th className="px-3 py-2">Venue</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Address</th>
                          <th className="px-3 py-2">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {outcome.candidates.map((c) => (
                          <tr
                            key={c.osmKey}
                            className={c.alreadySaved ? "bg-slate-50/60" : ""}
                          >
                            <td className="px-3 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={selected.has(c.osmKey)}
                                disabled={c.alreadySaved}
                                onChange={() => toggleRow(c.osmKey)}
                              />
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-slate-900">{c.name}</div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{TYPE_LABEL[c.category] ?? c.category}</span>
                                {c.facebook && (
                                  <span className="rounded bg-blue-50 px-1 text-[10px] font-medium text-blue-600">
                                    FB
                                  </span>
                                )}
                                {c.instagram && (
                                  <span className="rounded bg-pink-50 px-1 text-[10px] font-medium text-pink-600">
                                    IG
                                  </span>
                                )}
                                {c.email && <Mail className="h-3 w-3 text-slate-400" />}
                                {c.alreadySaved && (
                                  <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                                    In call list
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              {c.phone ? (
                                <a
                                  href={`tel:${c.phone.replace(/\s/g, "")}`}
                                  className="text-emerald-700 hover:underline"
                                >
                                  {c.phone}
                                </a>
                              ) : (
                                <span className="text-slate-400">&mdash;</span>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-xs text-slate-600">
                              {c.address || <span className="text-slate-400">&mdash;</span>}
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="flex flex-wrap gap-1">
                                {c.missing.map((m) => (
                                  <span
                                    key={m}
                                    className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                                  >
                                    {m}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
                {outcome.attribution} &mdash; data under ODbL.
              </p>
            </div>
          )}
        </>
      )}

      {view === "list" && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadList()}
              placeholder="Search name, city or phone"
              className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="">All statuses</option>
              {CALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]} {counts[s] ? `(${counts[s]})` : ""}
                </option>
              ))}
            </select>
            <button
              onClick={loadList}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <a
              href={`/api/admin/lead-finder/export${statusFilter ? `?status=${statusFilter}` : ""}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </a>
          </div>

          {leads.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {loadingList ? "Loading..." : "Nothing here yet. Run a search and add venues to the call list."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Venue</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Where</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Notes</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map((l) => (
                    <tr key={l.id}>
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium text-slate-900">{l.name}</div>
                        <a
                          href={`https://www.openstreetmap.org/${l.osmKey}`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
                        >
                          <ExternalLink className="h-3 w-3" /> {TYPE_LABEL[l.category] ?? l.category}
                        </a>
                      </td>
                      <td className="px-3 py-2 align-top">
                        {l.phone ? (
                          <a
                            href={`tel:${l.phone.replace(/\s/g, "")}`}
                            className="text-emerald-700 hover:underline"
                          >
                            {l.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">&mdash;</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-slate-600">
                        <span className="flex items-start gap-1">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                          <span>{l.address || l.city || "—"}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={l.status}
                          onChange={(e) => updateLead(l.id, { status: e.target.value })}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLE[l.status] ?? "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {CALL_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          defaultValue={l.notes ?? ""}
                          onBlur={(e) => {
                            if (e.target.value !== (l.notes ?? "")) {
                              updateLead(l.id, { notes: e.target.value });
                            }
                          }}
                          placeholder="What happened on the call"
                          className="w-full min-w-[160px] rounded border border-transparent px-2 py-1 text-xs hover:border-slate-200 focus:border-emerald-400 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <button
                          onClick={() => deleteLead(l.id)}
                          className="text-slate-300 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
            © OpenStreetMap contributors &mdash; data under ODbL.
          </p>
        </div>
      )}
    </div>
  );
}
