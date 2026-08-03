"use client";

/**
 * Demo interstitial.
 *
 * The demo reset wipes and rebuilds every section in turn and takes about two
 * minutes. Anyone dropped straight onto the dashboard during that window sees a
 * gutted venue — no shifts today, no bookings, no expenses — which reads as "this
 * product is empty" rather than "the data is rebuilding". So demo logins land
 * here first and only continue once the rebuild has finished.
 *
 * This page also *drives* the reset: it POSTs /api/demo/prepare and keeps that
 * request open for the life of the seed. The login request can't do that job —
 * Vercel freezes a function the moment it responds, so a seed started there is
 * killed a few seconds in. If /api/demo/prepare reports the data is already
 * fresh, or another visitor's run is in flight, we fall through to polling
 * /api/demo/status and forward as soon as it's ready.
 */

import { useEffect, useState } from "react";
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

export default function DemoPreparingClient() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [elapsed, setElapsed] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const tick = setInterval(() => {
      if (cancelled) return;
      const ms = Date.now() - startedAt;
      setElapsed(ms);
      setStep(Math.min(STEPS.length - 1, Math.floor(ms / 30_000)));
    }, 500);

    async function run() {
      // Hold this request open for the whole seed. Resolves immediately when no
      // reset is due, or when someone else already owns the run.
      let outcome: string | null = null;
      try {
        const res = await fetch("/api/demo/prepare", {
          method: "POST",
          cache: "no-store",
        });
        if (res.ok) outcome = (await res.json()).outcome ?? null;
      } catch {
        // Connection dropped (or the function timed out) — fall through to polling.
      }
      if (cancelled) return;

      if (outcome !== "ran") {
        // Either nothing to do, or another instance is mid-seed. Wait it out.
        while (!cancelled) {
          try {
            const res = await fetch("/api/demo/status", { cache: "no-store" });
            if (res.ok) {
              const { ready } = await res.json();
              if (ready) break;
            }
          } catch {
            // Network blip — keep waiting, the cap below still applies.
          }
          if (Date.now() - startedAt > MAX_WAIT_MS) break;
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      if (!cancelled) router.replace(next);
    }

    run();
    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [next, router]);

  const pct = Math.min(96, Math.round((elapsed / 140_000) * 100) + 4);

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
          We wipe and rebuild the demo venue so you always get a fresh, fully
          populated business. Takes about two minutes.
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
