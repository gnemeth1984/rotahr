"use client";

/**
 * Demo interstitial.
 *
 * The demo reset wipes and rebuilds every section in turn and takes about two
 * minutes. Anyone dropped onto the dashboard during that window sees a gutted
 * venue — no shifts today, no bookings, no expenses — which reads as "this
 * product is empty" rather than "the data is rebuilding".
 *
 * This page NO LONGER starts the reset. It used to POST /api/demo/prepare and
 * hold that request open for the whole seed, which meant the first demo visitor
 * after each cooldown window paid ~127 seconds on this screen. At Rotahr's
 * traffic that was most visitors, and the landing page's main "Explore the live
 * demo" CTA led straight here. Resets now run on a schedule instead (vercel.json
 * → /api/demo/reset), so no visitor ever pays for one.
 *
 * What's left: the narrow case where a scheduled reset is genuinely mid-flight
 * when someone logs in. The server component already redirected everyone else
 * before this component shipped, so if you are reading this screen a reset really
 * is running. We poll /api/demo/status and forward the moment it's done.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

const STEPS = [
  "Rebuilding the rota",
  "Restoring bookings and floor plan",
  "Reloading stock, recipes and food costs",
  "Restoring HACCP records",
  "Refreshing the till feed",
];

/** Never trap anyone here — go through anyway after this long. */
const MAX_WAIT_MS = 210_000;

/** Full seed, measured. Used to turn real elapsed time into a progress bar. */
const SEED_MS = 140_000;

export default function DemoPreparingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/rota";

  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);

  // When the reset actually began, per the server. Progress is measured from
  // there, not from page load, so someone arriving 90s into a reset sees ~90s of
  // progress and a short wait instead of a bar that restarts from zero.
  const resetStartedAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const arrivedAt = Date.now();

    const tick = setInterval(() => {
      if (cancelled) return;
      const base = resetStartedAt.current ?? arrivedAt;
      const ms = Date.now() - base;
      setElapsed(ms);
      setStep(Math.min(STEPS.length - 1, Math.floor(ms / (SEED_MS / STEPS.length))));
    }, 500);

    async function run() {
      while (!cancelled) {
        let ready = true; // fail open: never strand a visitor on a status error
        try {
          const res = await fetch("/api/demo/status", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            ready = !!data.ready;
            if (data.startedAt) {
              const t = Date.parse(data.startedAt);
              if (!Number.isNaN(t)) resetStartedAt.current = t;
            }
          }
        } catch {
          // Network blip — treat as still running, the cap below still applies.
          ready = false;
        }
        if (ready) break;
        if (Date.now() - arrivedAt > MAX_WAIT_MS) break;
        await new Promise((r) => setTimeout(r, 2000));
      }

      if (!cancelled) router.replace(next);
    }

    run();
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [next, router]);

  const pct = Math.min(96, Math.round((elapsed / SEED_MS) * 100) + 4);

  return (
    <div className="min-h-screen bg-[#0F1C35] flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <Image
          src="/logo-white-trans.png"
          alt="Rotahr"
          width={150}
          height={56}
          className="mx-auto mb-10 h-12 w-auto"
          priority
        />

        <h1 className="text-2xl font-semibold text-white">Setting up your demo</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          You caught us mid-refresh — we rebuild the demo venue a few times a day
          so it always looks like a real trading week. Nearly there.
        </p>

        <div className="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundImage: "linear-gradient(90deg, #FF6B35, #E8365D)",
            }}
          />
        </div>

        <p className="mt-4 text-sm font-medium text-[#FF6B35]">{STEPS[step]}…</p>

        <p className="mt-10 text-xs text-slate-500">
          Built by a chef who got tired of paper rotas.
        </p>
      </div>
    </div>
  );
}
