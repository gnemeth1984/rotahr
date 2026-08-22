// @ts-nocheck
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getDemoResetState } from "@/lib/demo/reset";
import DemoPreparingClient from "./DemoPreparingClient";

/**
 * The interstitial reads `?next=` with useSearchParams, so it cannot be
 * prerendered. Keep it out of the static export and give it a Suspense
 * boundary — without one `next build` fails on this route.
 *
 * This page used to *start* the demo reset, which meant the first visitor in a
 * 20-minute window paid the full ~127s seed on a progress screen before seeing
 * anything. At ~20 sessions a day most visitors were that first visitor, so the
 * landing page's main "Explore the live demo" CTA led to a two-minute wait.
 *
 * Resets are now cron-driven (vercel.json → /api/demo/reset, several times a
 * day), so nobody pays for them. All this page still does is hold a visitor back
 * in the narrow window where a scheduled reset happens to be mid-flight — a
 * half-wiped venue reads as "this product is empty". When nothing is running we
 * redirect server-side, before any HTML ships, so there is no dark flash.
 */
export const dynamic = "force-dynamic";

/** Only ever forward to a same-origin path — `next` comes from the query string. */
function safeNext(raw: unknown): string {
  const v = typeof raw === "string" ? raw : "";
  if (!v.startsWith("/") || v.startsWith("//")) return "/rota";
  return v;
}

export default async function DemoPreparingPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const next = safeNext(searchParams?.next);

  // Cheap single read. If no reset is in flight the visitor never sees this page.
  let running = false;
  try {
    running = (await getDemoResetState()).running;
  } catch {
    // Never strand anyone on a status failure — send them through.
    running = false;
  }
  if (!running) redirect(next);

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F1C35]" />}>
      <DemoPreparingClient />
    </Suspense>
  );
}
