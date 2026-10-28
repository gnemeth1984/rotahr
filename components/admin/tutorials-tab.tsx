"use client";

/**
 * Admin -> Tutorials tab.
 *
 * Upload short how-to videos that appear on the public /tutorials page.
 *
 * The upload goes browser -> Vercel Blob directly via @vercel/blob/client.
 * It does NOT post the file to our API. Vercel caps a serverless request body
 * at ~4.5MB, so the receipt-upload pattern used elsewhere in this repo would
 * work on a test clip and fail on a real recording. /api/admin/tutorials/upload
 * only mints a scoped token; the bytes never touch a function.
 *
 * Duration is read locally off a throwaway <video> element before uploading,
 * so the public page can show "3:41" without a transcode step.
 */

import { useCallback, useEffect, useRef, useState } from "react";
// Must load before @vercel/blob/client (imported dynamically in handleUpload):
// the blob client captures window.fetch when it first evaluates.
import { setBlobProbe, type BlobProbeEvent } from "@/lib/blob/fetch-probe";
import { TUTORIAL_BLOB_ACCESS, tutorialPlaybackPath } from "@/lib/tutorials/playback";
import {
  Loader2,
  RefreshCw,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Film,
  Pencil,
  Check,
  X,
  ExternalLink,
} from "lucide-react";

interface TutorialRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string;
  posterUrl: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  sortOrder: number;
  published: boolean;
  views: number;
  createdAt: string;
}

// Kept in sync by hand with the API. Route files cannot export consts, so a
// shared constant would need a third module for four strings.
const CATEGORIES = [
  { value: "general", label: "Getting started" },
  { value: "rota", label: "Rota & scheduling" },
  { value: "clock", label: "Clock in & time" },
  { value: "bookings", label: "Bookings & floor plan" },
  { value: "haccp", label: "HACCP & food safety" },
  { value: "crm", label: "CRM & guests" },
  { value: "money", label: "Payroll, tips & bookkeeping" },
  { value: "admin", label: "Setup & admin" },
];

const MAX_BYTES = 500 * 1024 * 1024;

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Pull duration out of the file locally. Resolves null rather than throwing —
 *  a missing duration is cosmetic and must never block an upload. */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      const done = (value: number | null) => {
        URL.revokeObjectURL(url);
        resolve(value);
      };
      video.onloadedmetadata = () =>
        done(Number.isFinite(video.duration) ? video.duration : null);
      video.onerror = () => done(null);
      setTimeout(() => done(null), 8000);
      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

