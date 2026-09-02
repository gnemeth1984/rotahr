/**
 * lib/marketing/plans.ts — the plan cards shown on the marketing site.
 *
 * Lifted out of components/marketing/LandingPage.tsx when /pricing became a
 * real route, so the homepage pricing section and the pricing page cannot drift
 * apart. Prices here must match lib/seo/product-facts.ts PLANS, which is what
 * every AI writing prompt is grounded on.
 *
 * If a price changes, grep the whole repo before you assume this is the only
 * place: app/terms/page.tsx, lib/seo/structured-data.ts, lib/inbox/knowledge.ts,
 * lib/help/knowledge-base.ts, lib/seo/competitors.ts and app/pitch/page.tsx all
 * carry the number in prose too, and app/pitch renders it as `<sup>€</sup>49`.
 */

export type MarketingPlan = {
  name: string;
  price: string;
  period: string;
  desc: string;
  staff: string;
  highlight: boolean;
  offer: string | null;
  cta: string;
  features: string[];
};

export const plans: MarketingPlan[] = [
  {
    name: "Starter",
    price: "€49",
    period: "/month incl. VAT",
    desc: "Perfect for small cafés and independent restaurants.",
    staff: "Up to 15 staff",
    highlight: false,
    // Risk reversal, approved by Gabor Aug 2026. The page previously anchored
    // EUR49/month with nothing to soften it: plain "Get Started" CTAs and no
    // trial. With no customer logos to lean on, the first month is the only
    // thing that lets someone say yes without a decision.
    offer: "First month free",
    cta: "Start your first month free",
    features: [
      "Rota scheduling & publishing",
      "Clock in/out with geofencing",
      "Reservations & table management",
      "Menu & specials board",
      "Log book & equipment service register",
      "Bookkeeping & AI receipt scanning",
      "Time-off requests & approvals",
      "Team messaging",
      "Employee profiles",
      "AI booking assistant",
      "POS integration (Square)",
      "Mobile app (iOS & Android)",
      "Email & push notifications",
    ],
  },
  {
    name: "Pro",
    price: "€89",
    period: "/month incl. VAT",
    desc: "For busy restaurants and bars with larger teams.",
    staff: "Up to 30 staff",
    highlight: true,
    offer: "First month free",
    cta: "Start your first month free",
    features: [
      "Everything in Starter",
      "Up to 30 staff members",
      "Guest CRM, loyalty tiers & points",
      "In-house staff training & certification records",
      "Department management",
      "Staff availability management",
      "Payroll summaries",
      "Staffing forecast & AI insights",
      "VAT & P&L dashboard",
      "CSV & data export",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "€215+",
    period: "/month incl. VAT",
    desc: "For multi-venue groups, hotel F&B, and franchises.",
    staff: "Unlimited staff",
    highlight: false,
    offer: null, // custom-priced, handled in conversation
    cta: "Talk to Us",
    features: [
      "Everything in Pro",
      "Unlimited staff & venues",
      "Multi-location management",
      "Custom onboarding & training",
      "Dedicated account manager",
      "Priority support",
      "Custom integrations",
      "Volume discounts available",
    ],
  },
];
