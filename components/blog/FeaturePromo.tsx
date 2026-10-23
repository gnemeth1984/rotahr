"use client";

import Link from "next/link";
import type { FeaturePitch } from "@/lib/blog/feature-promo";

/**
 * The one Rotahr feature that fits this article. Two placements:
 *  - "inline": a compact card halfway through the article.
 *  - "end": the full card that replaces the generic trial CTA.
 * Clicks are counted (no cookies, no personal data) via /api/blog/feature-click.
 */
function track(post: string, feature: string, placement: string, target: string) {
  try {
    const body = JSON.stringify({ post, feature, placement, target });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/blog/feature-click", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/blog/feature-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // never block the click
  }
}

export default function FeaturePromo({
  pitch,
  post,
  placement,
}: {
  pitch: FeaturePitch;
  post: string;
  placement: "inline" | "end";
}) {
  const featureHref = `/features/${pitch.slug}`;

  if (placement === "inline") {
    return (
      <aside
        className="not-prose my-10 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5"
        data-testid="blog-feature-inline"
        data-feature={pitch.slug}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
          In Rotahr · {pitch.name}
        </p>
        <p className="font-semibold text-gray-900 leading-snug">{pitch.headline}</p>
        <p className="text-sm text-gray-600 leading-relaxed mt-1.5">{pitch.blurb}</p>
        <Link
          href={featureHref}
          onClick={() => track(post, pitch.slug, "inline", "feature")}
          className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          See how it works →
        </Link>
      </aside>
    );
  }

  return (
    <section
      className="mt-12 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"
      data-testid="blog-feature-end"
      data-feature={pitch.slug}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 mb-1">
        Rotahr · {pitch.name}
      </p>
      <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2">{pitch.headline}</h3>
      <p className="text-gray-600 text-sm leading-relaxed mb-3">{pitch.blurb}</p>
      <ul className="space-y-1.5 mb-5">
        {pitch.bullets.map((b) => (
          <li key={b} className="flex gap-2 text-sm text-gray-700">
            <span className="text-emerald-600 font-bold" aria-hidden="true">
              ✓
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/auth/register"
          onClick={() => track(post, pitch.slug, "end", "register")}
          className="inline-block bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
        >
          Try it free for 3 months
        </Link>
        <Link
          href={featureHref}
          onClick={() => track(post, pitch.slug, "end", "feature")}
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
        >
          See how {pitch.name} works →
        </Link>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Built for restaurants, bars and hotels. Flat monthly price, never per employee. No card
        needed to start.
      </p>
    </section>
  );
}
