import Link from "next/link";
import { ArrowRight, Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import TutorialGallery, { type TutorialItem } from "@/components/marketing/TutorialGallery";
import {
  jsonLdProps,
  breadcrumbSchema,
  videoSchema,
} from "@/lib/seo/structured-data";

/**
 * /tutorials — short how-to videos, visible to anyone.
 *
 * PUBLIC ON PURPOSE. This is the page a venue owner watches BEFORE deciding
 * whether to sign up, so putting it behind the login would defeat it entirely.
 * `/tutorials` is listed in PUBLIC_PATHS in middleware.ts; if you rename the
 * route, rename it there too or logged-in admins get bounced off it.
 *
 * The videos are public Vercel Blob URLs played by a plain <video> element.
 * That needs `media-src` in the CSP (next.config.mjs). It is easy to miss
 * because a missing media-src falls back to default-src 'self' and the video
 * simply never starts, with nothing in the UI to explain why.
 *
 * Empty state matters here: this page ships before the first video is
 * recorded, so it must read as "coming soon", not as a broken page.
 */

export const revalidate = 300;

export const metadata = {
  title: "Rotahr Tutorials — Short Videos on How It Works",
  description:
    "Watch short walkthroughs of Rotahr: building a rota, staff clocking in, bookings, HACCP logs and more. No signup, no card, nothing to install.",
  alternates: { canonical: "/tutorials" },
};

export default async function TutorialsPage() {
  const tutorials = await prisma.tutorial.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      videoUrl: true,
      posterUrl: true,
      durationSeconds: true,
      createdAt: true,
    },
  });

  const items: TutorialItem[] = tutorials.map((t) => ({
    id: t.id,
    slug: t.slug,
    title: t.title,
    description: t.description,
    videoUrl: t.videoUrl,
    posterUrl: t.posterUrl,
    durationSeconds: t.durationSeconds,
  }));

  const schema = [
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Tutorials", path: "/tutorials" },
    ]),
    ...tutorials.map((t) => videoSchema(t)),
  ];

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script {...jsonLdProps(schema)} />

      {/* Header */}
      <header className="border-b border-slate-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            Rotahr
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/pricing" className="transition-colors hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/try" className="transition-colors hover:text-slate-900">
              Live demo
            </Link>
            <Link href="/auth/signin" className="transition-colors hover:text-slate-900">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-10 pt-14 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
          Tutorials
        </span>
        <h1 className="mt-6 text-4xl font-extrabold leading-tight sm:text-5xl">
          See exactly how Rotahr works
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Short videos, one job each. No signup and no card &mdash; watch first, decide after.
        </p>
      </section>

      {/* Videos */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-16 text-center">
            <Film className="mx-auto mb-4 h-9 w-9 text-slate-300" />
            <h2 className="text-lg font-semibold text-slate-800">
              The videos are being recorded right now
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              They will land here shortly. In the meantime the live demo is a real venue
              with staff, rotas and bookings already in it &mdash; you can click through
              the whole thing without signing up.
            </p>
            <Link
              href="/try"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              Open the live demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <TutorialGallery items={items} />
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-3xl px-6 py-14 text-center">
          <h2 className="text-2xl font-bold">Want to try it on your own venue?</h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-600">
            Set up a rota with your real staff in about ten minutes. Nothing to install.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/register"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #F97316, #EC4899)" }}
            >
              Create an account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/try"
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white"
            >
              Or poke around the demo
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-500 sm:flex-row">
          <span>Rotahr &mdash; built by a chef, for hospitality.</span>
          <nav className="flex items-center gap-5">
            <Link href="/" className="hover:text-slate-900">
              Home
            </Link>
            <Link href="/pricing" className="hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/blog" className="hover:text-slate-900">
              Blog
            </Link>
            <Link href="/privacy" className="hover:text-slate-900">
              Privacy
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}
