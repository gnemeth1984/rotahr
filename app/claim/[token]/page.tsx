import Link from "next/link";
import type { Metadata } from "next";
import { findClaimable } from "@/lib/public-page/claim";
import { ClaimForm } from "./_claim-form";

// A claim link must never be indexed or cached.
export const metadata: Metadata = {
  title: "Claim your venue page | Rotahr",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const business = await findClaimable({ token });

  if (!business) {
    return (
      <main className="min-h-screen bg-[#0A1427] text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">This link has expired</h1>
          <p className="text-slate-300 mb-6">
            Claim links are single-use, and requesting a new one replaces the old
            one. If the page is still unclaimed you can ask for a fresh link from
            the page itself.
          </p>
          <Link
            href="/"
            className="inline-block border border-white/15 px-6 py-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            Back to Rotahr
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0A1427] text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-3">Claim {business.name}</h1>
        <p className="text-slate-300 mb-2">
          You&apos;re about to take control of the page at{" "}
          <span className="text-white">rotahr.com/v/{business.slug}</span>.
        </p>
        <p className="text-sm text-slate-400 mb-8">
          Set a password and the page is yours — opening hours, menu, photos and
          bookings all become editable. The rest of Rotahr comes with it, free for
          the first month.
        </p>
        <ClaimForm token={token} slug={business.slug} />
      </div>
    </main>
  );
}
