/**
 * The demo logins, in one place.
 *
 * Shared by the demo chooser at /try and the demo panel on /auth/signin, so the
 * two can never drift apart. Badge classes are light-theme (both pages match the
 * landing page now) — see components on each page for layout.
 *
 * These are seeded by scripts/seed-demo.ts and rebuilt by the scheduled reset
 * (vercel.json → /api/demo/reset). Passwords are public on purpose: the whole
 * point is that a visitor gets in without signing up.
 */

export const DEMO_PASSWORD = "Demo1234!";

export type DemoOwnerAccount = {
  plan: string;
  business: string;
  detail: string;
  blurb: string;
  email: string;
  password: string;
  badge: string;
  dot: string;
};

export type DemoStaffAccount = {
  role: string;
  name: string;
  email: string;
  password: string;
  badge: string;
};

/** Owner view — what a paying customer sees on each plan tier. */
export const DEMO_OWNER_ACCOUNTS: DemoOwnerAccount[] = [
  {
    plan: "Starter",
    business: "The Corner Café",
    detail: "4 staff · 1 venue",
    blurb: "A small café. Rotas, bookings and receipts, nothing heavier.",
    email: "owner.starter@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  {
    plan: "Pro",
    business: "Bloom Bistro",
    detail: "18 staff · 1 venue",
    blurb: "A busy restaurant mid-week. The fullest picture of the product.",
    email: "owner.pro@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  {
    plan: "Enterprise",
    business: "Harrington Group",
    detail: "20+ staff · 3 venues",
    blurb: "A multi-venue group. Cross-venue rotas and group reporting.",
    email: "owner.enterprise@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
];

/** Staff view — The Anchor & Tap, one account per role. */
export const DEMO_STAFF_ACCOUNTS: DemoStaffAccount[] = [
  {
    role: "General Manager",
    name: "Sarah Connolly",
    email: "sarah.connolly@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-purple-50 text-purple-700 border-purple-200",
  },
  {
    role: "Operations Mgr",
    name: "Tony Brennan",
    email: "tony.brennan@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    role: "Head Chef",
    name: "Marco De Luca",
    email: "marco.deluca@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-green-50 text-green-700 border-green-200",
  },
  {
    role: "Bar Manager",
    name: "Fiona McCarthy",
    email: "fiona.mccarthy@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    role: "Bartender",
    name: "Tommy Ryan",
    email: "tommy.ryan@rotahr.demo",
    password: DEMO_PASSWORD,
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
];
