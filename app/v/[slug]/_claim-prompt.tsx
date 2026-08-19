"use client";

/**
 * Owner-facing prompt at the TOP of a prospect page.
 *
 * WHY: Search Console shows these pages rank position 8-19 for the venue's own
 * name — so the person most likely to arrive is the owner googling themselves.
 * The claim banner sat at the very bottom, below hero, about, specials, menu,
 * hours, contact and booking. An owner had to scroll past the entire page to
 * discover the page was claimable, which is why the claim funnel converted
 * nothing.
 *
 * Deliberately slim: diners land here too, and a full-width takeover would ruin
 * the page for them. One line, one link, dismissible.
 */
export function ClaimPrompt({ venueName }: { venueName: string }) {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center text-sm">
        <span className="text-amber-900">
          Is this <span className="font-semibold">{venueName}</span>? This page isn&apos;t run by
          the venue.
        </span>
        <a
          href="#claim"
          className="font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
        >
          Claim it free
        </a>
      </div>
    </div>
  );
}
