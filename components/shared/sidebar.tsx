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
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { Role } from "@/types/roles";
import { useState } from "react";
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
  // ── Platform ADMIN only (Gabor — no businessId) ──────────────────────────
  {
    href: "/outreach",
    label: "Email Outreach",
    icon: RadioTower,
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

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { flags } = useFeatureFlags();

  const userRole = (session?.user?.role ?? Role.EMPLOYEE) as Role;
  const userPermissions: string[] = (session?.user as any)?.permissions ?? [];
  const lsPlan: string | null = (session?.user as any)?.lsPlan ?? null;
  const isManager = userRole === Role.MANAGER || userRole === Role.ADMIN;
  // Real platform-level super-admin (Gabor only) — derived server-side from
  // the SUPER_ADMINS email allowlist, never from role/businessId (every
  // business owner is also role: ADMIN within their own business).
  const isPlatformAdmin = Boolean((session?.user as any)?.isPlatformAdmin);

  const visibleItems = navItems.filter((item) => {
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
      const flag = flags[item.featureKey];
      if (flag) {
        if (!flag.enabled) return false;
        if (!flag.roles.includes(userRole)) return false;
      }
    }

    return true;
  });

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

      {/* Nav — scrollable so all items reachable on small phones */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
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
        <Link
          href="/install"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors mb-1"
          onClick={() => setMobileOpen(false)}
        >
          <Smartphone className="h-4 w-4" />
          Get the App
        </Link>
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
