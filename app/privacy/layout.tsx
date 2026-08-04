import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Rotahr",
  description:
    "How Rotahr collects, stores and protects staff and customer data, including GDPR, CCPA/CPRA, PIPEDA and Australian Privacy Act rights.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
