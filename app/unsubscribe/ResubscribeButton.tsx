"use client";

import { useState } from "react";

export function ResubscribeButton({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  if (state === "done") {
    return (
      <p className="text-sm text-white/70">
        Put back on the list. You can unsubscribe again any time from the link in any email.
      </p>
    );
  }

  return (
    <div>
      <button
        onClick={async () => {
          setState("loading");
          try {
            const res = await fetch("/api/unsubscribe/undo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            setState(res.ok ? "done" : "error");
          } catch {
            setState("error");
          }
        }}
        disabled={state === "loading"}
        className="text-sm font-medium rounded-lg px-4 py-2 bg-gradient-to-r from-[#FF6B35] to-[#E8365D] text-white disabled:opacity-60"
      >
        {state === "loading" ? "Undoing…" : "Undo — keep me subscribed"}
      </button>
      {state === "error" && (
        <p className="text-xs text-white/50 mt-2">
          That didn&apos;t work. Email privacy@rotahr.com and we&apos;ll sort it.
        </p>
      )}
    </div>
  );
}
