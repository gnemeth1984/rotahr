import type { Metadata } from "next";

/**
 * Navigator installs as its own PWA.
 *
 * Pointing these routes at /navigator.webmanifest instead of the app-wide
 * /manifest.json is what gives Navigator its own home-screen icon, its own
 * dark theme colour, and — the reason this exists — its own share_target.
 * The whole-app manifest deliberately has no share_target, so a staff member's
 * installed Rotahr never offers to receive Gabor's personal documents.
 *
 * Scope is /navigator, so installing this does not swallow the rest of Rotahr.
 */
export const metadata: Metadata = {
  manifest: "/navigator.webmanifest",
  title: "Navigator | Rotahr",
  themeColor: "#0f1c35",
  appleWebApp: {
    capable: true,
    title: "Navigator",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/navigator-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/navigator-apple-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function NavigatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
