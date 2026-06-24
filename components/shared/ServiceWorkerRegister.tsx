"use client";

import { useEffect } from "react";

// Only registers the service worker — does NOT auto-request permission.
// Push subscription is handled explicitly by PushSubscribeButton in Settings.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed", err);
    });
  }, []);

  return null;
}
