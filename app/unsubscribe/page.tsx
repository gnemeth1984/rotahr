import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { isSuppressed, normaliseEmail } from "@/lib/email/suppression";
import { AfterOptOut } from "./AfterOptOut";
import { ConfirmUnsubscribeButton } from "./ConfirmUnsubscribeButton";
import { ResubscribeButton } from "./ResubscribeButton";

export const metadata: Metadata = {
  title: "Unsubscribe · Rotahr",
  description: "Stop receiving marketing emails from Rotahr.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Loading this page opts nobody out. It reads, it never writes.
 *
 * It used to record the opt-out on GET so the link took one click. That handed
 * the decision to whatever fetched the link first, and on a list of hotels and
 * restaurants that is almost always a corporate mail security gateway: 80 of
 * 123 recorded opt-outs were addresses that had never been on our list at all —
 * the gateway re-requesting the link with a scrambled address to see whether we
 * validate input — and 37 of the 43 real ones landed inside 60 seconds of the
 * send. The write now lives behind a button, which no scanner clicks, and the
 * `List-Unsubscribe-Post` header still gives Gmail and Outlook a true one-click
 * opt-out that never touches this page.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { email?: string; t?: string };
}) {
  const raw = searchParams.email?.trim();
  const email = raw ? normaliseEmail(raw) : "";
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const already = valid ? await isSuppressed(email) : false;

  return (
    <main className="min-h-screen bg-[#0F1C35] text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image
            src="/logo-white-trans.png"
            alt="Rotahr"
            width={180}
            height={67}
            className="h-9 w-auto"
            priority
          />
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-7">
          {!valid ? (
            <>
              <h1 className="text-xl font-semibold mb-2">We need your email address</h1>
              <p className="text-sm text-white/60 leading-relaxed">
                The link didn&apos;t include a valid email address, so there&apos;s nothing for us to
                remove. Forward the email you received to{" "}
                <a href="mailto:sales@rotahr.com" className="text-[#FF6B35] hover:underline">
                  sales@rotahr.com
                </a>{" "}
                and we&apos;ll take you off the list by hand.
              </p>
            </>
          ) : already ? (
            <>
              <h1 className="text-xl font-semibold mb-2">You&apos;re already unsubscribed</h1>
              <p className="text-sm text-white/60 leading-relaxed">
                We&apos;re not sending marketing emails to{" "}
                <span className="text-white/90 font-medium break-all">{email}</span>. Nothing more to
                do.
              </p>
              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-xs text-white/40 mb-3">
                  Off the list by mistake, or your mail app opened this for you?
                </p>
                <ResubscribeButton email={email} />
              </div>
              <AfterOptOut />
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-2">Unsubscribe from Rotahr emails?</h1>
              <p className="text-sm text-white/60 leading-relaxed mb-6">
                One tap and we stop sending marketing emails to{" "}
                <span className="text-white/90 font-medium break-all">{email}</span>. No form, no
                reason needed.
              </p>
              <ConfirmUnsubscribeButton email={email} />
              <p className="text-xs text-white/35 leading-relaxed mt-4">
                We ask because mail security scanners open every link in a message before you see
                it, and we&apos;d rather not take someone off the list who never asked.
              </p>
            </>
          )}
        </div>

        <p className="text-xs text-white/35 text-center mt-6 leading-relaxed">
          Rotahr, Ireland ·{" "}
          <Link href="/privacy" className="hover:text-white/60 underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <a href="mailto:sales@rotahr.com" className="hover:text-white/60 underline">
            sales@rotahr.com
          </a>
        </p>
        <p className="text-xs text-white/25 text-center mt-2">
          Built by a chef who got tired of paper rotas.
        </p>
      </div>
    </main>
  );
}
