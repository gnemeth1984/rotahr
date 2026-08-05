import type { Metadata } from "next";
import { ManageListing } from "./_manage";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://rotahr.com";

// A manage link is a credential. It must never be indexed or cached.
export const metadata: Metadata = {
  title: "Manage your listing | Rotahr",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ManageListingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-[#0f1c35] text-white px-6 py-14">
      <div className="max-w-2xl mx-auto">
        <ManageListing token={token} site={SITE} />
      </div>
    </main>
  );
}
