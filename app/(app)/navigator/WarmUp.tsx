"use client";

// Guided task initiation — the "starting is the hard part" problem.
//
// Pressing Warm up takes over the screen, reads the start trigger out loud,
// counts down, plays a go tone and drops straight into a focus session. The
// point is to remove every decision between deciding to start and starting:
// no tab to find, no timer to configure, nothing to read.
//
// The iOS constraint from SpeakButton applies here too and is worse: audio must
// be unlocked synchronously inside the tap, and here the tap also opens an
// overlay. So the unlock happens first, before any state change or await.
import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Play, X } from "lucide-react";
import { Btn } from "./nav-ui";
import { api } from "./api";

const SILENT_CLIP =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/** Seconds on the clock. Long enough to settle, short enough not to be an exit. */
const COUNT_FROM = 10;

export type WarmUpTask = {
  id: string;
  title: string;
  startTrigger: string | null;
  effortMins: number | null;
};

/**
 * Rising two-note chime. Generated rather than shipped as a file so there is no
 * asset to load at the exact moment latency would be most annoying.
 */
function playGoTone() {
  try {
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    [
      { f: 660, at: 0 },
      { f: 880, at: 0.13 },
    ].forEach(({ f, at }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.2, now + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.32);
      osc.start(now + at);
      osc.stop(now + at + 0.35);
    });

    window.setTimeout(() => void ctx.close().catch(() => {}), 900);
  } catch {
    // A missing chime is not worth breaking the warm-up over.
  }
}

export function WarmUpButton({
  task,
  focusMins,
  onStarted,
  className = "",
}: {
  task: WarmUpTask;
  focusMins: number;
  onStarted?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audio.pause();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  async function handleOpen() {
    // Unlock before anything else. Any await or setState first and iOS wins.
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.src = SILENT_CLIP;
        await audio.play();
      } catch {
        // Locked anyway — the overlay still works, it just may stay silent.
      }
    }
    setOpen(true);
  }

  return (
    <>
      <Btn size="sm" variant="ghost" onClick={handleOpen} className={className}>
        <Flame className="h-3.5 w-3.5" />
        Warm up
      </Btn>
      {open && (
        <WarmUpOverlay
          task={task}
          focusMins={focusMins}
          audio={audioRef.current}
          onClose={() => setOpen(false)}
          onStarted={onStarted}
        />
      )}
    </>
  );
}

function WarmUpOverlay({
  task,
  focusMins,
  audio,
  onClose,
  onStarted,
}: {
  task: WarmUpTask;
  focusMins: number;
  audio: HTMLAudioElement | null;
  onClose: () => void;
  onStarted?: () => void;
}) {
  const [secs, setSecs] = useState(COUNT_FROM);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);
  const urlRef = useRef<string | null>(null);

  const begin = useCallback(async () => {
    if (firedRef.current) return;
    firedRef.current = true;
    playGoTone();
    setStarting(true);
    try {
      await api("/focus", {
        body: {
          label: task.title,
          taskId: task.id,
          plannedMins: Math.min(120, task.effortMins ?? focusMins),
        },
      });
      onStarted?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the session");
      setStarting(false);
      firedRef.current = false;
    }
  }, [task, focusMins, onStarted, onClose]);

  // Read the trigger aloud once, as the overlay appears.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/navigator/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id }),
        });
        if (!res.ok || cancelled) throw new Error("no server voice");
        const url = URL.createObjectURL(await res.blob());
        urlRef.current = url;
        if (audio && !cancelled) {
          audio.src = url;
          audio.currentTime = 0;
          await audio.play();
        }
      } catch {
        if (cancelled || typeof window === "undefined") return;
        const synth = window.speechSynthesis;
        if (!synth || !task.startTrigger) return;
        const utter = new SpeechSynthesisUtterance(`${task.title}. Start by: ${task.startTrigger}`);
        utter.rate = 1.02;
        synth.speak(utter);
      }
    })();

    return () => {
      cancelled = true;
      audio?.pause();
      window.speechSynthesis?.cancel();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [task.id, task.title, task.startTrigger, audio]);

  // The countdown itself.
  useEffect(() => {
    if (secs <= 0) {
      void begin();
      return;
    }
    const t = window.setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [secs, begin]);

  // Escape is the bail-out. Deliberately the only key that does anything.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pct = ((COUNT_FROM - secs) / COUNT_FROM) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1c35]/95 px-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Task warm-up"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cancel warm-up"
        className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ff6b35]">Starting in</p>

        <div className="mt-3 text-[5.5rem] font-bold leading-none text-white tabular-nums">{secs}</div>

        <div className="mx-auto mt-5 h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ff6b35] to-[#e8365d] transition-[width] duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <h2 className="mt-7 text-lg font-semibold text-white">{task.title}</h2>

        {task.startTrigger && (
          <div className="mx-auto mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Do only this</p>
            <p className="mt-1.5 text-base text-slate-100">{task.startTrigger}</p>
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            {error}
          </p>
        )}

        <div className="mt-7 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
          <Btn variant="flame" size="lg" onClick={() => void begin()} loading={starting} className="w-full sm:w-auto">
            {!starting && <Play className="h-4 w-4" />}
            Start now
          </Btn>
          <Btn variant="ghost" size="lg" onClick={onClose} className="w-full sm:w-auto">
            Not now
          </Btn>
        </div>

        <p className="mt-5 text-xs text-slate-500">
          A {Math.min(120, task.effortMins ?? focusMins)} minute focus session starts automatically.
        </p>
      </div>
    </div>
  );
}
