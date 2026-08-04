import type { Metadata } from "next";

// This page was inheriting the site-wide default title, so it looked like a
// duplicate of the homepage to crawlers and had no canonical of its own.
export const metadata: Metadata = {
  title: "Rotahr Partner Programme — 20% Recurring Commission",
  description:
    "Earn 20% recurring commission for every venue you refer to Rotahr. Open worldwide, paid monthly for as long as the customer stays subscribed.",
  alternates: { canonical: "/partners" },
  openGraph: {
    title: "Rotahr Partner Programme — 20% recurring commission",
    description:
      "Refer hospitality venues to Rotahr and earn 20% recurring commission, paid monthly.",
    url: "/partners",
    type: "website",
  },
};

export default function PartnersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
