"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt,
  Plus,
  Loader2,
  Download,
  Upload,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Sparkles,
  TrendingDown,
  Euro,
  FileText,
  ImageIcon,
  Clock,
  X,
} from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  amount: number;
  vatAmount: number;
  currency: string;
  vendor: string | null;
  category: string;
  date: string;
  description: string | null;
  paymentMethod: string | null;
  status: string;
  receiptUrl: string | null;
  receiptDataUrl: string | null;
  receiptExpiresAt: string | null;
  aiRawText: string | null;
  employeeId: string | null;
  employee?: { id: string; firstName: string; lastName: string } | null;
}

interface Summary {
  total: number;
  totalVat: number;
  byCategory: Record<string, number>;
  count: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "wages", label: "Staff Wages & Overtime", color: "bg-blue-100 text-blue-700" },
  { value: "supplier", label: "Supplier Invoices", color: "bg-purple-100 text-purple-700" },
  { value: "food_beverage", label: "Food & Beverage", color: "bg-amber-100 text-amber-700" },
  { value: "utilities", label: "Utilities", color: "bg-cyan-100 text-cyan-700" },
  { value: "equipment", label: "Equipment & Maintenance", color: "bg-orange-100 text-orange-700" },
  { value: "general", label: "General Business", color: "bg-slate-100 text-slate-700" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "direct_debit", label: "Direct Debit" },
];

