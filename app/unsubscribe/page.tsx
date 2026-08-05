import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import {
  isSuppressed,
  normaliseEmail,
  suppress,
  verifyUnsubscribeToken,
} from "@/lib/email/suppression";
import { ResubscribeButton } from "./ResubscribeButton";

export const metadata: Metadata = {
  title: "Unsubscribe · Rotahr",
  description: "Stop receiving marketing emails from Rotahr.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The opt-out is recorded on load, not behind a confirm button. A link that
 * needs a second click is a link some people never finish, and the law is on
 * the side of the easy opt-out. The trade-off is that a mail scanner
 * prefetching the link can opt someone out by accident, so the page always
 * offers an undo.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { email?: string; t?: string };
}) {
  const raw = searchParams.email?.trim();
  const email = raw ? normaliseEmail(raw) : "";
  const valid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

  // Idempotent, and deliberately doesn't distinguish "just unsubscribed" from
  // "was already unsubscribed" — the difference means nothing to the reader, and
  // a prefetching mail client shouldn't make the first real click look odd.
  let state: "done" | "missing" = "missing";

  if (valid) {
    if (!(await isSuppressed(email))) {
      await suppress({
        email,
        source: "unsubscribe_link",
        reason: verifyUnsubscribeToken(email, searchParams.t) ? "signed link" : "unsigned link",
        userAgent: headers().get("user-agent"),
      });
    }
    state = "done";
  }

  return (
    <main className="min-h-screen bg-[#0F1C35] text-white flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Image src="/logo-white-trans.png" alt="Rotahr" width={180} height={67} className="h-9 w-auto" priority />
        </div>

        <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-7">
          {state === "missing" ? (
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
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-2">Done — you&apos;re unsubscribed</h1>
              <p className="text-sm text-white/60 leading-relaxed">
                We won&apos;t send any more marketing emails to{" "}
                <span className="text-white/90 font-medium break-all">{email}</span>. It takes effect
                immediately.
              </p>
              <p className="text-sm text-white/60 leading-relaxed mt-3">
                If you have a Rotahr account, this doesn&apos;t touch the emails your account needs —
                rota changes, shift alerts, receipts. Only the marketing.
              </p>

              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-xs text-white/40 mb-3">
                  Clicked by mistake, or your mail app opened it for you?
                </p>
                <ResubscribeButton email={email} />
              </div>
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
