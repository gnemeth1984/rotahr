"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function getSessionId(): string {
  try {
    const key = "rotahr_sid";
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return "unknown";
  }
}

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const sid = getSessionId();
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        sessionId: sid,
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
