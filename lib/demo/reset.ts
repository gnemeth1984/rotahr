// @ts-nocheck
/**
 * lib/demo/reset.ts
 *
 * Triggers a background reset of all demo data for "The Anchor & Tap".
 * Called on every demo account login so visitors always start from a clean slate.
 *
 * Uses child_process.spawn (detached, unref) so the auth callback returns
 * immediately — the seed runs in the background after login completes.
 */

import { spawn } from "child_process";
import path from "path";

// Prevent concurrent resets — one reset at a time is enough
let resetInProgress = false;
let lastResetAt = 0;
const COOLDOWN_MS = 30_000; // 30s minimum between resets

export function isDemoEmail(email: string): boolean {
  return email.endsWith("@rotahr.demo");
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

  const scriptPath = path.resolve(process.cwd(), "scripts/seed-demo.ts");

  const child = spawn(
    "npx",
    ["tsx", scriptPath],
    {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
      cwd: process.cwd(),
    }
  );

  child.unref(); // Don't block Node process

  console.log(`[demo-reset] Background reset started (PID ${child.pid})`);

  // Mark as done after a generous timeout (seed takes ~5-10s)
  setTimeout(() => {
    resetInProgress = false;
    console.log("[demo-reset] Reset window cleared");
  }, 60_000);
}
