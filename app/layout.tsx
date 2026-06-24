import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/shared/providers"
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister"

export const metadata = {
  metadataBase: new URL("https://rotahr.vercel.app"),
  title: "Rotahr — Venue Management for Irish Hospitality",
  description: "Staff rotas, table reservations, bookkeeping and HR — all in one app. Built for Irish bars, restaurants and cafes.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rotahr",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    title: "Rotahr — Venue Management for Irish Hospitality",
    description: "Staff rotas, table reservations, bookkeeping and HR — all in one app.",
    images: ["/logo-dark.png"],
  },
}

export const viewport = {
  themeColor: "#F97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rotahr" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <ServiceWorkerRegister />
          {children}
        </Providers>
      </body>
    </html>
  )
}
