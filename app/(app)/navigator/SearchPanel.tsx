"use client";

// One search box over every Navigator surface.
//
// This is an overlay rather than an eleventh tab on purpose. The problem being
// fixed is that each tab is a silo, and a "Search" tab would have been a silo
// too — reachable only by leaving whatever you were doing. As an overlay it
// opens from any tab, over the top of it, and closes back to where you were.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ListChecks, Camera, Brain, MessageCircle, Loader2 } from "lucide-react";
import { Pill, Empty, inputClass } from "./nav-ui";
import { api, errMsg } from "./api";

type SearchSource = "task" | "capture" | "memory" | "chat";

type SearchHit = {
  id: string;
  source: SearchSource;
  tab: string;
  title: string;
  snippet: string | null;
  meta: string | null;
  flags: string[];
  when: string;
  score: number;
};

const SOURCE_META: Record<
  SearchSource,
  { label: string; icon: typeof ListChecks; tone: "flame" | "blue" | "violet" | "green" }
> = {
  task: { label: "Tasks", icon: ListChecks, tone: "flame" },
  capture: { label: "Captures", icon: Camera, tone: "blue" },
  memory: { label: "Memory", icon: Brain, tone: "violet" },
  chat: { label: "Chat", icon: MessageCircle, tone: "green" },
};

const ALL_SOURCES: SearchSource[] = ["task", "capture", "memory", "chat"];

function ago(iso: string): string {
  const d = new Date(iso).getTime();
  const mins = Math.round((Date.now() - d) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

export function SearchPanel({
  open,
  onClose,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  onJump: (tab: string) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [counts, setCounts] = useState<Record<SearchSource, number> | null>(null);
  const [only, setOnly] = useState<SearchSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on open. Without this the overlay appears and the phone keyboard
  // does not, which costs a second tap every single time.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const run = useCallback(
    async (query: string, sources: SearchSource[]) => {
      if (query.trim().length < 2) {
        setHits(null);
        setCounts(null);
        setErr("");
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "40" });
        if (sources.length) params.set("sources", sources.join(","));
        const res = await api<{ hits: SearchHit[]; counts: Record<SearchSource, number> }>(
          `/search?${params.toString()}`,
        );
        setHits(res.hits ?? []);
        setCounts(res.counts ?? null);
        setErr("");
      } catch (e) {
        setErr(errMsg(e));
        setHits(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Debounced: one request per pause in typing, not one per keystroke.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => run(q, only), 250);
    return () => clearTimeout(t);
  }, [q, only, open, run]);

  const toggleSource = (s: SearchSource) =>
    setOnly((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const grouped = useMemo(() => hits ?? [], [hits]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#060b16]/80 p-4 backdrop-blur-sm sm:p-8">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f1c35] shadow-[0_40px_100px_-30px_rgba(0,0,0,0.9)]">
        {/* Input row */}
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks, captures, memory and chat…"
            className="flex-1 border-0 bg-transparent p-0 text-[15px] text-slate-100 placeholder-slate-500 outline-none focus:ring-0"
          />
          {loading && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-slate-400" />}
          <button
            onClick={onClose}
            aria-label="Close search"
            className="flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source filters */}
        <div className="flex flex-wrap gap-1.5 border-b border-white/10 px-4 py-2.5">
          {ALL_SOURCES.map((s) => {
            const m = SOURCE_META[s];
            const Icon = m.icon;
            const active = only.includes(s);
            const n = counts?.[s];
            return (
              <button
                key={s}
                onClick={() => toggleSource(s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "border-[#ff6b35]/40 bg-[#ff6b35]/15 text-[#ffb08a]"
                    : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09] hover:text-slate-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {m.label}
                {n != null && n > 0 && <span className="text-slate-500">{n}</span>}
              </button>
            );
          })}
          {only.length > 0 && (
            <button
              onClick={() => setOnly([])}
              className="ml-auto text-[11px] font-semibold text-slate-500 transition hover:text-slate-300"
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {err && (
            <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {err}
            </div>
          )}

          {!err && q.trim().length < 2 && (
            <p className="py-6 text-center text-sm text-slate-500">
              Type at least two characters. Everything you have dumped into Navigator is in here —
              tasks, photographed documents, what it remembers about you, and every chat message.
            </p>
          )}

          {!err && q.trim().length >= 2 && grouped.length === 0 && !loading && (
            <Empty>Nothing matches “{q.trim()}”.</Empty>
          )}

          <div className="space-y-1.5">
            {grouped.map((h) => {
              const m = SOURCE_META[h.source];
              const Icon = m.icon;
              return (
                <button
                  key={`${h.source}-${h.id}`}
                  onClick={() => {
                    onJump(h.tab);
                    onClose();
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-slate-100">{h.title}</span>
                        {h.flags.map((f) => (
                          <Pill key={f} tone={f === "draft" ? "amber" : "slate"}>
                            {f}
                          </Pill>
                        ))}
                      </div>
                      {h.snippet && (
                        <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">{h.snippet}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-400">{m.label}</span>
                        {h.meta && <span>· {h.meta}</span>}
                        <span>· {ago(h.when)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {grouped.length > 0 && (
            <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] leading-relaxed text-slate-500">
              Tapping a result opens the tab it lives in. It does not jump to the exact row yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
