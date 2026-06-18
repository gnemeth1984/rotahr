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
  LayoutDashboard,
  MessageSquare,
  DollarSign,
  CalendarCheck,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { Role } from "@/types/roles";
import { useState } from "react";
import { BellButton } from "@/components/shared/BellButton";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/shifts",
    label: "Shifts",
    icon: Calendar,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/timeoff",
    label: "Time Off",
    icon: Clock,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/bookings",
    label: "Bookings",
    icon: BookOpen,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/rota",
    label: "Rota",
    icon: TableProperties,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/messages",
    label: "Messages",
    icon: MessageSquare,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/clock",
    label: "Clock",
    icon: Clock,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/availability",
    label: "Availability",
    icon: CalendarCheck,
    roles: [Role.EMPLOYEE, Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/bookkeeping",
    label: "Bookkeeping",
    icon: BookMarked,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/payroll",
    label: "Payroll",
    icon: DollarSign,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/employees",
    label: "Employees",
    icon: Users,
    roles: [Role.MANAGER, Role.ADMIN],
  },
  {
    href: "/ai",
    label: "AI Tools",
    icon: Sparkles,
    roles: [Role.MANAGER, Role.ADMIN],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = (session?.user?.role ?? Role.EMPLOYEE) as Role;
  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const sidebarInner = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Image src="/logo-dark.png" alt="Rotahr" width={110} height={36} className="object-contain" priority />
        </div>
        <BellButton />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-700">
        <div className="flex items-center gap-3 px-3 mb-3">
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
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors mb-1"
        >
          <Smartphone className="h-4 w-4" />
          Get the App
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-700"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden bg-slate-800 p-2 rounded-lg text-white"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

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