const EMPTY_FORM = {
  vendor: "",
  amount: "",
  vatAmount: "",
  category: "general",
  date: new Date().toISOString().split("T")[0],
  description: "",
  paymentMethod: "card",
  status: "confirmed",
  receiptUrl: "",
  receiptDataUrl: "",
  receiptExpiresAt: "",
  aiRawText: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `€${n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-IE", { month: "long", year: "numeric" });
}

function getCatColor(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-slate-100 text-slate-700";
}

function getCatLabel(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function startOfMonth(d: Date) {
  // UTC boundaries to avoid timezone drift (Ireland is UTC+1 in summer)
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1, 0, 0, 0));
}

function endOfMonth(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookkeepingPage() {
  const { data: session } = useSession();
  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [activeTab, setActiveTab] = useState<"expenses" | "receipts" | "summary">("expenses");

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Receipt upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  // Open a private blob receipt via signed URL, fall back to base64
  const openReceipt = useCallback(async (e: React.MouseEvent, exp: Expense) => {
    e.preventDefault();
    e.stopPropagation();
    if (exp.receiptUrl) {
      try {
        const res = await fetch(`/api/expenses/receipt-url?url=${encodeURIComponent(exp.receiptUrl)}`);
        const data = await res.json();
        if (data.url) { setLightboxUrl(data.url); return; }
      } catch {/* fall through */}
    }
    // Blob failed or missing — use base64 fallback
    if (exp.receiptDataUrl) {
      setLightboxUrl(exp.receiptDataUrl);
    }
  }, []);

  const from = startOfMonth(currentMonth).toISOString();
  const to = endOfMonth(currentMonth).toISOString();

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, sumRes] = await Promise.all([
        fetch(`/api/expenses/list?from=${from}&to=${to}`),
        fetch(`/api/expenses/summary?from=${from}&to=${to}`),
      ]);
      const expData = expRes.ok ? await expRes.json() : { expenses: [] };
      const sumData = sumRes.ok ? await sumRes.json() : { summary: null };
      setExpenses(expData.expenses ?? []);
      setSummary(sumData.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Upload receipt ─────────────────────────────────────────────────────────

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Use local object URL for preview (works without signed URL)
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setUploading(true);
    setAiLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/expenses/upload-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload failed"); return; }

      // Store blob URL + base64 fallback + 30-day expiry
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      setForm((f) => ({
        ...f,
        receiptUrl: data.url ?? f.receiptUrl,
        receiptDataUrl: data.dataUri ?? "",
        receiptExpiresAt: expiresAt,
        aiRawText: data.ai?.rawText ?? "",
      }));

      // Auto-fill from AI
      if (data.ai) {
        setForm((f) => ({
          ...f,
          receiptUrl: data.url ?? f.receiptUrl,
          receiptDataUrl: data.dataUri ?? f.receiptDataUrl,
          receiptExpiresAt: expiresAt,
          aiRawText: data.ai.rawText ?? "",
          vendor: data.ai.vendor ?? f.vendor,
          amount: data.ai.amount ? String(data.ai.amount) : f.amount,
          vatAmount: data.ai.vatAmount ? String(data.ai.vatAmount) : f.vatAmount,
          category: data.ai.category ?? f.category,
          description: data.ai.description ?? f.description,
          paymentMethod: data.ai.paymentMethod ?? f.paymentMethod,
          date: data.ai.date ?? f.date,
        }));
      }
    } finally {
      setUploading(false);
      setAiLoading(false);
    }
  }

  // ── Open dialog ───────────────────────────────────────────────────────────

  function openAdd() {
    setEditingExpense(null);
    setForm(EMPTY_FORM);
    setPreviewUrl("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(exp: Expense) {
    setEditingExpense(exp);
    setForm({
      vendor: exp.vendor ?? "",
      amount: String(exp.amount),
      vatAmount: String(exp.vatAmount),
      category: exp.category,
      date: exp.date.split("T")[0],
      description: exp.description ?? "",
      paymentMethod: exp.paymentMethod ?? "card",
      status: exp.status,
      receiptUrl: exp.receiptUrl ?? "",
      receiptDataUrl: exp.receiptDataUrl ?? "",
      receiptExpiresAt: exp.receiptExpiresAt ?? "",
      aiRawText: exp.aiRawText ?? "",
    });
    // For existing expenses, try signed URL first, then base64 fallback
    if (exp.receiptUrl) {
      fetch(`/api/expenses/receipt-url?url=${encodeURIComponent(exp.receiptUrl)}`)
        .then(r => r.json())
        .then(d => {
          if (d.url) setPreviewUrl(d.url);
          else if (exp.receiptDataUrl) setPreviewUrl(exp.receiptDataUrl);
        })
        .catch(() => setPreviewUrl(exp.receiptDataUrl ?? exp.receiptUrl ?? ""));
    } else if (exp.receiptDataUrl) {
      setPreviewUrl(exp.receiptDataUrl);
    } else {
      setPreviewUrl("");
    }
    setError("");
    setDialogOpen(true);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const body = {
        vendor: form.vendor || undefined,
        amount: parseFloat(form.amount),
        vatAmount: parseFloat(form.vatAmount) || 0,
        category: form.category,
        date: `${form.date}T12:00:00.000Z`,
        description: form.description || undefined,
        paymentMethod: form.paymentMethod || undefined,
        status: form.status,
        receiptUrl: form.receiptUrl || undefined,
        receiptDataUrl: form.receiptDataUrl || undefined,
        receiptExpiresAt: form.receiptExpiresAt || undefined,
        aiRawText: form.aiRawText || undefined,
      };

      if (isNaN(body.amount) || body.amount <= 0) {
        setError("Amount must be a positive number");
        return;
      }

      let res: Response;
      if (editingExpense) {
        res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/expenses/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save"); return; }
      setDialogOpen(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!editingExpense) return;
    setSaving(true);
    try {
      await fetch(`/api/expenses/${editingExpense.id}`, { method: "DELETE" });
      setDialogOpen(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV() {
    const rows = [["Date", "Vendor", "Category", "Description", "Amount (€)", "VAT (€)", "Net (€)", "Payment Method", "Status"]];
    expenses.forEach((e) => {
      rows.push([
        e.date.split("T")[0],
        e.vendor ?? "",
        getCatLabel(e.category),
        e.description ?? "",
        e.amount.toFixed(2),
        e.vatAmount.toFixed(2),
        (e.amount - e.vatAmount).toFixed(2),
        e.paymentMethod ?? "",
        e.status,
      ]);
    });
    // Totals row
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const totalVat = expenses.reduce((s, e) => s + e.vatAmount, 0);
    rows.push(["", "", "", "TOTAL", total.toFixed(2), totalVat.toFixed(2), (total - totalVat).toFixed(2), "", ""]);

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = filterCat === "all" ? expenses : expenses.filter((e) => e.category === filterCat);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Bookkeeping</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{monthLabel(currentMonth)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              This month
            </button>
            <button
              onClick={() => setCurrentMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-600" />
            </button>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          {isManager && (
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Total Spend</span>
              <div className="h-8 w-8 bg-rose-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmt(summary.total)}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.count} expense{summary.count !== 1 ? "s" : ""}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">VAT Total</span>
              <div className="h-8 w-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <FileText className="h-4 w-4 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmt(summary.totalVat)}</p>
            <p className="text-xs text-slate-400 mt-1">Reclaimable VAT</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Net (ex. VAT)</span>
              <div className="h-8 w-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Euro className="h-4 w-4 text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{fmt(summary.total - summary.totalVat)}</p>
            <p className="text-xs text-slate-400 mt-1">Excluding VAT</p>
          </div>

          {/* Top category */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Top Category</span>
              <div className="h-8 w-8 bg-purple-50 rounded-lg flex items-center justify-center">
                <Receipt className="h-4 w-4 text-purple-500" />
              </div>
            </div>
            {Object.keys(summary.byCategory).length > 0 ? (() => {
              const top = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])[0];
              return (
                <>
                  <p className="text-sm font-bold text-slate-900">{getCatLabel(top[0])}</p>
                  <p className="text-xs text-slate-400 mt-1">{fmt(top[1])}</p>
                </>
              );
            })() : <p className="text-sm text-slate-400">—</p>}
          </div>
        </div>
      )}

      {/* Category breakdown bar */}
      {summary && Object.keys(summary.byCategory).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-4">Spend by Category</p>
          <div className="space-y-3">
            {CATEGORIES.filter((c) => summary.byCategory[c.value]).map((cat) => {
              const amt = summary.byCategory[cat.value] ?? 0;
              const pct = summary.total > 0 ? (amt / summary.total) * 100 : 0;
              return (
                <div key={cat.value}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{cat.label}</span>
                    <span className="text-xs font-semibold text-slate-700">{fmt(amt)} <span className="text-slate-400 font-normal">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(["expenses", "receipts", "summary"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize",
              activeTab === tab ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab === "receipts" ? "Receipt History" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Expenses tab ── */}
      {activeTab === "expenses" && <>
      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterCat("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", filterCat === "all" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilterCat(cat.value)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", filterCat === cat.value ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50")}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
          <Receipt className="h-12 w-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-600">No expenses yet</p>
          <p className="text-sm text-slate-400 mt-1">Click "Add Expense" to log your first one.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Vendor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">Category</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 hidden md:table-cell">Description</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">VAT</th>
                <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Amount</th>
                <th className="px-3 py-3 text-xs font-medium text-slate-500 hidden sm:table-cell">Receipt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((exp, i) => (
                <tr
                  key={exp.id}
                  onClick={() => isManager && openEdit(exp)}
                  className={cn(
                    "border-b border-slate-50 transition-colors",
                    isManager ? "cursor-pointer hover:bg-slate-50" : "",
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  )}
                >
                  <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(exp.date).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[140px] truncate">
                    {exp.vendor ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", getCatColor(exp.category))}>
                      {getCatLabel(exp.category)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 max-w-[200px] truncate hidden md:table-cell">
                    {exp.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-500">
                    {exp.vatAmount > 0 ? fmt(exp.vatAmount) : "—"}
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold text-right text-slate-900">
                    {fmt(exp.amount)}
                  </td>
                  <td className="px-3 py-3 text-center hidden sm:table-cell">
                    {(exp.receiptUrl || exp.receiptDataUrl) ? (
                      <button
                        onClick={(e) => openReceipt(e, exp)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td colSpan={4} className="px-5 py-3 text-sm font-semibold text-slate-600">
                  Total ({filtered.length} items)
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-right text-slate-700">
                  {fmt(filtered.reduce((s, e) => s + e.vatAmount, 0))}
                </td>
                <td className="px-5 py-3 text-sm font-bold text-right text-slate-900">
                  {fmt(filtered.reduce((s, e) => s + e.amount, 0))}
                </td>
                <td className="px-3 py-3 hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      </> /* end expenses tab */}

      {/* ── Receipt History tab ── */}
      {activeTab === "receipts" && (() => {
        const withReceipts = expenses.filter(e => e.receiptUrl || e.receiptDataUrl);
        return (
          <div>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : withReceipts.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
                <ImageIcon className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="font-medium text-slate-600">No receipts stored yet</p>
                <p className="text-sm text-slate-400 mt-1">Upload a receipt when adding an expense — it'll appear here for 30 days.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {withReceipts.map((exp) => {
                  const thumbUrl = exp.receiptDataUrl ?? exp.receiptUrl ?? "";
                  const daysLeft = exp.receiptExpiresAt
                    ? Math.ceil((new Date(exp.receiptExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                    : null;
                  const badgeColor = daysLeft === null ? "bg-slate-100 text-slate-500"
                    : daysLeft <= 5 ? "bg-red-100 text-red-700"
                    : daysLeft <= 10 ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700";
                  return (
                    <div
                      key={exp.id}
                      onClick={(e) => openReceipt(e, exp)}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-36 bg-slate-50 flex items-center justify-center overflow-hidden">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt="Receipt"
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div className={cn("absolute inset-0 flex items-center justify-center", thumbUrl ? "hidden" : "")}>
                          <FileText className="h-10 w-10 text-slate-300" />
                        </div>
                        {/* Days badge */}
                        {daysLeft !== null && (
                          <div className={cn("absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1", badgeColor)}>
                            <Clock className="h-2.5 w-2.5" />
                            {daysLeft}d
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="text-xs font-semibold text-slate-800 truncate">{exp.vendor ?? "Unknown vendor"}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(exp.date).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">{fmt(exp.amount)}</p>
                        <span className={cn("mt-1.5 inline-block text-xs font-medium px-1.5 py-0.5 rounded-full", getCatColor(exp.category))}>
                          {getCatLabel(exp.category)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Summary tab ── */}
      {activeTab === "summary" && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-slate-300" /></div>
          ) : !summary || summary.count === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
              <FileText className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              <p className="font-medium text-slate-600">No data for this month</p>
            </div>
          ) : (
            <>
              {/* P&L style table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-sm font-semibold text-slate-700">Expense Breakdown — {monthLabel(currentMonth)}</p>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">Category</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">Gross</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-slate-500">VAT</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CATEGORIES.filter(c => summary.byCategory[c.value]).map(cat => {
                      const gross = summary.byCategory[cat.value] ?? 0;
                      const catExpenses = expenses.filter(e => e.category === cat.value);
                      const vat = catExpenses.reduce((s, e) => s + e.vatAmount, 0);
                      return (
                        <tr key={cat.value} className="border-b border-slate-50">
                          <td className="px-5 py-3">
                            <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cat.color)}>{cat.label}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-slate-700">{fmt(gross)}</td>
                          <td className="px-4 py-3 text-sm text-right text-slate-500">{fmt(vat)}</td>
                          <td className="px-5 py-3 text-sm text-right font-medium text-slate-900">{fmt(gross - vat)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50">
                      <td className="px-5 py-3 text-sm font-bold text-slate-700">Total</td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-slate-900">{fmt(summary.total)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-slate-700">{fmt(summary.totalVat)}</td>
                      <td className="px-5 py-3 text-sm font-bold text-right text-slate-900">{fmt(summary.total - summary.totalVat)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* VAT note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">VAT Summary</p>
                <p className="text-sm text-amber-700">
                  Reclaimable VAT this month: <span className="font-bold">{fmt(summary.totalVat)}</span>
                  {" "}— ensure all receipts are uploaded before filing your VAT return.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Receipt"
            className="max-h-[90vh] max-w-full rounded-xl shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Receipt upload */}
            <div className="space-y-2">
              <Label>Receipt Image</Label>
              <div
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors",
                  previewUrl ? "border-blue-200 bg-blue-50/30" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/20"
                )}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-500">{aiLoading ? "Reading receipt with AI…" : "Uploading…"}</p>
                  </div>
                ) : previewUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={previewUrl}
                      alt="Receipt"
                      className="h-16 w-16 object-cover rounded-lg border border-slate-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-700">Receipt uploaded</p>
                      <p className="text-xs text-blue-600 mt-0.5">Click to replace</p>
                      {aiLoading && (
                        <div className="flex items-center gap-1 mt-1">
                          <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
                          <span className="text-xs text-amber-600">AI reading…</span>
                        </div>
                      )}
                      {!aiLoading && previewUrl && (
                        <div className="flex items-center gap-1 mt-1">
                          <Sparkles className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-600">AI filled fields below</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Upload className="h-6 w-6 text-slate-400" />
                    <p className="text-sm text-slate-500">Upload receipt or invoice</p>
                    <p className="text-xs text-slate-400">AI will auto-fill the fields below</p>
                  </div>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (€) *</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>VAT (€)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={form.vatAmount}
                  onChange={(e) => setForm((f) => ({ ...f, vatAmount: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Vendor / Supplier</Label>
              <Input
                placeholder="e.g. Sysco, ESB Networks…"
                value={form.vendor}
                onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                placeholder="What was this expense for?"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            {editingExpense && (
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingExpense ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
