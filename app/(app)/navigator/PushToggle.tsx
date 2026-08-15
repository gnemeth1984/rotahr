"use client";

// The enable-push control lives here, next to the nudge rules, because that is
// where the intent is formed. It used to exist only as an unlabelled switch on
// Settings -> General, which meant a user could tick every nudge in Navigator,
// save, and still never get a phone notification — with nothing on screen
// explaining why. Permission is per-device, so this also states which device it
// is talking about.
import { useCallback, useEffect, useState } from "react";

type State = "loading" | "unsupported" | "blocked" | "off" | "on";

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setError("Push keys are missing on the server.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      // An existing subscription from an older key would be silently
      // undeliverable, so reuse only what the browser already has for this key.
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const res = await fetch("/api/push-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setState("on");
    } catch {
      setError("Could not turn push on. Reload the page and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push-subscription", { method: "DELETE" });
      setState("off");
    } catch {
      setError("Could not turn push off.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">Push to this device</p>
          <p className="text-xs text-slate-400">{describe(state)}</p>
        </div>

        {state === "off" && (
          <button
            type="button"
            onClick={enable}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-[#ff6b35] to-[#e8365d] px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Turning on..." : "Turn on"}
          </button>
        )}

        {state === "on" && (
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-white/30 hover:text-white disabled:opacity-50"
          >
            {busy ? "Turning off..." : "Turn off"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-[#e8365d]">{error}</p>}
    </div>
  );
}

function describe(state: State) {
  switch (state) {
    case "loading":
      return "Checking...";
    case "unsupported":
      return "This browser cannot do push. The bell inside Rotahr still works.";
    case "blocked":
      return "Blocked in your browser settings. Open the padlock in the address bar, allow notifications, then reload.";
    case "off":
      return "Off — nudges will only appear in the Rotahr bell, not on your lock screen.";
    case "on":
      return "On. Turn it on separately on every device you want nudges on.";
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
