"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Receipt,
  StickyNote,
  FileText,
  HelpCircle,
  Trash2,
  CalendarClock,
  ListChecks,
  RefreshCw,
} from "lucide-react";
import { Panel, SectionTitle, Btn, Pill, Empty, Spinner } from "./nav-ui";
import { errMsg } from "./api";

type Capture = {
  id: string;
  kind: "receipt" | "note" | "document" | "unknown";
  status: string;
  title: string | null;
  summary: string | null;
  vendor: string | null;
  total: number | null;
  currency: string | null;
  docDate: string | null;
  deadline: string | null;
  taskIds: string[];
  error: string | null;
  createdAt: string;
};

const KIND_META: Record<
  Capture["kind"],
  { label: string; icon: typeof Receipt; tone: "green" | "amber" | "blue" | "slate" }
> = {
  receipt: { label: "Receipt", icon: Receipt, tone: "green" },
  note: { label: "Note", icon: StickyNote, tone: "amber" },
  document: { label: "Document", icon: FileText, tone: "blue" },
  unknown: { label: "Unread", icon: HelpCircle, tone: "slate" },
};

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMoney(total: number | null, currency: string | null): string | null {
  if (total == null) return null;
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
  return `${sym}${total.toFixed(2)}`;
}

export function CaptureTab({ refresh }: { refresh?: () => void }) {
  const [rows, setRows] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justDone, setJustDone] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/navigator/capture?limit=40", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Could not load captures");
      setRows(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setError(null);
      setJustDone(null);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/navigator/capture", { method: "POST", body });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Upload failed");

        await load();
        setJustDone(data?.capture?.id ?? null);
        // A note that produced tasks changes the task list, so the shared
        // state has to be refetched or the Tasks tab lies until reload.
        if (data?.tasksCreated > 0) refresh?.();
        if (data?.readFailed) setError(`Photo saved, but reading it failed: ${data.error ?? "unknown"}`);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(false);
        // Clear both inputs so the same file can be picked again after a retry.
        if (cameraRef.current) cameraRef.current.value = "";
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [load, refresh]
  );

  const setKind = useCallback(
    async (id: string, kind: Capture["kind"]) => {
      try {
        const res = await fetch("/api/navigator/capture", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, kind }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Could not change that");
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, kind } : r)));
      } catch (e) {
        setError(errMsg(e));
      }
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/navigator/capture?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not delete that");
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(errMsg(e));
    }
  }, []);

  return (
    <div className="space-y-5">
      {/* ---- Capture ------------------------------------------------------ */}
      <Panel glow className="p-5">
        <SectionTitle>Capture</SectionTitle>
        <p className="mb-4 text-sm leading-relaxed text-slate-400">
          Photograph a receipt, a scribbled note, or a letter. One button — it works out which it is.
          Notes and letters turn into tasks; a deadline on a letter becomes the due date.
        </p>

        <div className="flex flex-wrap gap-3">
          <Btn
            variant="flame"
            size="lg"
            loading={busy}
            onClick={() => cameraRef.current?.click()}
            className="flex-1 min-w-[180px]"
          >
            <Camera className="h-4 w-4" />
            {busy ? "Reading it…" : "Take a photo"}
          </Btn>
          <Btn size="lg" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            Choose a file
          </Btn>
        </div>

        {/* capture="environment" opens the rear camera straight away on a
            phone. It needs camera=(self) in the Permissions-Policy header —
            without it the browser refuses before showing any prompt. */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />

        {busy && (
          <p className="mt-3 text-xs text-slate-500">
            Handwriting and small print take a few seconds. The photo is already saved.
          </p>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-200">
            {error}
          </div>
        )}
      </Panel>

      {/* ---- History ----------------------------------------------------- */}
      <Panel className="p-5">
        <SectionTitle
          right={
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 transition hover:text-slate-100"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          }
        >
          Captured
        </SectionTitle>

        {loading ? (
          <Spinner label="Loading captures" />
        ) : rows.length === 0 ? (
          <Empty>Nothing captured yet. Point the camera at the pile on the counter.</Empty>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => {
              const meta = KIND_META[r.kind] ?? KIND_META.unknown;
              const Icon = meta.icon;
              const money = fmtMoney(r.total, r.currency);
              const deadline = fmtDate(r.deadline);
              const docDate = fmtDate(r.docDate);
              const failed = r.status === "failed";
              return (
                <li
                  key={r.id}
                  className={`rounded-xl border p-3.5 transition ${
                    justDone === r.id
                      ? "border-[#ff6b35]/40 bg-[#ff6b35]/[0.06]"
                      : "border-white/[0.07] bg-white/[0.02]"
                  }`}
                >
                  <div className="flex gap-3.5">
                    {/* Thumbnail streams through the guarded proxy — the blob
                        store is private, so there is no public url to use. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/navigator/capture/image?id=${encodeURIComponent(r.id)}`}
                      alt={r.title ?? "Capture"}
                      loading="lazy"
                      className="h-16 w-16 flex-shrink-0 rounded-lg border border-white/10 bg-black/30 object-cover"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Pill tone={failed ? "flame" : meta.tone}>
                          <Icon className="h-3 w-3" />
                          {failed ? "Unread" : meta.label}
                        </Pill>
                        {money && <Pill tone="slate">{money}</Pill>}
                        {r.taskIds.length > 0 && (
                          <Pill tone="violet">
                            <ListChecks className="h-3 w-3" />
                            {r.taskIds.length} task{r.taskIds.length === 1 ? "" : "s"}
                          </Pill>
                        )}
                        {deadline && (
                          <Pill tone="amber">
                            <CalendarClock className="h-3 w-3" />
                            {deadline}
                          </Pill>
                        )}
                      </div>

                      <p className="truncate text-sm font-semibold text-slate-100">
                        {r.title ?? "Untitled capture"}
                      </p>
                      {r.summary && (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{r.summary}</p>
                      )}
                      {failed && r.error && (
                        <p className="mt-1 text-[12px] leading-relaxed text-rose-300/80">{r.error}</p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {r.vendor && <span>{r.vendor}</span>}
                        {docDate && <span>· {docDate}</span>}
                        <span>· captured {fmtDate(r.createdAt)}</span>
                      </div>

                      {/* Manual override. The vision pass is good, not
                          infallible, and a misfiled receipt is annoying
                          rather than fatal — one tap fixes it. */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {(["receipt", "note", "document"] as const)
                          .filter((k) => k !== r.kind)
                          .map((k) => (
                            <button
                              key={k}
                              onClick={() => setKind(r.id, k)}
                              className="rounded-lg border border-white/10 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-100"
                            >
                              → {KIND_META[k].label}
                            </button>
                          ))}
                        <button
                          onClick={() => remove(r.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <Trash2 className="h-3 w-3" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
