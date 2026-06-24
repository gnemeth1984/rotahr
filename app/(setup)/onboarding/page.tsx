"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, ArrowRight, Building2, Users, DollarSign, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Steps = {
  businessName: boolean;
  departments: boolean;
  employees: boolean;
  hourlyRates: boolean;
  complete: boolean;
};

type Business = { id: string; name: string; onboardingComplete: boolean } | null;

const STEPS = [
  { key: "businessName", label: "Business Name", icon: Building2, desc: "Set your business name" },
  { key: "departments", label: "Departments", icon: Layers, desc: "Create at least one department" },
  { key: "employees", label: "Add Employees", icon: Users, desc: "Add your first team members" },
  { key: "hourlyRates", label: "Hourly Rates", icon: DollarSign, desc: "Set pay rates for employees" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<Steps | null>(null);
  const [business, setBusiness] = useState<Business>(null);
  const [loading, setLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [saving, setSaving] = useState(false);

  async function fetchState() {
    const d = await fetch("/api/onboarding").then((r) => r.json());
    setSteps(d.steps);
    setBusiness(d.business ?? null);
    setBusinessName(d.business?.name ?? "");
    if (d.business?.onboardingComplete) {
      router.push("/dashboard");
      return;
    }
    const keys = ["businessName", "departments", "employees", "hourlyRates"] as const;
    const idx = keys.findIndex((k) => !d.steps?.[k]);
    setActiveStep(idx === -1 ? 3 : idx);
    setLoading(false);
  }

  useEffect(() => {
    fetchState();
  }, []);

  const completedCount = steps
    ? ["businessName", "departments", "employees", "hourlyRates"].filter(
        (k) => steps[k as keyof Steps]
      ).length
    : 0;

  async function saveBusinessName() {
    if (!businessName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: businessName.trim() }),
    });
    const data = await res.json();

    // If a new business was just created (Google OAuth user), reload the session
    // by doing a soft page refresh so the JWT picks up the new businessId
    if (data.newBusiness) {
      // Force session refresh — navigate to the same page via router
      window.location.href = "/onboarding";
      return;
    }

    await fetchState();
    setSaving(false);
    setActiveStep(1);
  }

  async function completeOnboarding() {
    setSaving(true);
    await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    });
    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-400">Setting up your workspace…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="text-xl font-bold text-slate-900">Rotahr</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Welcome! Let's get you set up</h1>
          <p className="text-slate-500 mt-2">
            Takes about 5 minutes. You can skip steps and come back later.
          </p>
          {/* Progress bar */}
          <div className="mt-6 bg-slate-200 rounded-full h-2 w-full max-w-sm mx-auto">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 4) * 100}%` }}
            />
          </div>
          <p className="text-sm text-slate-400 mt-2">{completedCount} of 4 steps complete</p>
        </div>

        {/* Steps list */}
        <div className="space-y-4 mb-8">
          {STEPS.map((step, idx) => {
            const done = steps?.[step.key as keyof Steps] ?? false;
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <div
                key={step.key}
                className={`bg-white rounded-xl border p-5 transition-all cursor-pointer ${
                  isActive ? "border-blue-300 shadow-md" : "border-slate-200 hover:border-slate-300"
                }`}
                onClick={() => setActiveStep(idx)}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done ? "bg-green-100" : isActive ? "bg-blue-100" : "bg-slate-100"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Icon
                        className={`h-5 w-5 ${isActive ? "text-blue-600" : "text-slate-400"}`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{step.label}</p>
                      {done && (
                        <span className="text-xs text-green-600 font-medium">✓ Done</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500">{step.desc}</p>
                  </div>
                </div>

                {/* Expanded step content */}
                {isActive && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {idx === 0 && (
                      <div className="space-y-3">
                        <Label>Business Name</Label>
                        <div className="flex gap-2">
                          <Input
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="e.g. Christy's Bar"
                            onKeyDown={(e) => e.key === "Enter" && saveBusinessName()}
                            autoFocus
                          />
                          <Button
                            onClick={saveBusinessName}
                            disabled={saving || !businessName.trim()}
                            className="bg-blue-500 hover:bg-blue-600 whitespace-nowrap"
                          >
                            {saving ? "Saving…" : done ? "Update" : "Save & Continue"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {idx === 1 && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Create departments to organise your team (e.g. Bar, Kitchen, Front of House).
                        </p>
                        <Button
                          onClick={() => router.push("/employees?tab=departments")}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Go to Departments <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                    {idx === 2 && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Add your team members so they can log in and view their schedules.
                        </p>
                        <Button
                          onClick={() => router.push("/employees")}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Go to Employees <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                    {idx === 3 && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                          Set hourly rates for your employees to enable payroll calculations.
                        </p>
                        <Button
                          onClick={() => router.push("/employees")}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          Edit Employee Rates <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Skip / Complete */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-slate-400 hover:text-slate-600 underline underline-offset-2"
          >
            Skip for now
          </button>
          {completedCount === 4 && (
            <Button
              onClick={completeOnboarding}
              disabled={saving}
              size="lg"
              className="bg-green-500 hover:bg-green-600 text-white px-8"
            >
              {saving ? "Setting up…" : "Launch Rotahr 🚀"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
