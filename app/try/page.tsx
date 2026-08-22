// @ts-nocheck
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import TryClient from "./TryClient";

/**
 * /try — the demo chooser.
 *
 * Used to be a redirect to /auth/signin (see next.config.mjs). That put a cold
 * visitor in front of a sign-in form when what they clicked was "Explore the live
 * demo", and it's the destination of the landing page's co-primary CTA, so it's
 * the second page most visitors ever see.
 */
export const metadata: Metadata = {
  title: "Try the Rotahr demo — a real venue, no signup",
  description:
    "Open a live Rotahr account with staff, rotas, bookings, stock and HACCP records already in it. No signup, no card. Pick the owner view or a staff role.",
  alternates: { canonical: "/try" },
  openGraph: {
    title: "Try the Rotahr demo — a real venue, no signup",
    description:
      "A live venue with staff, rotas and bookings already in it. No signup, no card.",
    url: "https://rotahr.com/try",
  },
};

export default async function TryPage() {
  // Someone already signed in doesn't need a demo login — send them to the app.
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  return <TryClient />;
}
