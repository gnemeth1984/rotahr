import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { isSuperAdminEmail } from "@/lib/auth/super-admins";
import { Barlow } from "next/font/google";
import Link from "next/link";
import { Compass } from "lucide-react";
import { ShareClient } from "./ShareClient";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = { title: "Shared to Navigator | Rotahr" };

/**
 * Landing page for the Android share sheet.
 *
 * The share target route stores the photo and redirects here immediately, so
 * this page owns the slow part (the vision read) where a spinner can actually
 * be seen. Mirrors /navigator's own dark surface so arriving from the OS share
 * sheet does not feel like a different app.
 */
export default async function NavigatorSharePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; task?: string; error?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");
  if (!isSuperAdminEmail(session.user.email)) redirect("/dashboard");

  const sp = await searchParams;

  return (
    <div
      className={`${barlow.className} -mx-4 -mb-8 -mt-16 min-h-screen sm:-mx-6 lg:-mx-8 lg:-mt-8`}
      style={{ background: "linear-gradient(180deg,#0f1c35 0%,#0a1428 100%)" }}
    >
      <div className="mx-auto max-w-2xl px-4 pb-14 pt-16 sm:px-6 lg:px-8 lg:pt-8">
        <header className="mb-6 flex items-center gap-3">
          <Link
            href="/navigator"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#e8365d] shadow-[0_12px_34px_-14px_rgba(232,54,93,0.85)]"
          >
            <Compass className="h-6 w-6 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white">
              Shared to Navigator
            </h1>
            <p className="text-sm text-slate-400">Straight off the share sheet</p>
          </div>
        </header>

        <ShareClient
          captureId={sp.id ?? null}
          taskId={sp.task ?? null}
          error={sp.error ?? null}
        />
      </div>
    </div>
  );
}
