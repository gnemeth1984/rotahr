import "./globals.css"
import { ReactNode } from "react"
import { Providers } from "@/components/shared/providers"
import { ServiceWorkerRegister } from "@/components/shared/ServiceWorkerRegister"
import { Toaster } from "sonner"
import PageTracker from "@/components/shared/page-tracker"

export const metadata = {
  metadataBase: new URL("https://rotahr.com"),
  verification: {
    google: "7cibzOGL029tVn1J5xlrUiLUp_dvHZbmzR7WfeHdvOY",
  },
  title: "Rotahr — Restaurant Operations Platform: Rota, HACCP & CRM",
  description:
    "A restaurant operations platform combining staff rotas, HACCP software and a restaurant CRM with table reservations, bookkeeping and payroll. From €49/month.",
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
    title: "Rotahr — Restaurant Operations Platform: Rota, HACCP & CRM",
    description:
      "Restaurant operations platform: staff rotas, HACCP software, restaurant CRM, table reservations and bookkeeping in one app.",
    images: ["/logo-dark.png"],
  },
}

export const viewport = {
  themeColor: "#F97316",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* No hardcoded manifest link here. It comes from the Metadata API
            (metadata.manifest above) so a nested layout can override it —
            /navigator ships its own manifest, and a hardcoded tag would win
            over the nested one and break Navigator's install + share target. */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rotahr" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-slate-50">
        <Providers>
          <ServiceWorkerRegister />
          <PageTracker />
          {children}
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  )
}
