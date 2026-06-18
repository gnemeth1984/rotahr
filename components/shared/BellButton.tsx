"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function BellButton() {
  const [count, setCount] = useState(0);
  const router = useRouter();

  const fetchCount = async () => {
    try {
      const res = await fetch("/api/app-notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 15_000); // poll every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={() => router.push("/notifications")}
      className={cn(
        "relative flex items-center justify-center w-9 h-9 rounded-lg",
        "text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
      )}
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full leading-none">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
