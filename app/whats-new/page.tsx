import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { CHANGELOG, formatReleaseDate } from "@/lib/marketing/changelog";
import { jsonLdProps, breadcrumbSchema, SITE_URL } from "@/lib/seo/structured-data";

/**
 * app/whats-new/page.tsx — public product changelog.
 *
 * One durable URL for every "what's new" link (footer, launch emails, social
 * posts). Content lives in lib/marketing/changelog.ts.
 */

const TITLE = "What's New in Rotahr — Product Updates";
const DESCRIPTION =
  "Latest Rotahr releases: the Manager Copilot daily brief, supplier price history, revenue and labour % per venue, staff invites by email and more. Included on every plan.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/whats-new" },
  openGraph: {
    title: "What's new in Rotahr",
    description: DESCRIPTION,
    url: "/whats-new",
    images: [{ url: "/evidence/copilot.png", width: 2880, height: 1800 }],
  },
};

export default function WhatsNewPage() {
  const latest = CHANGELOG[0];
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Rotahr product updates",
    itemListElement: CHANGELOG.map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${formatReleaseDate(r.date)}: ${r.title}`,
      url: `${SITE_URL}/whats-new#${r.date}`,
    })),
  };

  return (
    <main className="min-h-screen bg-[#0A1427] text-white">
      <script
        {...jsonLdProps([
          itemList,
          breadcrumbSchema([
            { name: "Rotahr", path: "/" },
            { name: "What's new", path: "/whats-new" },
          ]),
        ])}
      />

      <div className="max-w-4xl mx-auto px-6 py-16">
        <nav className="text-sm text-slate-400 mb-8">
          <Link href="/" className="hover:text-white">Rotahr</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-300">What&apos;s new</span>
        </nav>

        <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">What&apos;s new in Rotahr</h1>
        <p className="text-lg text-slate-200 mb-10 max-w-2xl">
          Everything we have shipped recently, in plain terms: what it does and
          where it stops. Every update is included on Starter, Pro and
          Enterprise at no extra cost — pricing stays flat, never per employee.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden mb-16">
          <Image
            src="/evidence/copilot.png"
            alt="The Manager Copilot daily brief for the demo venue The Anchor & Tap: today's priorities, a Tonight panel and an Ask box"
            width={2880}
            height={1800}
            className="w-full h-auto"
            priority
          />
          <div className="p-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-300 max-w-xl">
              The Manager Copilot on the demo venue. Real screen, demo data.
            </p>
            <div className="flex gap-3">
              <Link
                href="/features/manager-copilot"
                className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#FF6B35] text-white hover:bg-[#ff7d4d] transition-colors"
              >
                How the Copilot works
              </Link>
              <Link
                href="/try"
                className="text-sm font-semibold px-4 py-2 rounded-lg border border-white/20 text-white hover:border-white/40 transition-colors"
              >
                Try the demo
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-16">
          {CHANGELOG.map((release) => (
            <section key={release.date} id={release.date} className="scroll-mt-24">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#FF6B35] mb-2">
                <time dateTime={release.date}>{formatReleaseDate(release.date)}</time>
                {release === latest && <span className="ml-3 rounded-full bg-[#FF6B35]/15 px-2 py-0.5 text-xs">Latest</span>}
              </p>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">{release.title}</h2>
              <p className="text-base text-slate-300 mb-6 max-w-2xl leading-relaxed">{release.summary}</p>
              <ul className="space-y-4">
                {release.items.map((item) => (
                  <li key={item.title} className="border-l-2 border-[#FF6B35] pl-4">
                    <h3 className="font-semibold">
                      {item.href ? (
                        <Link href={item.href} className="hover:text-[#FF6B35] transition-colors">
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-[#FF6B35] to-[#E8365D] p-8 text-center mt-16">
          <h2 className="text-2xl font-bold mb-3">First 3 months free</h2>
          <p className="mb-6 text-white/90">
            Starter €49, Pro €89, Enterprise €215 a month, VAT included. A flat
            monthly price, never per employee. No card to start.
          </p>
          <Link
            href="/pricing"
            className="inline-block bg-white text-[#0F1C35] font-semibold px-7 py-3 rounded-xl hover:bg-slate-100 transition-colors"
          >
            See pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
