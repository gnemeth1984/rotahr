"use client";

// Tip / Tronc Management
// Compliance: Payment of Wages (Amendment) (Tips and Gratuities) Act 2022
// All distribution records are permanent for audit purposes.

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Coins, Plus, Check, Loader2, Info, ChevronDown, ChevronUp, FileText } from "lucide-react";
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
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
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

export default function TipsPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  const [pools, setPools] = useState<TipPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [distributing, setDistributing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // New pool form
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

  useEffect(() => { load(); }, []);

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
    if (!r.ok) { setError(d.error ?? "Failed"); setSaving(false); return; }
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
    if (!r.ok) { const d = await r.json(); setError(d.error ?? "Distribution failed"); }
    load();
  }

  // Staff view — show tip policy statement (required by Tips Act 2022)
  if (!isManager) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 py-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" />
            Tips & Tronc
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Your tip distribution information</p>
        </div>

        {/* Legal policy statement — required by Payment of Wages (Amendment) (Tips & Gratuities) Act 2022 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-800">Tip Distribution Policy</p>
          </div>
          <div className="text-sm text-amber-900 space-y-2">
            <p>
              Under the <strong>Payment of Wages (Amendment) (Tips and Gratuities) Act 2022</strong>, your employer is required to display this tip policy to all staff.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-sm text-amber-800">
              <li>All customer tips and service charges collected are distributed to staff — none are retained by the business for operational costs.</li>
              <li><strong>Primary method:</strong> Pro-rata by hours worked in the period.</li>
              <li>Distributions are calculated and recorded weekly.</li>
              <li>All staff who worked during a period are included in that period's tip pool.</li>
              <li>Managers do not receive a share of tronc pools unless they also worked service hours.</li>
              <li>Records of all tip distributions are retained for audit purposes in accordance with the Act.</li>
            </ul>
            <p className="text-xs text-amber-700 mt-1">
              If you have questions about tip distributions, speak to your manager or contact <a href="mailto:support@rotahr.com" className="underline">support@rotahr.com</a>. You may also contact the Workplace Relations Commission (WRC) at <a href="https://www.workplacerelations.ie" target="_blank" rel="noopener noreferrer" className="underline">workplacerelations.ie</a>.
            </p>
          </div>
        </div>

        {/* Recent distributions visible to staff */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
        ) : pools.filter((p) => p.status === "distributed").length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl py-12 text-center">
            <Coins className="h-8 w-8 mx-auto mb-2 text-slate-200" />
            <p className="text-slate-500 text-sm">No distributed tip pools yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Recent distributions</p>
            {pools.filter((p) => p.status === "distributed").map((pool) => (
              <div key={pool.id} className="bg-white border border-slate-200 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtDate(pool.periodStart)} – {fmtDate(pool.periodEnd)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total pool: <strong>€{pool.totalAmount.toFixed(2)}</strong> · {METHOD_LABELS[pool.method] ?? pool.method}
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
                          <th className="text-left py-1 font-medium">Employee</th>
                          <th className="text-right py-1 font-medium">Hours</th>
                          <th className="text-right py-1 font-medium">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {pool.distributions.map((d) => (
                          <tr key={d.id}>
                            <td className="py-1.5 text-slate-700">{d.employee.firstName} {d.employee.lastName}</td>
                            <td className="py-1.5 text-right text-slate-500">{d.hoursWorked > 0 ? `${d.hoursWorked}h` : "—"}</td>
                            <td className="py-1.5 text-right font-semibold text-slate-800">€{d.shareAmount.toFixed(2)}</td>
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Coins className="h-6 w-6 text-amber-500" />
            Tips & Tronc
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage and distribute tip pools fairly across staff.
          </p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New pool
          </Button>
        )}
      </div>

      {/* Compliance notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3 text-sm">
        <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-amber-800 space-y-1">
          <p>
            Under the <strong>Payment of Wages (Amendment) (Tips and Gratuities) Act 2022</strong>, Irish employers must distribute customer tips and service charges fairly and transparently. All distribution records must be retained.
          </p>
          <p className="text-xs text-amber-700">
            You are also legally required to display your tip distribution policy to all staff. The policy statement is visible to all team members in their Tips page. Ensure your distribution method is kept up to date.
          </p>
        </div>
      </div>

      {/* New pool form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-800">New tip pool</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Period start</Label>
              <Input type="date" value={form.periodStart} onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period end</Label>
              <Input type="date" value={form.periodEnd} onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))} className="h-8 text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Total tips collected (€)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.totalAmount}
              onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
              placeholder="e.g. 380.00"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Distribution method</Label>
            <select
              value={form.method}
              onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              className="w-full h-8 text-sm border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="hours">Pro-rata by hours worked (recommended)</option>
              <option value="equal">Equal split</option>
            </select>
            <p className="text-xs text-slate-400">
              {form.method === "hours"
                ? "Each employee receives a share proportional to their hours worked in the period."
                : "All employees who worked in the period receive an equal share."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. includes Friday service charge"
              className="h-8 text-sm"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={createPool} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create pool"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setError(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Pool list */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>
      ) : pools.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
          <Coins className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-600">No tip pools yet</p>
          <p className="text-sm text-slate-400 mt-1">Create a pool to start distributing tips fairly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map((pool) => {
            const isExpanded = expanded[pool.id] ?? false;
            return (
              <div key={pool.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {/* Pool header */}
                <div className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-900">
                        {fmtDate(pool.periodStart)} – {fmtDate(pool.periodEnd)}
                      </p>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        pool.status === "distributed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {pool.status === "distributed" ? "Distributed" : "Draft"}
                      </span>
                      <span className="text-xs text-slate-400">{METHOD_LABELS[pool.method] ?? pool.method}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Total: <strong className="text-slate-700">€{pool.totalAmount.toFixed(2)}</strong>
                      {pool.distributions.length > 0 && ` · ${pool.distributions.length} staff`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {pool.status === "draft" && (
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-amber-500 hover:bg-amber-600"
                        onClick={() => distribute(pool.id)}
                        disabled={distributing === pool.id}
                      >
                        {distributing === pool.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <><Check className="h-3 w-3 mr-1" />Distribute</>}
                      </Button>
                    )}
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [pool.id]: !isExpanded }))}
                      className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Distribution breakdown */}
                {isExpanded && (
                  <div className="border-t border-slate-100">
                    {pool.distributions.length === 0 ? (
                      <p className="px-5 py-4 text-sm text-slate-400">
                        {pool.status === "draft"
                          ? "Click Distribute to auto-calculate shares based on hours worked."
                          : "No distributions recorded."}
                      </p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                            <th className="text-left px-5 py-2 font-semibold">Employee</th>
                            <th className="text-right px-5 py-2 font-semibold">Hours</th>
                            <th className="text-right px-5 py-2 font-semibold">Share (€)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pool.distributions.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-2.5 font-medium text-slate-800">
                                {d.employee.firstName} {d.employee.lastName}
                                {d.customNote && <span className="ml-1 text-xs text-slate-400">({d.customNote})</span>}
                              </td>
                              <td className="px-5 py-2.5 text-right text-slate-500">{d.hoursWorked > 0 ? `${d.hoursWorked}h` : "—"}</td>
                              <td className="px-5 py-2.5 text-right font-bold text-slate-900">€{d.shareAmount.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-amber-50 border-t-2 border-amber-100">
                            <td colSpan={2} className="px-5 py-2.5 font-semibold text-slate-700">Total distributed</td>
                            <td className="px-5 py-2.5 text-right font-bold text-amber-700">
                              €{pool.distributions.reduce((s, d) => s + d.shareAmount, 0).toFixed(2)}
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
  );
}
