import { Suspense } from "react";
import DemoPreparingClient from "./DemoPreparingClient";

/**
 * The interstitial reads `?next=` with useSearchParams, so it cannot be
 * prerendered. Keep it out of the static export and give it a Suspense
 * boundary — without one `next build` fails on this route.
 */
export const dynamic = "force-dynamic";

export default function DemoPreparingPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-[#0F1C35]" />}
    >
      <DemoPreparingClient />
    </Suspense>
  );
}
