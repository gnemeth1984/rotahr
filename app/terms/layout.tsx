import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Rotahr",
  description:
    "The terms that govern your Rotahr subscription: billing, international pricing, acceptable use, cancellation and the partner programme terms.",
  alternates: { canonical: "/terms" },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
