"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Calendar,
  Users,
  Clock,
  LogOut,
  Menu,
  X,
  Briefcase,
  BookOpen,
  TableProperties,
  BookMarked,
  Sparkles,
  Utensils,
  ChefHat,
  LayoutDashboard,
  MessageSquare,
  DollarSign,
  CalendarCheck,
  Smartphone,
  HelpCircle,
  Package,
  ArrowRightLeft,
  Coins,
  Award,
  Building2,
  CreditCard,
  RadioTower,
  Settings,
  ShieldCheck,
  ContactRound,
  FileText,
  ClipboardCheck,
  Newspaper,
  BarChart2,
  NotebookPen,
  Wrench,
  Megaphone,
  ScanLine,
  Sun,
  Compass,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { Role } from "@/types/roles";
import { useState, useEffect } from "react";
import { BellButton } from "@/components/shared/BellButton";
import { VenueSwitcher } from "@/components/shared/VenueSwitcher";
import { useFeatureFlags } from "@/components/shared/FeatureFlagsProvider";
import type { FeatureKey } from "@/lib/features";

// null = all plans; array = only those plans (platform ADMIN always bypasses)
// platformAdminOnly: true  = only shown when businessId is null (platform super-admin)
// omitted/false = hidden for platform admin (business-specific pages)
const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "dashboard" as FeatureKey,
    plans: null,
  },
  {
    href: "/today",
    label: "Today",
    icon: Sun,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
  },
  {
    href: "/rota",
    label: "Rota",
    icon: TableProperties,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "rota" as FeatureKey,
    plans: null,
  },
  {
    href: "/timeoff",
    label: "Time Off",
    icon: Clock,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "timeoff" as FeatureKey,
    plans: null,
  },
  {
    href: "/clock",
    label: "Clock",
    icon: Clock,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "clock" as FeatureKey,
    plans: null,
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessageSquare,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "messages" as FeatureKey,
    plans: null,
  },
  {
    href: "/shift-swaps",
    label: "Shift Swaps",
    icon: ArrowRightLeft,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "shiftswaps" as FeatureKey,
    plans: null,
  },
  {
    href: "/log-book",
    label: "Log Book",
    icon: NotebookPen,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: "logbook",
    featureKey: "logbook" as FeatureKey,
    plans: null,
  },
  {
    href: "/bookings",
    label: "Bookings",
    icon: BookOpen,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: "bookings",
    featureKey: "bookings" as FeatureKey,
    plans: null,
  },
  {
    href: "/menu-specials",
    label: "Menu & Planning",
    icon: Utensils,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "menu-specials" as FeatureKey,
    plans: null,
  },
  {
    href: "/social-post",
    label: "Social Posts",
    icon: Megaphone,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
  },
  {
    href: "/bookkeeping",
    label: "Bookkeeping",
    icon: BookMarked,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: "bookkeeping",
    featureKey: "bookkeeping" as FeatureKey,
    plans: null,
  },
  {
    href: "/employees",
    label: "Employees",
    icon: Users,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "employees" as FeatureKey,
    plans: null,
  },
  {
    href: "/haccp",
    label: "HACCP",
    icon: ClipboardCheck,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "haccp" as FeatureKey,
    plans: null,
  },
  // ── Pro & above ─────────────────────────────────────────────────────────
  {
    href: "/availability",
    label: "Availability",
    icon: CalendarCheck,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "availability" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: DollarSign,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: "payroll",
    featureKey: "payroll" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/reports",
    label: "Reports & Insights",
    icon: BarChart2,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: "reports",
    featureKey: "reports" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/stock",
    label: "Stock & Orders",
    icon: Package,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: "stocktaking",
    featureKey: "stock" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/recipes",
    label: "Recipe Costing",
    icon: ChefHat,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "stock" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/tips",
    label: "Tips & Tronc",
    icon: Coins,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: "tips",
    featureKey: "tips" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/crm",
    label: "Customer CRM",
    icon: ContactRound,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/scan",
    label: "Scan Offer",
    icon: ScanLine,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: ["pro", "enterprise"],
  },
  {
    href: "/training",
    label: "Training & Certs",
    icon: Award,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: "training",
    featureKey: "training" as FeatureKey,
    plans: ["pro", "enterprise"],
  },
  // ── Enterprise only ──────────────────────────────────────────────────────
  {
    href: "/venues",
    label: "Venues",
    icon: Building2,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: ["enterprise"],
  },
  // ── Always visible (plan-agnostic) ───────────────────────────────────────
  {
    href: "/ai",
    label: "AI Tools",
    icon: Sparkles,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: "ai" as FeatureKey,
    plans: null,
  },
  // ── Platform ADMIN only (Gabor — no businessId) ──────────────────────────
  {
    // The standalone /outreach page never existed in this app — it lived on the
    // now-dead Railway service, so this link 404'd. Outreach is a tab on /admin.
    href: "/admin?tab=outreach",
    label: "Email Outreach",
    icon: RadioTower,
    roles: [Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
    platformAdminOnly: true,
  },
  {
    href: "/navigator",
    label: "Navigator",
    icon: Compass,
    roles: [Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
    platformAdminOnly: true,
  },
  {
    href: "/admin",
    label: "Platform Admin",
    icon: ShieldCheck,
    roles: [Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
    platformAdminOnly: true,
  },
  {
    href: "/blog",
    label: "Blog",
    icon: Newspaper,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
  },
];

// Settings live beside the avatar at the bottom, not in the main nav list —
// that is where people look for them, and it keeps the nav about the work.
// Filtered through exactly the same role/plan/flag predicate as navItems.
const footerNavItems = [
  {
    href: "/settings/general",
    label: "Account",
    icon: Settings,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
  },
  {
    href: "/settings/billing",
    label: "Billing",
    icon: CreditCard,
    roles: [Role.MANAGER, Role.ADMIN],
    permission: null,
    featureKey: null,
    plans: null,
  },
];

// The nav used to be one flat 26-item list ordered by the sequence features
// shipped in, which scattered related pages (Rota at 3, Availability at 15).
// Groups are ordered by job-to-be-done, and `hrefs` fixes the order WITHIN a
// group so it no longer depends on where an item happens to sit in navItems.
// Anything visible but not listed here falls into "More" rather than vanishing,
// so adding a nav item and forgetting to group it can never hide it.
const NAV_GROUPS: { id: string; label: string; hrefs: string[] }[] = [
  {
    id: "daily",
    label: "Daily",
    hrefs: ["/dashboard", "/today", "/clock", "/messages", "/log-book"],
  },
  {
    id: "team",
    label: "Rota & team",
    hrefs: ["/rota", "/availability", "/shift-swaps", "/timeoff", "/employees", "/training"],
  },
  {
    id: "service",
    label: "Service",
    hrefs: ["/bookings", "/menu-specials", "/social-post", "/scan", "/crm"],
  },
  {
    id: "kitchen",
    label: "Kitchen & stock",
    hrefs: ["/haccp", "/stock", "/recipes"],
  },
  {
    id: "money",
    label: "Money",
    hrefs: ["/bookkeeping", "/payroll", "/tips", "/reports"],
  },
  {
    id: "business",
    label: "Business",
    hrefs: ["/venues", "/ai", "/blog"],
  },
  {
    id: "platform",
    label: "Platform",
    hrefs: ["/navigator", "/admin", "/admin?tab=outreach"],
  },
];

const NAV_COLLAPSE_KEY = "rotahr.nav.collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { flags } = useFeatureFlags();
  // Stores which groups are COLLAPSED, so the default ({}) is everything open
  // and the server render matches the first client paint — no hydration flash.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_COLLAPSE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);

  const userRole = (session?.user?.role ?? Role.EMPLOYEE) as Role;
  const userPermissions: string[] = (session?.user as any)?.permissions ?? [];
  const lsPlan: string | null = (session?.user as any)?.lsPlan ?? null;
  const isManager = userRole === Role.MANAGER || userRole === Role.ADMIN;
  // Real platform-level super-admin (Gabor only) — derived server-side from
  // the SUPER_ADMINS email allowlist, never from role/businessId (every
  // business owner is also role: ADMIN within their own business).
  const isPlatformAdmin = Boolean((session?.user as any)?.isPlatformAdmin);

  const canSee = (item: any) => {
    // platformAdminOnly items only shown to the real platform super-admin
    if ((item as any).platformAdminOnly && !isPlatformAdmin) return false;

    // Role check — platform admin bypasses everything
    if (isPlatformAdmin) return true;

    const roleAllowed = item.roles.includes(userRole) ||
      (!isManager && item.permission && userPermissions.includes(item.permission));
    if (!roleAllowed) return false;

    // Plan gate
    if (item.plans) {
      if (!lsPlan || !item.plans.includes(lsPlan)) return false;
    }

    // Feature flag check
    if (item.featureKey && flags) {
      const flag = flags[item.featureKey as FeatureKey];
      if (flag) {
        if (!flag.enabled) return false;
        if (!flag.roles.includes(userRole)) return false;
      }
    }

    return true;
  };

  const visibleItems = navItems.filter(canSee);
  const visibleFooterItems = footerNavItems.filter(canSee);

  const isActiveHref = (href: string) => {
    // Query-string hrefs (/admin?tab=outreach) never highlight — otherwise they
    // would light up on plain /admin too, since we deliberately avoid
    // useSearchParams here (it would need a Suspense boundary in the layout).
    if (href.includes("?")) return false;
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Build the groups, dropping any that ended up empty for this user's plan and
  // role, then sweep up anything ungrouped so it can never silently disappear.
  const grouped = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.hrefs
      .map((h) => visibleItems.find((i) => i.href === h))
      .filter(Boolean) as typeof visibleItems,
  })).filter((g) => g.items.length > 0);

  const groupedHrefs = new Set(NAV_GROUPS.flatMap((g) => g.hrefs));
  const ungrouped = visibleItems.filter((i) => !groupedHrefs.has(i.href));
  if (ungrouped.length > 0) {
    grouped.push({ id: "more", label: "More", hrefs: [], items: ungrouped });
  }

  const toggleGroup = (id: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const sidebarInner = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Logo — logo always visible; bell on right; X close button on mobile only */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* On mobile: leave gap for the hamburger button (top-left, 44px wide) */}
          <div className="lg:hidden w-8 flex-shrink-0" />
          <Image src="/logo-dark.png" alt="Rotahr" width={100} height={32} className="object-contain flex-shrink-0" priority />
        </div>
        <div className="flex items-center gap-2">
          <BellButton />
          {/* Close button on mobile — right side so it doesn't cover logo */}
          <button
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Venue switcher — only shows if multi-venue */}
      <div className="px-2 py-1.5 border-b border-slate-700">
        <VenueSwitcher />
      </div>

      {/* Nav — grouped by job, collapsible, scrollable on small phones */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {grouped.map((group) => {
          const hasActive = group.items.some((i) => isActiveHref(i.href));
          // The group you are currently inside is forced open — collapsing the
          // page you are on would hide where you are.
          const open = hasActive || !collapsed[group.id];
          return (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <span className="truncate">{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150",
                    open ? "" : "-rotate-90"
                  )}
                />
              </button>
              {open && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActiveHref(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "text-slate-400 hover:bg-slate-700 hover:text-white"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User — extra bottom padding on mobile to clear phone nav bar */}
      <div className="px-3 py-2 border-t border-slate-700 pb-safe flex-shrink-0" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
        <div className="flex items-center gap-3 px-3 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={session?.user?.image ?? ""} />
            <AvatarFallback className="bg-blue-600 text-white text-xs">
              {getInitials(session?.user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {(session?.user?.role ?? "employee").toLowerCase()}
            </p>
          </div>
        </div>
        {visibleFooterItems.map((item) => {
          const Icon = item.icon;
          const isActive = isActiveHref(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors mb-1",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href="/install"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors mb-1"
          onClick={() => setMobileOpen(false)}
        >
          <Smartphone className="h-4 w-4" />
          Get the App
        </Link>
        {/* Opens the help assistant. The floating button tucks itself away
            after a few seconds so it stops covering page buttons, so help
            needs a permanent home that is never in the way. */}
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors mb-1"
          onClick={() => {
            setMobileOpen(false);
            window.dispatchEvent(new Event("rotahr:help-open"));
          }}
        >
          <HelpCircle className="h-4 w-4" />
          Help
        </button>
        {/* Legal links */}
        <div className="flex gap-3 px-3 py-1 mb-1">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Privacy
          </a>
          <span className="text-slate-600 text-xs">·</span>
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">
            Terms
          </a>
        </div>
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle — only shows hamburger (X is inside sidebar header now) */}
      {!mobileOpen && (
        <button
          className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 p-2.5 rounded-lg text-white shadow-lg"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 transform transition-transform duration-200 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarInner}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 bg-slate-900">
        {sidebarInner}
      </aside>
    </>
  );
}
