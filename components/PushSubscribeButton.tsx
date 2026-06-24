"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function PushSubscribeButton() {
  const [mounted, setMounted] = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setSupported(true);
      if (Notification.permission === "denied") setBlocked(true);
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }
  }, []);

  if (!mounted) return null;

  if (!supported) {
    return <p className="text-xs text-slate-400">Not supported in this browser.</p>;
  }

  if (blocked) {
    return (
      <p className="text-xs text-amber-600">
        Notifications are blocked. Click the lock icon in the address bar to allow them, then refresh.
      </p>
    );
  }

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      if (subscribed) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
        await fetch("/api/push-subscription", { method: "DELETE" });
        setSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          alert("Notifications blocked. Please allow them in your browser settings.");
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
          ),
        });
        await fetch("/api/push-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        setSubscribed(true);
      }
    } catch (err) {
      console.error("Push toggle error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Switch
      checked={subscribed}
      onCheckedChange={toggle}
      disabled={loading}
      aria-label="Toggle push notifications"
    />
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
