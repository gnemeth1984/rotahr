"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      if (Notification.permission === "denied") {
        setBlocked(true);
      }
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      });
    }
  }, []);

  if (!mounted) return null;

  if (!supported) {
    return (
      <p className="text-xs text-slate-400">Push notifications are not supported in this browser.</p>
    );
  }

  async function subscribe() {
    setLoading(true);
    try {
      // Must request permission first
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
    } catch (err) {
      console.error("Push subscribe error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      await fetch("/api/push-subscription", { method: "DELETE" });
      setSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (blocked) {
    return (
      <p className="text-xs text-amber-600">
        Notifications are blocked in your browser. Click the lock icon in the address bar and allow notifications, then refresh.
      </p>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={subscribed ? unsubscribe : subscribe}
      disabled={loading}
      className="gap-2"
    >
      {subscribed ? (
        <>
          <BellOff className="h-4 w-4" />
          Disable push notifications
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" />
          Enable push notifications
        </>
      )}
    </Button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
