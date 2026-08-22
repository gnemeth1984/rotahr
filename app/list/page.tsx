import type { Metadata } from "next";
import Link from "next/link";
import { ListForm } from "./_list-form";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://rotahr.com";

export const metadata: Metadata = {
  title: "List your venue for free | Rotahr",
  description:
    "Add your restaurant, bar, cafe or hotel to Rotahr for free. Your photos, menu and opening hours, with a booking button that goes straight to you. No commission and no per-cover fees.",
  alternates: { canonical: "/list" },
  openGraph: {
    title: "List your venue for free | Rotahr",
    description:
      "A free page for your venue — photos, menu, opening hours and direct bookings. No commission, no per-cover fees.",
    url: `${SITE}/list`,
  },
};

const POINTS = [
  {
    title: "Direct bookings, no commission",
    body: "Enquiries come straight to you. No per-cover fee, no cut of the bill — unlike the booking platforms.",
  },
  {
    title: "Your photos and your menu",
    body: "Upload a cover photo, add your opening hours and details. You control what's on the page.",
  },
  {
    title: "No account needed",
    body: "We email you a link. Open it and the page is live. Come back to that link any time to edit.",
  },
];

export default function ListVenuePage() {
  return (
    <main className="min-h-screen bg-[#0f1c35] text-white">
      <div className="max-w-5xl mx-auto px-6 py-14 sm:py-20">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[#ff6b35] font-bold text-lg mb-10 hover:opacity-80 transition-opacity"
        >
          ← Rotahr
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4">
              List your venue.{" "}
              <span className="bg-gradient-to-r from-[#ff6b35] to-[#e8365d] bg-clip-text text-transparent">
                Free.
              </span>
            </h1>
            <p className="text-lg text-slate-300 leading-relaxed mb-10">
              A page for your restaurant, bar, cafe or hotel — your photos, your menu, your
              opening hours, and a booking button that comes straight to you.
            </p>

            <div className="space-y-6">
              {POINTS.map((p) => (
                <div key={p.title} className="flex gap-4">
                  <div className="mt-1 h-2 w-2 rounded-full bg-gradient-to-r from-[#ff6b35] to-[#e8365d] shrink-0" />
                  <div>
                    <h2 className="font-semibold mb-1">{p.title}</h2>
                    <p className="text-sm text-slate-400 leading-relaxed">{p.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-sm text-slate-300 leading-relaxed">
                <span className="font-semibold text-white">Why we do this.</span> Rotahr is
                scheduling, bookings and food-safety software for hospitality, built by an
                ex-chef. The listing is free and stays free — if you ever want the rest, it&apos;s
                there.
              </p>
            </div>
          </div>

          <ListForm />
        </div>
      </div>
    </main>
  );
}
