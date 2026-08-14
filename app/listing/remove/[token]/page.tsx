import type { Metadata } from "next";
import Link from "next/link";
import { findTakedownTarget } from "@/lib/public-page/takedown";
import { RemoveForm } from "./_remove-form";

export const metadata: Metadata = {
  title: "Remove your listing | Rotahr",
  // Never index a page reachable only by a signed token.
  robots: { index: false, follow: false },
};

export default async function RemoveListingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const target = await findTakedownTarget(token);

  return (
    <main className="min-h-screen bg-[#0f1c35] text-white">
      <div className="max-w-lg mx-auto px-6 py-16 sm:py-24">
        <Link
          href="/landing"
          className="inline-flex items-center gap-2 text-[#ff6b35] font-bold text-lg mb-10 hover:opacity-80 transition-opacity"
        >
          ← Rotahr
        </Link>

        {!target ? (
          <>
            <h1 className="text-2xl font-bold mb-4">Nothing to remove</h1>
            <p className="text-slate-300 leading-relaxed mb-6">
              That page is already gone, or it has been claimed by its owner and
              is now managed from their account. Either way there is nothing here
              for us to take down.
            </p>
            <p className="text-sm text-slate-400">
              If you think that&apos;s wrong, email{" "}
              {/* Carries the removal ref so nobody has to describe which page
                  they mean, or type the business name to do it. */}
              <a
                href={`mailto:sales@rotahr.com?subject=${encodeURIComponent(
                  "Listing removal — nothing found"
                )}&body=${encodeURIComponent(
                  `Hi,\n\nI opened a removal link and it says there is nothing to remove.\n\n---\nRemoval ref: ${token}`
                )}`}
                className="text-[#ff6b35] underline"
              >
                sales@rotahr.com
              </a>{" "}
              and a human will sort it.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-4">
              Remove the page for {target.name}?
            </h1>
            <p className="text-slate-300 leading-relaxed mb-4">
              We built{" "}
              {target.slug ? (
                <span className="font-mono text-sm text-white">/v/{target.slug}</span>
              ) : (
                "this page"
              )}{" "}
              from publicly available information because we thought it was useful.
              If you&apos;d rather it didn&apos;t exist, that&apos;s a good enough
              reason — press the button and it&apos;s gone.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              We delete the page and the details on it, and we record the venue
              name so no future import puts it back. You&apos;ll come off the
              outreach list at the same time, so you won&apos;t hear from us again.
            </p>
            <RemoveForm token={token} name={target.name} />
          </>
        )}
      </div>
    </main>
  );
}
