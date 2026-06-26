"use client";

// Tip / Tronc Management
// Compliance: Payment of Wages (Amendment) (Tips and Gratuities) Act 2022
// All distribution records are permanent for audit purposes.

import { useCurrency } from "@/components/shared/CurrencyProvider";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Coins,
  Plus,
  Check,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Users,
  Clock,
  Equal,
  Sliders,
  BadgeCheck,
  AlertCircle,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TipDistribution {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string };
  hoursWorked: number;
  shareAmount: number;
  customNote?: string | null;
}

interface TipPool {
  id: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  method: string;
  status: string;
  notes?: string | null;
  distributedAt?: string | null;
  distributions: TipDistribution[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMondayISO(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split("T")[0];
}

function getSundayISO(monday: string) {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  return d.toISOString().split("T")[0];
}

const METHOD_LABELS: Record<string, string> = {
  hours: "Pro-rata by hours worked",
  equal: "Equal split",
  custom: "Custom",
};

// ── Explainer card shown when user clicks "What is tronc?" ───────────────────
function TroncExplainerModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">Tips & Tronc — how it works</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 text-sm text-slate-700">
          {/* Tips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">TIPS</span>
              <p className="font-semibold text-slate-900">Direct customer tips</p>
            </div>
            <p>
              Money left directly by a customer to a specific staff member — for example a €10 cash tip left on the table or added to a card payment for the server.
            </p>
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-1">
              <p>✅ Belongs 100% to the employee — the employer cannot keep any of it.</p>
              <p>✅ Cannot be used to top up minimum wage.</p>
              <p>✅ Under the <strong>Payment of Wages (Amendment) (Tips and Gratuities) Act 2022</strong>, all electronic tips must be passed on in full.</p>
            </div>
          </div>

          {/* Tronc */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">TRONC</span>
              <p className="font-semibold text-slate-900">Pooled tip system</p>
            </div>
            <p>
              A <strong>tronc</strong> is when all tips collected over a period are pooled together and then distributed fairly across staff — rather than each person keeping only their own tips.
            </p>
            <p>
              This is common in restaurants and bars because it's more fair — a busy bartender and a quiet floor staff member both contributed to the service.
            </p>
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-xs text-slate-600 space-y-1">
              <p>✅ Run by a <strong>Troncmaster</strong> — usually a senior staff member, not the business owner.</p>
              <p>✅ Keeps tip payments separate from wages for tax purposes.</p>
              <p>✅ If managed correctly, PRSI/National Insurance may not apply to tronc payments.</p>
            </div>
          </div>

          {/* Service charge */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">SERVICE CHARGE</span>
              <p className="font-semibold text-slate-900">The "12.5% added to your bill"</p>
            </div>
            <p>
              A discretionary service charge added to customer bills. Under the 2022 Act, Irish employers <strong>must pass this on to staff</strong> — it cannot be kept by the business for admin costs unless clearly disclosed to customers upfront.
            </p>
          </div>

          {/* How Rotahr handles it */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="font-semibold text-slate-900">How Rotahr handles this</p>
            <p>
              Each week, a manager creates a <strong>tip pool</strong>:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-600">
              <li>Enter the total tips/service charge collected for the period.</li>
              <li>Choose a <strong>distribution method</strong> (see below).</li>
              <li>Click <strong>Distribute</strong> — Rotahr automatically calculates each person's share based on their shifts.</li>
              <li>All records are saved permanently for legal audit purposes.</li>
            </ol>
          </div>

          {/* Methods */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <p className="font-semibold text-slate-900">Distribution methods</p>

            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              <div className="px-4 py-3 flex gap-3">
                <Clock className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800 text-xs">Pro-rata by hours worked <span className="ml-1 text-blue-600 text-[10px] font-bold uppercase">Recommended</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">Each person gets a share proportional to how many hours they worked in the period. Someone who worked 30h gets 3× the share of someone who worked 10h. Most fair and most commonly used.</p>
                </div>
              </div>
              <div className="px-4 py-3 flex gap-3">
                <Equal className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-800 text-xs">Equal split</p>
                  <p className="text-xs text-slate-500 mt-0.5">All staff who worked in the period get an equal share regardless of hours. Simpler, but less fair for part-timers vs full-timers.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            <p className="font-semibold mb-1">Legal requirement</p>
            <p>You are required to display your tip distribution policy to all staff. Rotahr automatically shows this policy on the staff Tips page. Make sure your chosen distribution method matches what's displayed there.</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100">
          <Button size="sm" onClick={onClose} className="w-full">Got it</Button>
        </div>
      </div>
    </div>
  );
}

// ── Staff view ────────────────────────────────────────────────────────────────
function StaffView({ pools, loading, fmt }: { pools: TipPool[]; loading: boolean; fmt: (n: number) => string }) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Coins className="h-6 w-6 text-amber-500" />
          Tips & Tronc
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Your tip distribution information</p>
      </div>

      {/* What is tronc — staff explainer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-700">What is a tronc?</p>
        </div>
        <p className="text-sm text-slate-600">
          Instead of each person keeping only the tips they personally received, a <strong>tronc</strong> pools all tips from a period and distributes them fairly across the whole team based on hours worked. This way everyone — floor staff, bar, kitchen — shares in the tips equally.
        </p>
        <p className="text-sm text-slate-600">
          Your manager creates a tip pool each week. Once distributed, you'll see your share below.
        </p>
      </div>

      {/* Legal policy statement */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <BadgeCheck className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm font-semibold text-amber-800">Our tip distribution policy</p>
        </div>
        <div className="text-sm text-amber-900 space-y-2">
          <p>
            Under the <strong>Payment of Wages (Amendment) (Tips and Gratuities) Act 2022</strong>, your employer is required to display this policy to all staff.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-amber-800">
            <li>All customer tips and service charges are distributed to staff — none are retained by the business.</li>
            <li><strong>Method:</strong> Pro-rata by hours worked in the period — more hours = larger share.</li>
            <li>All staff who worked during a period are included in that period's pool.</li>
            <li>Distributions are calculated and recorded weekly.</li>
            <li>All records are kept permanently for audit purposes.</li>
          </ul>
          <p className="text-xs text-amber-700 mt-2">
            Questions? Speak to your manager or contact the{" "}
            <a href="https://www.workplacerelations.ie" target="_blank" rel="noopener noreferrer" className="underline font-medium">
              Workplace Relations Commission
            </a>.
          </p>
        </div>
      </div>

      {/* Recent distributions */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : pools.filter((p) => p.status === "distributed").length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-12 text-center">
          <Coins className="h-8 w-8 mx-auto mb-2 text-slate-200" />
          <p className="text-slate-500 text-sm">No distributed tip pools yet.</p>
          <p className="text-xs text-slate-400 mt-1">Check back after your manager runs this week's distribution.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent distributions</p>
          {pools
            .filter((p) => p.status === "distributed")
            .map((pool) => (
              <div key={pool.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtDate(pool.periodStart)} – {fmtDate(pool.periodEnd)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Pool total: <strong>{fmt(pool.totalAmount)}</strong> ·{" "}
                      {METHOD_LABELS[pool.method] ?? pool.method}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Distributed
                  </span>
                </div>
                {pool.distributions.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-wide">
                          <th className="text-left py-1 font-semibold">Employee</th>
                          <th className="text-right py-1 font-semibold">Hours</th>
                          <th className="text-right py-1 font-semibold">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pool.distributions.map((d) => (
                          <tr key={d.id}>
                            <td className="py-1.5 text-slate-700">
                              {d.employee.firstName} {d.employee.lastName}
                            </td>
                            <td className="py-1.5 text-right text-slate-500">
                              {d.hoursWorked > 0 ? `${d.hoursWorked}h` : "—"}
                            </td>
                            <td className="py-1.5 text-right font-bold text-slate-900">
                              {fmt(d.shareAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Manager view ──────────────────────────────────────────────────────────────
export default function TipsPage() {
  const { data: session } = useSession();
  const { symbol, fmt } = useCurrency();
  const isManager =
    session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const [pools, setPools] = useState<TipPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showExplainer, setShowExplainer] = useState(false);

  const monday = getMondayISO(new Date());
  const [form, setForm] = useState({
    periodStart: monday,
    periodEnd: getSundayISO(monday),
    totalAmount: "",
    method: "hours",
    notes: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/tips");
    const d = r.ok ? await r.json() : {};
    setPools(d.pools ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createPool() {
    setSaving(true);
    setError("");
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      setError("Enter a valid total tip amount");
      setSaving(false);
      return;
    }
    const r = await fetch("/api/tips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error ?? "Failed");
      setSaving(false);
      return;
    }
    setShowForm(false);
    setForm({ ...form, totalAmount: "", notes: "" });
    setSaving(false);
    load();
  }

  async function distribute(poolId: string) {
    setDistributing(poolId);
    const r = await fetch("/api/tips/distribute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId }),
    });
    setDistributing(null);
    if (!r.ok) {
      const d = await r.json();
      setError(d.error ?? "Distribution failed");
    }
    load();
  }

  if (!isManager) {
    return <StaffView pools={pools} loading={loading} fmt={fmt} />;
  }

  return (
    <>
      {showExplainer && <TroncExplainerModal onClose={() => setShowExplainer(false)} />}

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Coins className="h-6 w-6 text-amber-500" />
              Tips & Tronc
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Pool and distribute staff tips fairly — fully compliant with Irish law.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExplainer(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              How does this work?
            </button>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New pool
              </Button>
            )}
          </div>
        </div>

        {/* Legal compliance notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-amber-800 space-y-1">
            <p className="font-semibold">Irish law compliance</p>
            <p className="text-xs text-amber-700">
              Under the <strong>Payment of Wages (Amendment) (Tips and Gratuities) Act 2022</strong>, you must distribute all customer tips and service charges to staff. You cannot keep tips to cover operational costs. All staff can view your tip policy and distribution history in their Tips page. Records are retained permanently for audit.
            </p>
          </div>
        </div>

        {/* How tip pools work — quick steps */}
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">How it works — 4 simple steps</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              { step: "1", label: "Collect", desc: "Count up all tips + service charges for the week" },
              { step: "2", label: "Create pool", desc: "Enter the total and choose a distribution method" },
              { step: "3", label: "Distribute", desc: "Rotahr auto-calculates each person's share from their shifts" },
              { step: "4", label: "Record kept", desc: "All records saved permanently for legal audit" },
            ].map((s) => (
              <div key={s.step} className="bg-slate-50 rounded-lg px-3 py-3 space-y-1">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mx-auto">
                  {s.step}
                </div>
                <p className="text-xs font-semibold text-slate-800">{s.label}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* New pool form */}
        {showForm && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">New tip pool</h2>
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Period covered</Label>
              <p className="text-xs text-slate-400">The date range these tips were collected. Typically one week (Mon–Sun).</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500">Start date</Label>
                  <Input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500">End date</Label>
                  <Input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">
                Total tips collected ({symbol})
              </Label>
              <p className="text-xs text-slate-400">
                Add up all cash tips, card tips, and service charges collected from customers for this period.
              </p>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.totalAmount}
                onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
                placeholder="e.g. 380.00"
                className="h-9 text-sm"
              />
            </div>

            {/* Method */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-700">Distribution method</Label>
              <p className="text-xs text-slate-400">
                How the pot is split among staff. Choose the method that best reflects your business.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    value: "hours",
                    icon: <Clock className="h-4 w-4 text-blue-500" />,
                    title: "Pro-rata by hours",
                    desc: "Each person's share is proportional to how many hours they worked. Someone who did 30h gets 3× the share of someone who did 10h.",
                    badge: "Recommended",
                  },
                  {
                    value: "equal",
                    icon: <Equal className="h-4 w-4 text-green-500" />,
                    title: "Equal split",
                    desc: "Everyone who worked in the period gets the same amount regardless of hours. Simpler, but less fair for part-timers.",
                    badge: null,
                  },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, method: m.value }))}
                    className={cn(
                      "text-left p-4 rounded-xl border-2 transition-all space-y-1.5",
                      form.method === m.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {m.icon}
                        <span className="text-xs font-semibold text-slate-800">{m.title}</span>
                      </div>
                      {m.badge && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-snug">{m.desc}</p>
                    {form.method === m.value && (
                      <div className="flex items-center gap-1 text-blue-600 text-[11px] font-medium">
                        <Check className="h-3 w-3" /> Selected
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Notes (optional)</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. includes Friday night service charge"
                className="h-8 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={createPool} disabled={saving} className="gap-1.5">
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Create pool
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Pool list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
          </div>
        ) : pools.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
            <Coins className="h-10 w-10 mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-600">No tip pools yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Create your first pool to start distributing tips fairly.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              New pool
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">All tip pools</p>
            {pools.map((pool) => {
              const isExpanded = expanded[pool.id] ?? false;
              const isDraft = pool.status === "draft";

              return (
                <div
                  key={pool.id}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden"
                >
                  {/* Pool header */}
                  <div className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900">
                          {fmtDate(pool.periodStart)} – {fmtDate(pool.periodEnd)}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            isDraft
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {isDraft ? "Draft — not yet distributed" : "Distributed"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Total pool: <strong className="text-slate-700">{fmt(pool.totalAmount)}</strong>
                        {" · "}
                        {METHOD_LABELS[pool.method] ?? pool.method}
                        {pool.distributions.length > 0 &&
                          ` · ${pool.distributions.length} staff members`}
                      </p>
                      {isDraft && (
                        <p className="text-[11px] text-amber-600 mt-1">
                          ↳ Click Distribute to auto-calculate shares from shift data and lock this pool.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isDraft && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-amber-500 hover:bg-amber-600 gap-1"
                          onClick={() => distribute(pool.id)}
                          disabled={distributing === pool.id}
                        >
                          {distributing === pool.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              Distribute
                            </>
                          )}
                        </Button>
                      )}
                      <button
                        onClick={() =>
                          setExpanded((e) => ({ ...e, [pool.id]: !isExpanded }))
                        }
                        className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100">
                      {pool.distributions.length === 0 ? (
                        <div className="px-5 py-5 text-center">
                          <Users className="h-6 w-6 mx-auto mb-2 text-slate-200" />
                          <p className="text-sm text-slate-400">
                            {isDraft
                              ? "No shares calculated yet. Click Distribute to auto-calculate from shift data."
                              : "No distributions recorded for this pool."}
                          </p>
                        </div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                              <th className="text-left px-5 py-2 font-semibold">Employee</th>
                              <th className="text-right px-5 py-2 font-semibold">Hours worked</th>
                              <th className="text-right px-5 py-2 font-semibold">
                                Share ({symbol})
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {pool.distributions.map((d) => (
                              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-5 py-2.5 font-medium text-slate-800">
                                  {d.employee.firstName} {d.employee.lastName}
                                  {d.customNote && (
                                    <span className="ml-1 text-xs text-slate-400">
                                      ({d.customNote})
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-2.5 text-right text-slate-500">
                                  {d.hoursWorked > 0 ? `${d.hoursWorked}h` : "—"}
                                </td>
                                <td className="px-5 py-2.5 text-right font-bold text-slate-900">
                                  {fmt(d.shareAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-amber-50 border-t-2 border-amber-100">
                              <td
                                colSpan={2}
                                className="px-5 py-2.5 font-semibold text-slate-700"
                              >
                                Total distributed
                              </td>
                              <td className="px-5 py-2.5 text-right font-bold text-amber-700">
                                {fmt(
                                  pool.distributions.reduce(
                                    (s, d) => s + d.shareAmount,
                                    0
                                  )
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
