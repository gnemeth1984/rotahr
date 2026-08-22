"use client";

// What Navigator remembers — visible and correctable.
//
// Extraction writes to this store without asking, so this panel is not a nice
// extra: it is the only place a wrong auto-extracted "fact" can be seen and
// dropped. Without it the model would quietly carry a mistake forever and
// nothing on screen would ever say what it thinks it knows.
import { useCallback, useEffect, useState } from "react";
import { Brain, Check, Loader2, Pin, PinOff, Plus, RotateCcw, Trash2 } from "lucide-react";
import { NavMemoryRow } from "./types";
import { api, errMsg } from "./api";
import { Btn, Panel, Pill, SectionTitle, inputClass } from "./nav-ui";

const KINDS = ["fact", "preference", "person", "thread", "project"] as const;

const KIND_TONE: Record<string, "flame" | "amber" | "green" | "blue" | "violet" | "slate"> = {
  fact: "blue",
  preference: "violet",
  person: "green",
  thread: "amber",
  project: "flame",
};

export function MemoryPanel() {
  const [rows, setRows] = useState<NavMemoryRow[] | null>(null);
  const [showForgotten, setShowForgotten] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ kind: "fact", key: "", value: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    async (withForgotten: boolean) => {
      try {
        setError(null);
        const data = await api<NavMemoryRow[]>(`/memory${withForgotten ? "?forgotten=1" : ""}`);
        setRows(data);
      } catch (e) {
        setRows([]);
        setError(errMsg(e));
      }
    },
    []
  );

  useEffect(() => {
    void load(showForgotten);
  }, [load, showForgotten]);

  async function togglePin(row: NavMemoryRow) {
    setBusyId(row.id);
    try {
      await api("/memory", { method: "PATCH", body: { id: row.id, pinned: !row.pinned } });
      await load(showForgotten);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function forget(row: NavMemoryRow) {
    setBusyId(row.id);
    try {
      await api(`/memory?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      await load(showForgotten);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function restore(row: NavMemoryRow) {
    setBusyId(row.id);
    try {
      await api("/memory", { method: "PATCH", body: { id: row.id, forgotten: false } });
      await load(showForgotten);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusyId(null);
    }
  }

  async function add() {
    if (!draft.key.trim() || !draft.value.trim()) return;
    setSaving(true);
    try {
      await api("/memory", { body: { kind: draft.kind, key: draft.key, value: draft.value } });
      setDraft({ kind: "fact", key: "", value: "" });
      setAdding(false);
      await load(showForgotten);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  const live = (rows ?? []).filter((r) => !r.forgotten);
  const dropped = (rows ?? []).filter((r) => r.forgotten);

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Brain className="h-3.5 w-3.5" /> What Navigator remembers
          </span>
        </SectionTitle>
        <Btn size="sm" variant="quiet" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Btn>
      </div>

      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        It saves durable things you mention in chat on its own — preferences, people, projects, ongoing threads. Anything
        wrong here, drop it: it stops using it immediately. Pin the handful it should always have in front of it.
      </p>

      {adding && (
        <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap gap-2">
            <select
              className={`${inputClass} sm:w-40`}
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              className={`${inputClass} sm:flex-1`}
              placeholder="Short label, e.g. gym timing"
              value={draft.key}
              onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
            />
          </div>
          <textarea
            className={`${inputClass} min-h-[64px]`}
            placeholder="One plain sentence it should remember."
            value={draft.value}
            onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
          />
          <div className="flex gap-2">
            <Btn size="sm" variant="flame" loading={saving} onClick={add}>
              <Check className="h-3.5 w-3.5" />
              Save
            </Btn>
            <Btn size="sm" variant="quiet" onClick={() => setAdding(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

      <div className="mt-4 space-y-2">
        {rows === null ? (
          <p className="inline-flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : live.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nothing yet. It starts filling in as you talk to it — or add the first one by hand.
          </p>
        ) : (
          live.map((r) => (
            <Row
              key={r.id}
              row={r}
              busy={busyId === r.id}
              onPin={() => togglePin(r)}
              onForget={() => forget(r)}
            />
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => setShowForgotten((v) => !v)}
          className="text-xs text-slate-400 underline-offset-2 transition hover:text-slate-200 hover:underline"
        >
          {showForgotten ? "Hide dropped" : "Show what I've dropped"}
        </button>
        {live.length > 0 && (
          <span className="text-[11px] text-slate-600">
            {live.length} remembered{live.filter((r) => r.pinned).length ? ` · ${live.filter((r) => r.pinned).length} pinned` : ""}
          </span>
        )}
      </div>

      {showForgotten && (
        <div className="mt-3 space-y-2">
          {dropped.length === 0 ? (
            <p className="text-xs text-slate-600">Nothing dropped.</p>
          ) : (
            dropped.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 opacity-60"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-400">{r.key}</p>
                  <p className="text-xs leading-snug text-slate-500">{r.value}</p>
                </div>
                <button
                  type="button"
                  onClick={() => restore(r)}
                  disabled={busyId === r.id}
                  aria-label="Remember this again"
                  className="shrink-0 rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-[#ff6b35]/40 hover:text-white disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </Panel>
  );
}

function Row({
  row,
  busy,
  onPin,
  onForget,
}: {
  row: NavMemoryRow;
  busy: boolean;
  onPin: () => void;
  onForget: () => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${
        row.pinned ? "border-[#ff6b35]/30 bg-[#ff6b35]/[0.06]" : "border-white/[0.08] bg-white/[0.03]"
      }`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={KIND_TONE[row.kind] ?? "slate"}>{row.kind}</Pill>
          <span className="truncate text-xs font-medium text-slate-200">{row.key}</span>
          {row.subject && <span className="truncate text-[11px] text-slate-500">· {row.subject}</span>}
          {/* Auto-extracted rows are the ones worth a second look. */}
          {row.source === "auto" && <span className="text-[10px] uppercase tracking-wide text-slate-600">auto</span>}
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-300">{row.value}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onPin}
          disabled={busy}
          aria-label={row.pinned ? "Unpin" : "Always keep in context"}
          className={`rounded-lg border p-1.5 transition disabled:opacity-40 ${
            row.pinned
              ? "border-[#ff6b35]/40 text-[#ff8f5f]"
              : "border-white/10 text-slate-400 hover:border-[#ff6b35]/40 hover:text-white"
          }`}
        >
          {row.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={busy}
          aria-label="Forget this"
          className="rounded-lg border border-white/10 p-1.5 text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
