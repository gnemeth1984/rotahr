"use client";

// Reads the latest Navigator reply out loud.
//
// Two things make this fiddly and are the reason for most of the code below:
//
// 1. iOS only lets an <audio> element play if it was started by a tap. Fetching
//    the speech takes a second or two, by which point the tap no longer counts.
//    The fix is to "unlock" the element synchronously inside the tap with a
//    silent clip, then swap in the real audio once it arrives.
// 2. If the network or the API is down, falling back to the browser's own voice
//    is far better than a dead button — it is worse quality, but it still reads.
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Square, Volume2 } from "lucide-react";
import { ChatMessage } from "./types";

const SILENT_CLIP =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

type Status = "idle" | "loading" | "playing";

export function SpeakButton({ message }: { message: ChatMessage | null }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Re-reading the same reply shouldn't cost another API call or another wait.
  const cacheRef = useRef<Map<string, string>>(new Map());
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    const done = () => setStatus("idle");
    audio.addEventListener("ended", done);
    audio.addEventListener("pause", done);

    return () => {
      audio.removeEventListener("ended", done);
      audio.removeEventListener("pause", done);
      audio.pause();
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setStatus("idle");
  }, []);

  // Whatever was on screen a moment ago is not what the button means now.
  useEffect(() => {
    if (activeIdRef.current && activeIdRef.current !== message?.id) stop();
    activeIdRef.current = message?.id ?? null;
  }, [message?.id, stop]);

  function speakWithBrowserVoice(text: string) {
    const synth = window.speechSynthesis;
    if (!synth) {
      setError("This browser has no voice available.");
      setStatus("idle");
      return;
    }
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(stripMarkup(text));
    utter.rate = 1.02;
    utter.onend = () => setStatus("idle");
    utter.onerror = () => setStatus("idle");
    setStatus("playing");
    synth.speak(utter);
  }

  async function handleClick() {
    if (!message) return;
    if (status === "playing" || status === "loading") {
      stop();
      return;
    }

    setError(null);
    const audio = audioRef.current;

    // Must happen in the tap itself, before any await, or iOS blocks playback.
    let unlocked = false;
    if (audio) {
      try {
        audio.src = SILENT_CLIP;
        await audio.play();
        unlocked = true;
      } catch {
        unlocked = false;
      }
    }

    const cached = cacheRef.current.get(message.id);
    if (cached && audio) {
      void playUrl(audio, cached, message.content);
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/navigator/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });

      if (!res.ok) throw new Error(await readError(res));

      const url = URL.createObjectURL(await res.blob());
      rememberAudio(cacheRef.current, message.id, url);

      if (!audio) {
        speakWithBrowserVoice(message.content);
        return;
      }
      await playUrl(audio, url, message.content, unlocked);
    } catch {
      // Server voice unavailable — the browser's own voice still gets it read.
      speakWithBrowserVoice(message.content);
    }
  }

  async function playUrl(
    audio: HTMLAudioElement,
    url: string,
    fallbackText: string,
    _unlocked = true
  ) {
    try {
      audio.src = url;
      audio.currentTime = 0;
      await audio.play();
      setStatus("playing");
    } catch {
      speakWithBrowserVoice(fallbackText);
    }
  }

  const disabled = !message;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={
          disabled
            ? "Nothing to read out yet"
            : status === "playing"
              ? "Stop reading"
              : "Read the last reply out loud"
        }
        title={disabled ? "Navigator hasn't replied yet" : undefined}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
          status === "playing"
            ? "border-[#ff6b35] bg-[#ff6b35]/10 text-[#ff8f5f]"
            : "border-white/10 text-slate-300 hover:border-[#ff6b35]/40 hover:text-white"
        } disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-white/10 disabled:hover:text-slate-300`}
      >
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : status === "playing" ? (
          <Square className="h-3 w-3 fill-current" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
        {status === "loading" ? "Loading" : status === "playing" ? "Stop" : "Read aloud"}
      </button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </div>
  );
}

/** Keep a few recent clips, not the whole session's audio. */
function rememberAudio(cache: Map<string, string>, id: string, url: string) {
  cache.set(id, url);
  while (cache.size > 4) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    const stale = cache.get(oldest);
    if (stale) URL.revokeObjectURL(stale);
    cache.delete(oldest);
  }
}

async function readError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

/** Light version of the server's cleanup, for the browser-voice fallback. */
function stripMarkup(raw: string) {
  return raw
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .trim();
}
