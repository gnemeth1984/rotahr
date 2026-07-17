// @ts-nocheck
/**
 * lib/demo/reset.ts
 *
 * Triggers a background reset of all demo data for "The Anchor & Tap".
 * Called on every demo account login so visitors always start from a clean slate.
 *
 * Runs in-process (direct import) — no spawn/npx, works on Vercel serverless.
 */

import { seedDemo } from "@/scripts/seed-demo";

// Prevent concurrent resets — one reset at a time is enough
let resetInProgress = false;
let lastResetAt = 0;
const COOLDOWN_MS = 30_000; // 30s minimum between resets

export function isDemoEmail(email: string): boolean {
  return email.endsWith("@rotahr.demo");
}

// Any business seeded by the demo scripts uses a "demo-" prefixed id (see
// scripts/seed-demo.ts) — use this alongside isDemoEmail to catch every case
// (session email OR business id) before sending anything to a real inbox.
export function isDemoBusinessId(businessId: string | null | undefined): boolean {
  return !!businessId && businessId.startsWith("demo-");
}

export function triggerDemoReset(): void {
  const now = Date.now();

  // Skip if a reset just happened or is running
  if (resetInProgress || now - lastResetAt < COOLDOWN_MS) {
    console.log("[demo-reset] Skipped — cooldown or already running");
    return;
  }

  resetInProgress = true;
  lastResetAt = now;

  console.log("[demo-reset] In-process reset started");

  // Fire and forget — don't await, let auth callback return immediately
  seedDemo()
    .then(() => {
      console.log("[demo-reset] Reset complete");
    })
    .catch((err) => {
      console.error("[demo-reset] Reset failed:", err);
    })
    .finally(() => {
      resetInProgress = false;
    });
}
