"use client";

import { useState } from "react";

/**
 * Shown only on prospect pages — ones we published for a venue we don't run.
 *
 * Deliberately does not contain the claim token. Submitting emails the link to
 * the contact address already on file for the venue, so a passer-by can't take
 * over someone else's page.
 */
/**
 * Every mailto here carries the venue name, page URL and slug already filled in.
 *
 * They used to open a blank message, so anyone getting in touch — including us,
 * working through prospect pages — had to type the business name out before they
 * could say anything. Nobody should retype what the page already knows.
 */
function prefilledMailto(subject: string, venueName: string, slug: string, body: string) {
  const url = `https://rotahr.com/v/${slug}`;
  const full = `${body}\n\n---\nVenue: ${venueName}\nPage: ${url}\nRef: ${slug}`;
  return `mailto:sales@rotahr.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(full)}`;
}

export function ClaimBanner({
  slug,
  venueName,
  hasContact = true,
}: {
  slug: string;
  venueName: string;
  /**
   * False when we hold no contact address for the venue.
   *
   * Claiming works by emailing a link to the address already on file, so with no
   * address there is nothing to send and the button would silently do nothing.
   * Showing a real owner a "check your inbox" message for an email that can
   * never arrive is worse than telling them to get in touch.
   */
  hasContact?: boolean;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function request() {
    setState("sending");
    const res = await fetch("/api/claim/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setState("error");
      setMessage(data.error ?? "Something went wrong. Please try again.");
      return;
    }
    setState("sent");
    setMessage(data.message ?? null);
  }

  return (
    /* scroll-mt keeps the heading clear of the top prompt when jumped to. */
    <aside id="claim" className="scroll-mt-4 border-t border-slate-200 bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Is this your venue?</h2>
        <p className="text-sm text-slate-600 mb-4 max-w-2xl leading-relaxed">
          We built this page for {venueName} from publicly available information —
          we don&apos;t run the venue. Claiming it is free and takes a minute, and
          you get to correct anything that&apos;s wrong: opening hours, menu,
          photos, and taking bookings straight from the page.{" "}
          {hasContact
            ? "We'll email a claim link to the contact address we have on file, so only you can take it over."
            : "We don't have a contact address for you on file, so email us from the venue's address and we'll hand it over."}
        </p>
        <ul className="mb-5 grid gap-x-6 gap-y-1.5 text-sm text-slate-700 sm:grid-cols-2">
          <li>· Fix your hours and menu yourself, any time</li>
          <li>· Take table bookings with no commission</li>
          <li>· Free to claim — no card, no contract</li>
          <li>· Or ask us to take it down, no questions</li>
        </ul>

        {!hasContact ? (
          <a
            href={prefilledMailto(
              `Claiming the Rotahr page for ${venueName}`,
              venueName,
              slug,
              `Hi,\n\nI'd like to claim this page for ${venueName}. I'm emailing from the venue's address.`
            )}
            className="inline-block text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
          >
            Email us to claim it
          </a>
        ) : state === "sent" ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            {message}
          </p>
        ) : (
          <>
            <button
              onClick={request}
              disabled={state === "sending"}
              className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
            >
              {state === "sending" ? "Sending…" : "Claim this page"}
            </button>
            {state === "error" && (
              <p role="alert" className="text-sm text-red-700 mt-3">
                {message}
              </p>
            )}
          </>
        )}

        <p className="text-xs text-slate-500 mt-4">
          Would rather it came down?{" "}
          <a
            href={prefilledMailto(
              `Please remove the Rotahr page for ${venueName}`,
              venueName,
              slug,
              `Hi,\n\nPlease take down this page for ${venueName}.`
            )}
            className="text-orange-700 underline"
          >
            Email us
          </a>{" "}
          and we&apos;ll remove it.
        </p>
      </div>
    </aside>
  );
}
