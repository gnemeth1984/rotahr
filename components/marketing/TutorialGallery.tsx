"use client";

/**
 * Public tutorial player for /tutorials.
 *
 * One player plus a plain list, rather than a grid of thumbnails, because we
 * deliberately do not upload poster images — a grid of black rectangles is a
 * worse first impression than a list of clear titles.
 *
 * Everything here works logged out. No session, no fetch on mount: the rows
 * are server-rendered into props so the page is useful even if JS is slow.
 *
 * The video files are public Vercel Blob URLs. `media-src` in the CSP
 * (next.config.mjs) has to allow *.public.blob.vercel-storage.com or the
 * browser blocks playback with no visible error — default-src does NOT cover
 * <video>, and img-src does not extend to it.
 */

import { useCallback, useRef, useState } from "react";
import { Play, Clock } from "lucide-react";

export interface TutorialItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  videoUrl: string;
  posterUrl: string | null;
  durationSeconds: number | null;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds < 1) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TutorialGallery({ items }: { items: TutorialItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const counted = useRef<Set<string>>(new Set());

  const active = items[activeIndex];

  // Count a view once per video per page load, on first play. Fire and forget:
  // a failed counter must never interrupt playback.
  const countView = useCallback((slug: string) => {
    if (counted.current.has(slug)) return;
    counted.current.add(slug);
    fetch("/api/tutorials/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  function select(i: number) {
    setActiveIndex(i);
    // Let React swap the src before asking it to play, otherwise Safari plays
    // the previous file for a frame.
    requestAnimationFrame(() => {
      const el = videoRef.current;
      if (!el) return;
      el.load();
      el.play().catch(() => {});
    });
  }

  if (!active) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      {/* Player */}
      <div>
        <div className="overflow-hidden rounded-2xl bg-black shadow-sm">
          <video
            ref={videoRef}
            key={active.id}
            src={active.videoUrl}
            poster={active.posterUrl || undefined}
            controls
            playsInline
            preload="metadata"
            onPlay={() => countView(active.slug)}
            className="aspect-video w-full"
          >
            Your browser cannot play this video.{" "}
            <a href={active.videoUrl}>Download it instead</a>.
          </video>
        </div>
        <h2 id={active.slug} className="mt-5 text-2xl font-bold text-slate-900">
          {active.title}
        </h2>
        {active.description && (
          <p className="mt-2 text-slate-600">{active.description}</p>
        )}
      </div>

      {/* Playlist */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          All videos ({items.length})
        </p>
        <ol className="space-y-1.5">
          {items.map((item, i) => {
            const isActive = i === activeIndex;
            return (
              <li key={item.id}>
                <button
                  onClick={() => select(i)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors ${
                    isActive
                      ? "bg-orange-50 ring-1 ring-orange-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isActive
                        ? "bg-orange-500 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {isActive ? <Play className="h-3 w-3 fill-current" /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-semibold ${
                        isActive ? "text-orange-900" : "text-slate-800"
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.durationSeconds ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="h-3 w-3" /> {fmtDuration(item.durationSeconds)}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
