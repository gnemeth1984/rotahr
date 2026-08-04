import type { Metadata } from "next";

// Sign-in is a thin utility page — it should never compete with the marketing
// pages in search, and it must not share the site-wide default title.
export const metadata: Metadata = {
  title: "Sign in to Rotahr",
  description:
    "Sign in to your Rotahr account to manage rotas, bookings, payroll and food safety checks.",
  alternates: { canonical: "/auth/signin" },
  robots: { index: false, follow: true },
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
