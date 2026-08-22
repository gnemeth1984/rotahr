const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // microphone=(self) is required by Navigator's push-to-talk. With microphone=()
  // the browser refuses getUserMedia site-wide before any permission UI exists:
  // an instant NotAllowedError, no prompt, and no site entry in browser settings
  // — which reads exactly like a broken button. Third parties stay blocked.
  // camera stays off until Phase 2 photo capture needs it.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(self), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // app.lemonsqueezy.com serves lemon.js, which powers the overlay checkout.
      // Without it the "Start Free Trial" buttons are dead on the live site.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://app.lemonsqueezy.com https://assets.lemonsqueezy.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.vercel-storage.com https://*.public.blob.vercel-storage.com",
      "font-src 'self'",
      "connect-src 'self' https://*.vercel-storage.com https://api.openai.com https://api.lemonsqueezy.com https://app.lemonsqueezy.com",
      // The Lemon Squeezy overlay checkout renders inside an iframe it injects.
      "frame-src 'self' https://app.lemonsqueezy.com https://*.lemonsqueezy.com",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
    ].join("; "),
  },
];

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "*.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      // Short, memorable URL for print material and QR codes. Lands on the
      // sign-in page, which has the one-click demo panel open by default.
      { source: "/try", destination: "/auth/signin", permanent: false },

      // `/landing` used to render the same component as `/`, so the marketing
      // page existed on two URLs and split its own traffic (142 views on `/`
      // vs 88 on `/landing` in one 30-day window). `/` is now the single
      // canonical marketing URL. Permanent so the link equity consolidates.
      { source: "/landing", destination: "/", permanent: true },

      // Both of these were hard 404s. `/demo` is the most natural URL a
      // visitor guesses when they want to look before signing up, and
      // `/pricing` is what external links and typed URLs reach for — the nav
      // only ever used the `#pricing` anchor.
      { source: "/demo", destination: "/try", permanent: false },
      { source: "/pricing", destination: "/#pricing", permanent: false },
    ];
  },
};

export default nextConfig;