export function TutorialsTab() {
  const [rows, setRows] = useState<TutorialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  // What the upload is doing right now, so a long wait is never a silent 0%.
  const [phase, setPhase] = useState<"prepare" | "upload" | "save">("prepare");
  const [stalled, setStalled] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastProgressAt = useRef(0);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/tutorials");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.tutorials || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function pickFile(f: File | null) {
    setError(null);
    if (!f) {
      setFile(null);
      return;
    }
    if (!f.type.startsWith("video/")) {
      setError("That is not a video file.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(
        `That file is ${fmtSize(f.size)}. The limit is 500 MB — export it at 1080p instead of 4K.`
      );
      return;
    }
    setFile(f);
    // Pre-fill the title from the filename so a video is never nameless.
    if (!title.trim()) {
      setTitle(
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      );
    }
  }

  async function handleUpload() {
    if (!file || !title.trim()) {
      setError("Pick a video file and give it a title.");
      return;
    }
    setUploading(true);
    setProgress(0);
    setPhase("prepare");
    setStalled(false);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    let blockedReason: string | null = null;

    // The blob client treats a blocked request as a network error and retries
    // it ~10 times with backoff (~17 min) with the bar stuck at 0%. If the
    // browser's CSP is what blocked it (e.g. a tab opened before a CSP change),
    // say so straight away instead of letting it spin.
    const onCsp = (e: SecurityPolicyViolationEvent) => {
      if (e.violatedDirective.startsWith("connect-src") && /vercel/.test(e.blockedURI)) {
        blockedReason =
          "Your browser blocked the upload to Vercel Blob. This page is probably an old version — reload it (Cmd/Ctrl+Shift+R) and try again.";
        controller.abort();
      }
    };
    document.addEventListener("securitypolicyviolation", onCsp);

    // Record every request to Vercel Blob (and our token route). The blob
    // client silently retries network errors / 5xx for ~17 minutes, so stop
    // after 3 failures in a row and say what actually happened.
    const startedAt = Date.now();
    const events: BlobProbeEvent[] = [];
    let lastProgress = 0;
    let netFails = 0;
    let serverFails = 0;
    const sent = new Set<string>();
    const sendDiag = (outcome: string, message: string) => {
      if (sent.has(outcome)) return;
      sent.add(outcome);
      void fetch("/api/admin/tutorials/upload-diag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcome,
          message,
          fileSize: file.size,
          fileType: file.type,
          seconds: Math.round((Date.now() - startedAt) / 1000),
          progress: lastProgress,
          events: events.slice(-60),
        }),
      }).catch(() => {});
    };
    setBlobProbe((ev) => {
      events.push(ev);
      if (ev.error) {
        if (/AbortError/.test(ev.error)) return;
        netFails++;
      } else if (ev.status !== undefined && ev.status >= 500) {
        serverFails++;
      } else if (ev.status !== undefined && ev.status < 400) {
        netFails = 0;
        serverFails = 0;
      }
      if (blockedReason) return;
      if (netFails >= 3) {
        blockedReason =
          ev.kind === "token"
            ? `Can't reach Rotahr's upload service (${ev.error}). Check your connection and try again.`
            : `The upload to Vercel Blob (vercel.com) keeps failing in the browser: ${ev.error}. ` +
              "This is usually a VPN, an ad-blocker or privacy extension, antivirus web shield / HTTPS scanning, " +
              "or a company network. Try a private window with extensions off, another browser, or another network (e.g. a phone hotspot).";
        controller.abort();
      } else if (serverFails >= 3) {
        blockedReason = `Vercel Blob keeps answering HTTP ${ev.status}. It's on their side, try again in a few minutes.`;
        controller.abort();
      }
    });

    // No progress for a minute = something is wrong; offer Cancel.
    lastProgressAt.current = Date.now();
    const watchdog = window.setInterval(() => {
      const isStalled = Date.now() - lastProgressAt.current > 60_000;
      setStalled(isStalled);
      if (isStalled) sendDiag("stalled", "No progress for 60s");
    }, 5_000);

    try {
      const durationSeconds = await readDuration(file);

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      setPhase("upload");
      lastProgressAt.current = Date.now();
      const { upload } = await import("@vercel/blob/client");
      const blob = await upload(`tutorials/${safeName}`, file, {
        // Must match the store: Rotahr's Blob store is private. Asking for
        // "public" on a private store is rejected by Vercel, and the browser
        // usually sees that as a network error, so it looked like a hang.
        access: TUTORIAL_BLOB_ACCESS,
        handleUploadUrl: "/api/admin/tutorials/upload",
        // Splits the file and retries failed parts. Without this a dropped
        // connection at 90% restarts the whole upload.
        multipart: true,
        abortSignal: controller.signal,
        onUploadProgress: (p) => {
          lastProgressAt.current = Date.now();
          setStalled(false);
          lastProgress = Math.round(p.percentage);
          setProgress(lastProgress);
        },
      });
      setPhase("save");

      const res = await fetch("/api/admin/tutorials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          videoUrl: blob.url,
          durationSeconds,
          fileSizeBytes: file.size,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setFile(null);
      setTitle("");
      setDescription("");
      setCategory("general");
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (err) {
      const message = blockedReason
        ? blockedReason
        : controller.signal.aborted
          ? "Upload cancelled."
          : err instanceof Error
            ? err.message
            : "Upload failed";
      setError(message);
      sendDiag(blockedReason ? "blocked" : controller.signal.aborted ? "cancelled" : "error", message);
    } finally {
      setBlobProbe(null);
      document.removeEventListener("securitypolicyviolation", onCsp);
      window.clearInterval(watchdog);
      abortRef.current = null;
      setUploading(false);
      setStalled(false);
      setProgress(0);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/tutorials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: TutorialRow) {
    if (
      !confirm(
        `Delete "${row.title}"? This removes the video file too and cannot be undone.`
      )
    )
      return;
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/tutorials?id=${row.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(row: TutorialRow) {
    setEditingId(row.id);
    setEditTitle(row.title);
    setEditDescription(row.description);
    setEditCategory(row.category);
  }

  const publishedCount = rows.filter((r) => r.published).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tutorial videos</h2>
          <p className="text-sm text-slate-500">
            {publishedCount} live on{" "}
            <a
              href="/tutorials"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline hover:text-slate-700"
            >
              /tutorials <ExternalLink className="h-3 w-3" />
            </a>
            {rows.length > publishedCount
              ? ` · ${rows.length - publishedCount} draft${rows.length - publishedCount === 1 ? "" : "s"}`
              : ""}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Upload card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Upload className="h-4 w-4" /> Upload a new video
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Video file (MP4, MOV or WebM, up to 500 MB)
            </label>
            <input
              ref={fileInput}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
              disabled={uploading}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            {file && (
              <p className="mt-1.5 text-xs text-slate-500">
                {file.name} · {fmtSize(file.size)}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Building your first rota"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={uploading}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Description (one or two lines, shown under the title)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={uploading}
              rows={2}
              placeholder="Add your staff, drop shifts onto the week, publish. About three minutes."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500" data-testid="tutorial-upload-status">
              {phase === "prepare"
                ? "Preparing…"
                : phase === "save"
                  ? "Uploaded — saving…"
                  : `Uploading ${progress}% of ${file ? fmtSize(file.size) : "the file"} — keep this tab open until it finishes.`}
            </p>
            {stalled && (
              <p className="mt-1 text-xs text-amber-700" data-testid="tutorial-upload-stalled">
                No progress for over a minute. Check your connection, or cancel, reload the page and try again.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading || !file || !title.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Upload
              </>
            )}
          </button>
          {uploading && (
            <button
              onClick={() => abortRef.current?.abort()}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              data-testid="tutorial-upload-cancel"
            >
              Cancel
            </button>
          )}
          <p className="text-xs text-slate-400">
            Uploads as a draft. Hit the eye icon to put it live.
          </p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
          <Film className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">No videos yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={row.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <video
                  src={tutorialPlaybackPath(row)}
                  poster={row.posterUrl || undefined}
                  controls
                  preload="metadata"
                  className="w-full shrink-0 rounded-lg bg-black sm:w-64"
                />

                <div className="min-w-0 flex-1">
                  {editingId === row.id ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-slate-400"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            await patch(row.id, {
                              title: editTitle,
                              description: editDescription,
                              category: editCategory,
                            });
                            setEditingId(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          <Check className="h-3.5 w-3.5" /> Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                        >
                          <X className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-slate-900">{row.title}</h4>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.published
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {row.published ? "Live" : "Draft"}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {CATEGORIES.find((c) => c.value === row.category)?.label ||
                            row.category}
                        </span>
                      </div>
                      {row.description && (
                        <p className="mt-1 text-sm text-slate-600">{row.description}</p>
                      )}
                      <p className="mt-2 text-xs text-slate-400">
                        {[fmtDuration(row.durationSeconds), fmtSize(row.fileSizeBytes), `${row.views} views`]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          onClick={() => patch(row.id, { published: !row.published })}
                          disabled={busyId === row.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                        >
                          {row.published ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" /> Unpublish
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" /> Publish
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => patch(row.id, { move: "up" })}
                          disabled={i === 0 || busyId === row.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => patch(row.id, { move: "down" })}
                          disabled={i === rows.length - 1 || busyId === row.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => remove(row)}
                          disabled={busyId === row.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
