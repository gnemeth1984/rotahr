import type { Metadata } from "next";

// Registration is a conversion page, not a ranking page: unique title, own
// canonical, and kept out of the index so it can't cannibalise /landing.
export const metadata: Metadata = {
  title: "Create your Rotahr account",
  description:
    "Start your Rotahr account and set up scheduling, bookings, payroll and compliance for your venue. First month free.",
  alternates: { canonical: "/auth/register" },
  robots: { index: false, follow: true },
};

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
