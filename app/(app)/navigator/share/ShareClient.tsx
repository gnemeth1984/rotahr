"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Receipt,
  StickyNote,
  FileText,
  HelpCircle,
  CalendarClock,
  ListChecks,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Panel, Btn, Pill, Spinner } from "../nav-ui";

type Capture = {
  id: string;
  kind: "receipt" | "note" | "document" | "unknown";
  status: string;
  title: string | null;
  summary: string | null;
  vendor: string | null;
  total: number | null;
  currency: string | null;
  deadline: string | null;
  taskIds: string[];
  error: string | null;
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

const ERRORS: Record<string, string> = {
  unreadable: "That share arrived in a form I could not read. Try sharing it again.",
  toobig: "That image is over 12MB. Share it again — the camera roll version will compress.",
  noblob: "Blob storage is not configured, so the photo could not be saved.",
  empty: "That share had nothing in it — no image, no link, no text.",
};

function fmtMoney(total: number | null, currency: string | null): string | null {
  if (total == null) return null;
  const sym = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
  return `${sym}${total.toFixed(2)}`;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}

export function ShareClient({
  captureId,
  taskId,
  error,
}: {
  captureId: string | null;
  taskId: string | null;
  error: string | null;
}) {
  const [capture, setCapture] = useState<Capture | null>(null);
  const [reading, setReading] = useState(false);
  const [readErr, setReadErr] = useState<string | null>(null);
  const [tasksCreated, setTasksCreated] = useState(0);
  // A share-sheet navigation can re-run effects on remount; the read is not
  // free (a vision call, and it recreates tasks) so fire it exactly once.
  const fired = useRef(false);

  const read = useCallback(async (id: string) => {
    setReading(true);
    setReadErr(null);
    try {
      const res = await fetch("/api/navigator/capture/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not read that photo");
      setCapture(data.capture ?? null);
      setTasksCreated(data.tasksCreated ?? 0);
      if (data.readFailed) setReadErr(data.error ?? "Could not read that photo");
    } catch (e) {
      setReadErr(e instanceof Error ? e.message : "Could not read that photo");
    } finally {
      setReading(false);
    }
  }, []);

  useEffect(() => {
    if (!captureId || fired.current) return;
    fired.current = true;
    read(captureId);
  }, [captureId, read]);

  // ---- A shared link or text became a task ------------------------------
  if (taskId) {
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
          <div>
            <h2 className="font-bold text-white">Saved as a task</h2>
            <p className="mt-1 text-sm text-slate-400">
              No image in that share, so it went to your task list rather than the reader.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/navigator?tab=tasks">
                <Btn size="sm">
                  Open Tasks <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Btn>
              </Link>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  // ---- The share itself failed before anything was stored ---------------
  if (error || (!captureId && !taskId)) {
    return (
      <Panel>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
          <div>
            <h2 className="font-bold text-white">That share did not land</h2>
            <p className="mt-1 text-sm text-slate-400">
              {(error && (ERRORS[error] ?? error)) ??
                "Open Navigator and use the Capture tab instead."}
            </p>
            <div className="mt-4">
              <Link href="/navigator?tab=capture">
                <Btn size="sm" variant="quiet">
                  Open Capture <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Btn>
              </Link>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  const meta = KIND_META[capture?.kind ?? "unknown"];
  const Icon = meta.icon;
  const money = fmtMoney(capture?.total ?? null, capture?.currency ?? null);
  const deadline = fmtDate(capture?.deadline ?? null);

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-4 sm:flex-row">
          {captureId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/navigator/capture/image?id=${captureId}`}
              alt="Shared capture"
              className="h-40 w-full flex-shrink-0 rounded-xl border border-white/10 object-cover sm:w-32"
            />
          )}
          <div className="min-w-0 flex-1">
            {reading ? (
              <>
                <Spinner label="Reading it…" />
                <p className="mt-2 text-xs text-slate-500">
                  The photo is already saved. This part can take 20 seconds on a dark or
                  handwritten page — you can leave this screen, it will not be lost.
                </p>
              </>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={meta.tone}>
                    <Icon className="mr-1 inline h-3 w-3" />
                    {meta.label}
                  </Pill>
                  {money && <Pill tone="green">{money}</Pill>}
                  {deadline && (
                    <Pill tone="flame">
                      <CalendarClock className="mr-1 inline h-3 w-3" />
                      {deadline}
                    </Pill>
                  )}
                  {tasksCreated > 0 && (
                    <Pill tone="amber">
                      <ListChecks className="mr-1 inline h-3 w-3" />
                      {tasksCreated} task{tasksCreated === 1 ? "" : "s"}
                    </Pill>
                  )}
                </div>

                <h2 className="mt-3 font-bold text-white">
                  {capture?.title ?? "Saved, not yet read"}
                </h2>
                {capture?.vendor && (
                  <p className="text-sm text-slate-400">{capture.vendor}</p>
                )}
                {capture?.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{capture.summary}</p>
                )}

                {readErr && (
                  <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {readErr} The photo is saved either way.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {captureId && (readErr || capture?.status !== "done") && (
                    <Btn size="sm" variant="quiet" onClick={() => read(captureId)}>
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      Try reading again
                    </Btn>
                  )}
                  <Link href="/navigator?tab=capture">
                    <Btn size="sm">
                      All captures <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Btn>
                  </Link>
                  {tasksCreated > 0 && (
                    <Link href="/navigator?tab=tasks">
                      <Btn size="sm" variant="quiet">
                        See the {tasksCreated === 1 ? "task" : "tasks"}
                      </Btn>
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
