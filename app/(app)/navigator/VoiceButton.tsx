"use client";

// The other half of the voice loop: talk to Navigator, hear it answer.
//
// This component owns the whole round trip — record, transcribe, send, speak —
// for one reason: iOS only allows audio playback from an element that a user
// gesture has already touched. The mic tap is that gesture, so the <audio>
// element is unlocked inside the tap and the reply plays through the same
// element several seconds later. Split across two components, the reply would
// be silently blocked on his phone.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { ChatMessage } from "./types";

const SILENT_CLIP =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

// Long enough for a rambling thought dump, short enough that a recorder left
// running by accident can't upload the whole afternoon.
const MAX_MS = 90_000;

type Phase = "idle" | "recording" | "thinking" | "speaking";

/**
 * Pick a container the browser will actually produce.
 *
 * Chrome and Android give webm/opus; iOS Safari only does mp4/aac and returns
 * false for every webm probe. Guessing wrong here produces a 0-byte blob and a
 * button that looks like it worked, so ask rather than assume.
 */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

export function VoiceButton({
  onTranscript,
  disabled = false,
  className = "",
}: {
  /** Sends the transcript through the normal chat path. Returns the reply. */
  onTranscript: (text: string) => Promise<ChatMessage | null>;
  disabled?: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  // Shown only after a failure. A dead mic button is impossible to diagnose
  // from a phone over text — this line puts the actual cause on screen.
  const [diag, setDiag] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set when the user cancels mid-flight, so a late transcript is dropped
  // instead of being sent after they backed out.
  const abandonedRef = useRef(false);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
    setSeconds(0);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const done = () => setPhase((p) => (p === "speaking" ? "idle" : p));
    audio.addEventListener("ended", done);
    audio.addEventListener("error", done);

    return () => {
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", done);
      audio.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      abandonedRef.current = true;
      releaseMic();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, [releaseMic]);

  async function start() {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't record audio.");
      return;
    }

    // Unlock playback inside the tap, before any await. Everything after this
    // point is too late to count as a user gesture on iOS.
    //
    // Deliberately NOT awaited. On some Android builds play() on a zero-length
    // data URI settles very late or not at all, and awaiting it meant
    // getUserMedia was never reached — the button looked completely dead with
    // no error and no permission prompt. Calling play() synchronously inside
    // the tap is what iOS needs; waiting for it is not.
    const audio = audioRef.current;
    if (audio) {
      try {
        audio.src = SILENT_CLIP;
        const played = audio.play();
        if (played && typeof played.then === "function") {
          played.then(() => audio.pause()).catch(() => {});
        }
      } catch {
        // Not fatal — the browser-voice fallback still works.
      }
    }

    // Android (and desktop Chrome) will tell us up front if the user or the OS
    // already said no. Without this the only symptom is an instant, silent
    // NotAllowedError that reads like a broken button.
    let permState = "unknown";
    try {
      const status = await navigator.permissions?.query?.({
        name: "microphone" as PermissionName,
      });
      if (status) permState = status.state;
    } catch {
      // Safari doesn't expose the microphone descriptor. Not an error.
    }

    if (permState === "denied") {
      setError(
        "Your browser is blocking the microphone for rotahr.com. Tap the padlock in the address bar → Permissions → Microphone → Allow. If it's already allowed there, check Android Settings → Apps → Chrome (or Rotahr) → Permissions → Microphone."
      );
      setDiag(envLine(permState, "permission-denied"));
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "unknown";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone blocked. Allow mic access for rotahr.com (padlock in the address bar → Permissions), and check Android Settings → Apps → Chrome (or Rotahr) → Permissions → Microphone is on."
          : name === "NotFoundError"
            ? "No microphone found on this device."
            : name === "NotReadableError" || name === "AbortError"
              ? "Another app is holding the microphone. Close it and try again."
              : `Couldn't start the microphone (${name}).`
      );
      setDiag(envLine(permState, name));
      return;
    }

    streamRef.current = stream;
    abandonedRef.current = false;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      releaseMic();
      setError("This browser can't record in a format we can read.");
      return;
    }

    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      releaseMic();
      if (abandonedRef.current) {
        setPhase("idle");
        return;
      }
      void handleRecording(blob);
    };

    recorder.start();
    setPhase("recording");

    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    autoStopRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, MAX_MS);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      setPhase("thinking");
      recorderRef.current.stop();
    } else {
      releaseMic();
      setPhase("idle");
    }
  }

  async function handleRecording(blob: Blob) {
    // Anything this small is a mis-tap, not speech. Sending it wastes a call
    // and comes back as confident nonsense.
    if (blob.size < 1200) {
      setPhase("idle");
      setError("That was too short — hold on a moment longer.");
      return;
    }

    setPhase("thinking");
    try {
      const form = new FormData();
      form.append("audio", blob, "speech");

      const res = await fetch("/api/navigator/listen", { method: "POST", body: form });
      const data = (await res.json().catch(() => null)) as { text?: string; error?: string } | null;
      if (!res.ok || !data?.text) {
        throw new Error(data?.error ?? `Transcription failed (${res.status})`);
      }
      if (abandonedRef.current) {
        setPhase("idle");
        return;
      }

      const reply = await onTranscript(data.text);
      if (!reply || abandonedRef.current) {
        setPhase("idle");
        return;
      }
      await speak(reply);
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Voice input failed.");
    }
  }

  async function speak(message: ChatMessage) {
    const audio = audioRef.current;
    try {
      const res = await fetch("/api/navigator/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
      if (!res.ok) throw new Error("speak failed");

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(await res.blob());
      objectUrlRef.current = url;

      if (!audio) throw new Error("no audio element");
      audio.src = url;
      audio.currentTime = 0;
      await audio.play();
      setPhase("speaking");
    } catch {
      // Server voice unavailable, or playback refused — the browser's own voice
      // is worse but still answers out loud, which is the point of the feature.
      const synth = typeof window === "undefined" ? null : window.speechSynthesis;
      if (!synth) {
        setPhase("idle");
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(message.content);
      utter.rate = 1.02;
      utter.onend = () => setPhase("idle");
      utter.onerror = () => setPhase("idle");
      setPhase("speaking");
      synth.speak(utter);
    }
  }

  function stopSpeaking() {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setPhase("idle");
  }

  function handleClick() {
    if (phase === "recording") return stopRecording();
    if (phase === "speaking") return stopSpeaking();
    if (phase === "thinking") {
      // Bail out of a request already in flight rather than making them wait.
      abandonedRef.current = true;
      setPhase("idle");
      return;
    }
    void start();
  }

  const label =
    phase === "recording"
      ? `Stop & send${seconds ? ` · ${formatClock(seconds)}` : ""}`
      : phase === "thinking"
        ? "Working…"
        : phase === "speaking"
          ? "Stop"
          : "Hold a thought — speak it";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled && phase === "idle"}
        aria-label={phase === "recording" ? "Stop recording and send" : "Speak to Navigator"}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition sm:w-auto sm:py-2 ${
          phase === "recording"
            ? "border-rose-400/60 bg-rose-500/15 text-rose-200"
            : phase === "speaking"
              ? "border-[#ff6b35] bg-[#ff6b35]/10 text-[#ff8f5f]"
              : "border-white/10 text-slate-300 hover:border-[#ff6b35]/40 hover:text-white"
        } disabled:cursor-not-allowed disabled:opacity-35`}
      >
        {phase === "thinking" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : phase === "recording" ? (
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute h-4 w-4 animate-ping rounded-full bg-rose-400/40" />
            <Mic className="h-4 w-4" />
          </span>
        ) : phase === "speaking" ? (
          <Square className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {label}
      </button>
      {error && <p className="mt-1.5 text-xs text-rose-300">{error}</p>}
      {diag && <p className="mt-1 text-[11px] leading-snug text-slate-500">{diag}</p>}
    </div>
  );
}

/**
 * One line of environment truth, shown under an error only.
 *
 * A mic that does nothing is undiagnosable over text from a phone, so put the
 * facts on screen: secure context, recorder support, permission state, and the
 * exact DOMException name.
 */
function envLine(permission: string, err: string) {
  const parts = [
    `secure=${typeof window !== "undefined" && window.isSecureContext ? "yes" : "NO"}`,
    `installed=${
      typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches
        ? "yes"
        : "no"
    }`,
    `recorder=${typeof MediaRecorder === "undefined" ? "missing" : pickMimeType() || "no-format"}`,
    `mic=${permission}`,
    `err=${err}`,
  ];
  return parts.join(" · ");
}

function formatClock(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m ? `${m}:${String(s).padStart(2, "0")}` : `0:${String(s).padStart(2, "0")}`;
}
