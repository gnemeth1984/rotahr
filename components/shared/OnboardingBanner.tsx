"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRole as Role } from "@/types/roles";

interface OnboardingSteps {
  businessName: boolean;
  departments: boolean;
  employees: boolean;
  hourlyRates: boolean;
  complete: boolean;
}

export function OnboardingBanner() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [steps, setSteps] = useState<OnboardingSteps | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  // Platform admin (no businessId) never needs onboarding
  const isPlatformAdmin =
    session?.user?.role === Role.ADMIN && !(session?.user as any)?.businessId;

  // Don't show on the onboarding page itself
  const isOnOnboarding = pathname === "/onboarding";

  useEffect(() => {
    if (!isManager || isOnOnboarding || isPlatformAdmin) return;
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d) => {
        if (!d.steps?.complete) setSteps(d.steps);
      })
      .catch(() => {});
  }, [isManager, isOnOnboarding]);

  if (!steps || steps.complete || dismissed || isOnOnboarding || isPlatformAdmin) return null;

  const keys = ["businessName", "departments", "employees", "hourlyRates"] as const;
  const completedCount = keys.filter((k) => steps[k]).length;
  const total = keys.length;
  const pct = Math.round((completedCount / total) * 100);

  // Find next incomplete step label
  const stepLabels: Record<string, string> = {
    businessName: "Set business name",
    departments: "Create departments",
    employees: "Add employees",
    hourlyRates: "Set hourly rates",
  };
  const nextKey = keys.find((k) => !steps[k]);
  const nextLabel = nextKey ? stepLabels[nextKey] : null;

  return (
    <div className="bg-blue-600 text-white px-4 py-2.5 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium">
          Setup {completedCount}/{total} complete
          {nextLabel && <span className="font-normal opacity-80"> · Next: {nextLabel}</span>}
        </span>
        {/* Progress bar */}
        <div className="hidden sm:flex flex-1 max-w-32 h-1.5 bg-blue-400 rounded-full overflow-hidden">
          <div className="bg-white rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/onboarding">
          <Button size="sm" variant="secondary" className="h-7 text-xs gap-1 bg-white text-blue-600 hover:bg-blue-50">
            Continue Setup <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded hover:bg-blue-500 transition-colors opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
