"use client";

import { useEffect, useState } from "react";
import { DollarSign, ChevronLeft, ChevronRight, Download, FileSpreadsheet, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

type PayrollRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  hourlyRate: number;
  totalHours: number;
  totalPay: number;
  shiftCount: number;
  belowNMW?: boolean;
};

type PayrollData = {
  weekStart: string;
  weekEnd: string;
  rows: PayrollRow[];
  grandTotal: number;
  nmwWarnings?: string[];
  grossOnly?: boolean;
};

function getMondayISO(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

export default function PayrollPage() {
  const [data, setData] = useState<PayrollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [monday, setMonday] = useState(() => {
    const now = new Date();
    return getMondayISO(now);
  });

  useEffect(() => {
    setLoading(true);
    fetch(`/api/payroll?week=${monday}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [monday]);

  function prevWeek() {
    const d = new Date(monday);
    d.setDate(d.getDate() - 7);
    setMonday(d.toISOString().split("T")[0]);
  }

  function nextWeek() {
    const d = new Date(monday);
    d.setDate(d.getDate() + 7);
    setMonday(d.toISOString().split("T")[0]);
  }

  function exportCSV() {
    if (!data) return;
    const header = ["Name", "Shifts", "Total Hours", "Hourly Rate (€)", "Total Pay (€)"];
    const rows = data.rows.map((r) => [
      `${r.firstName} ${r.lastName}`,
      r.shiftCount,
      r.totalHours,
      r.hourlyRate.toFixed(2),
      r.totalPay.toFixed(2),
    ]);
    rows.push(["TOTAL", "", "", "", data.grandTotal.toFixed(2)]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${monday}.csv`;
    a.click();
  }

  function exportBrightPay() {
    window.location.href = `/api/payroll/brightpay?week=${monday}`;
  }

  const weekLabel = data
    ? `${new Date(data.weekStart).toLocaleDateString("en-IE", { day: "numeric", month: "short" })} – ${new Date(data.weekEnd).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}`
    : monday;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-blue-500" />
            Payroll
          </h1>
          <p className="text-slate-500 mt-1">Weekly pay summary</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportCSV} variant="outline" size="sm" disabled={!data || data.rows.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={exportBrightPay} variant="outline" size="sm" disabled={!data || data.rows.length === 0} className="border-emerald-200 text-emerald-700 hover:bg-emerald-50">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            BrightPay Export
          </Button>
        </div>
      </div>

      {/* Week navigator */}
      <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-6 py-4">
        <Button variant="ghost" size="icon" onClick={prevWeek}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-semibold text-slate-900">{weekLabel}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={nextWeek}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Gross-only disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-3 text-sm">
        <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-blue-800">
          <strong>Gross pay only.</strong> PAYE, PRSI, and USC deductions must be calculated via BrightPay or equivalent payroll software before paying employees. Use the BrightPay Export button to transfer data.
        </p>
      </div>

      {/* NMW warnings */}
      {data?.nmwWarnings && data.nmwWarnings.length > 0 && (
        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              National Minimum Wage — {data.nmwWarnings.length} alert{data.nmwWarnings.length > 1 ? "s" : ""}
            </p>
          </div>
          {data.nmwWarnings.map((w, i) => (
            <p key={i} className="text-xs text-red-700 pl-6">{w}</p>
          ))}
          <p className="text-xs text-red-500 pl-6 mt-1">
            Irish NMW is €13.50/hr from 1 January 2025 (National Minimum Wage Act 2000 as amended). Update the employee's rate in their profile.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading…</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <DollarSign className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No shifts recorded this week</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Shifts
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Hours
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Rate/hr
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Pay
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.employeeId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {row.firstName} {row.lastName}
                  </td>
                  <td className="px-6 py-4 text-right text-slate-600">{row.shiftCount}</td>
                  <td className="px-6 py-4 text-right text-slate-600">{row.totalHours}h</td>
                  <td className="px-6 py-4 text-right text-slate-600">
                    {row.hourlyRate > 0 ? `€${row.hourlyRate.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-slate-900">
                    <div className="flex items-center justify-end gap-2">
                      {row.belowNMW && (
                        <span title="Below Irish NMW €13.50/hr">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                        </span>
                      )}
                      {row.hourlyRate > 0 ? `€${row.totalPay.toFixed(2)}` : "—"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50 border-t-2 border-blue-200">
                <td colSpan={4} className="px-6 py-4 font-bold text-slate-900">
                  Weekly Total
                </td>
                <td className="px-6 py-4 text-right font-bold text-blue-700 text-lg">
                  €{data.grandTotal.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
