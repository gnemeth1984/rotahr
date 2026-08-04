import type { Metadata } from "next";

// Every /auth/* route is a utility screen (sign in, register, password reset,
// verify, error). None of them should be indexed — they're thin by nature and
// only dilute the marketing pages. Child layouts still set their own titles,
// descriptions and canonicals.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
