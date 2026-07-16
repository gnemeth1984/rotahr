"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";

const tabs = [
  { href: "/settings/general", label: "Account", roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { href: "/settings/venues", label: "Venues", roles: ["MANAGER", "ADMIN"] },
  { href: "/settings/features", label: "Features & Menu", roles: ["MANAGER", "ADMIN"] },
  { href: "/settings/billing", label: "Billing", roles: ["MANAGER", "ADMIN"] },
  { href: "/settings/pos", label: "POS Integration", roles: ["MANAGER", "ADMIN"] },
  { href: "/settings/email", label: "Email", roles: ["MANAGER", "ADMIN"] },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "EMPLOYEE";

  const visibleTabs = tabs.filter((t) => t.roles.includes(role));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and business settings</p>
      </div>

      {/* Tab nav */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex gap-6">
          {visibleTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "pb-3 text-sm font-medium border-b-2 transition-colors",
                pathname === tab.href || pathname.startsWith(tab.href + "/")
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}
