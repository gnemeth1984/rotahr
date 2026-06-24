// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/components/shared/CurrencyProvider";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Package, Truck, ClipboardList, Plus, Pencil, Trash2, Loader2,
  Search, ChevronDown, ChevronUp, Receipt, ArrowRight, CheckCircle2,
  AlertTriangle, Send, PackageCheck, FileDown, X, RefreshCw,
  ScanLine, Upload,
} from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  _count?: { stockItems: number; orders: number };
}

interface StockItem {
  id: string;
  name: string;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  sku: string | null;
  unit: string;
  category: string;
  lastPrice: number | null;
  lastOrdered: string | null;
  reorderLevel: number | null;
  currentStock: number | null;
  notes: string | null;
}

interface OrderItem {
  id?: string;
  stockItemId: string;
  stockItem?: { id: string; name: string; unit: string };
  quantity: number;
  unitPrice: number | null;
  notes: string | null;
}

interface SupplierOrder {
  id: string;
  supplierId: string;
  supplier: { id: string; name: string; email: string | null };
  status: string;
  notes: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  items: OrderItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = ["unit", "kg", "g", "litre", "ml", "case", "box", "bottle", "pack", "pcs"];
const CATEGORIES = [
  { value: "food", label: "Food", color: "bg-amber-100 text-amber-700" },
  { value: "beverage", label: "Beverage", color: "bg-blue-100 text-blue-700" },
  { value: "cleaning", label: "Cleaning", color: "bg-cyan-100 text-cyan-700" },
  { value: "packaging", label: "Packaging", color: "bg-slate-100 text-slate-700" },
  { value: "equipment", label: "Equipment", color: "bg-orange-100 text-orange-700" },
  { value: "other", label: "Other", color: "bg-purple-100 text-purple-700" },
  { value: "general", label: "General", color: "bg-gray-100 text-gray-700" },
];

function catColor(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.color ?? "bg-gray-100 text-gray-700";
}

function statusColor(status: string) {
  if (status === "sent") return "bg-blue-100 text-blue-700";
  if (status === "received") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-600";
}

// fmt is provided by useCurrency() hook — see component below

// ─── Supplier Form ────────────────────────────────────────────────────────────

function SupplierFormDialog({
  open, onClose, initial, onSaved,
}: {
  open: boolean; onClose: () => void;
  initial?: Supplier | null; onSaved: (s: Supplier) => void;
}) {
  const [form, setForm] = useState({
    name: "", contactName: "", email: "", phone: "", address: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        contactName: initial.contactName ?? "",
        email: initial.email ?? "",
        phone: initial.phone ?? "",
        address: initial.address ?? "",
        notes: initial.notes ?? "",
      });
    } else {
      setForm({ name: "", contactName: "", email: "", phone: "", address: "", notes: "" });
    }
    setError(null);
  }, [initial, open]);

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const url = initial ? `/api/suppliers/${initial.id}` : "/api/suppliers";
      const method = initial ? "PATCH" : "POST";
      const payload = {
        name: form.name,
        contactName: form.contactName || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data.supplier);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const f = (k: string) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Supplier Name *</Label>
            <Input value={form.name} onChange={f("name")} placeholder="e.g. Barry & Fitzwilliam" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input value={form.contactName} onChange={f("contactName")} placeholder="Rep name" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={f("phone")} placeholder="+353..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={f("email")} placeholder="orders@supplier.ie" />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={form.address} onChange={f("address")} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={f("notes")} className="resize-none min-h-[60px]" placeholder="Delivery days, lead time, etc." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? "Save Changes" : "Add Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stock Item Form ──────────────────────────────────────────────────────────

function StockItemFormDialog({
  open, onClose, initial, suppliers, onSaved, defaultSupplierId,
}: {
  open: boolean; onClose: () => void;
  initial?: StockItem | null; suppliers: Supplier[];
  onSaved: (item: StockItem) => void; defaultSupplierId?: string | null;
}) {
  const { symbol } = useCurrency();
  const [form, setForm] = useState({
    name: "", supplierId: "", sku: "", unit: "unit", category: "general",
    lastPrice: "", reorderLevel: "", currentStock: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name,
        supplierId: initial.supplierId ?? "",
        sku: initial.sku ?? "",
        unit: initial.unit,
        category: initial.category,
        lastPrice: initial.lastPrice != null ? String(initial.lastPrice) : "",
        reorderLevel: initial.reorderLevel != null ? String(initial.reorderLevel) : "",
        currentStock: initial.currentStock != null ? String(initial.currentStock) : "",
        notes: initial.notes ?? "",
      });
    } else {
      setForm({
        name: "", supplierId: defaultSupplierId ?? "", sku: "", unit: "unit", category: "general",
        lastPrice: "", reorderLevel: "", currentStock: "", notes: "",
      });
    }
    setError(null);
  }, [initial, open, defaultSupplierId]);

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError(null);
    try {
      const url = initial ? `/api/stock/${initial.id}` : "/api/stock";
      const method = initial ? "PATCH" : "POST";
      const payload = {
        name: form.name,
        supplierId: form.supplierId || null,
        sku: form.sku || null,
        unit: form.unit,
        category: form.category,
        lastPrice: form.lastPrice ? parseFloat(form.lastPrice) : null,
        reorderLevel: form.reorderLevel ? parseFloat(form.reorderLevel) : null,
        currentStock: form.currentStock ? parseFloat(form.currentStock) : null,
        notes: form.notes || null,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      onSaved(data.item);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const f = (k: string) => (e: any) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Stock Item" : "Add Stock Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Item Name *</Label>
            <Input value={form.name} onChange={f("name")} placeholder="e.g. Heineken Keg 50L" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Supplier</Label>
              <Select value={form.supplierId || "none"} onValueChange={(v) => setForm((p) => ({ ...p, supplierId: v === "none" ? "" : v }))}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No supplier</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm((p) => ({ ...p, unit: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>SKU / Product Code</Label>
              <Input value={form.sku} onChange={f("sku")} placeholder="Supplier's code" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Last Price ({symbol})</Label>
              <Input type="number" step="0.01" value={form.lastPrice} onChange={f("lastPrice")} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Current Stock</Label>
              <Input type="number" step="0.1" value={form.currentStock} onChange={f("currentStock")} placeholder="qty" />
            </div>
            <div className="space-y-1.5">
              <Label>Reorder Level</Label>
              <Input type="number" step="0.1" value={form.reorderLevel} onChange={f("reorderLevel")} placeholder="min qty" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={f("notes")} className="resize-none min-h-[60px]" placeholder="Storage, handling notes..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order Builder Dialog ─────────────────────────────────────────────────────

// ─── ItemCombobox ─────────────────────────────────────────────────────────────
// Free-text input with dropdown of matching stock items as suggestions.

function ItemCombobox({
  value,
  onChange,
  stockItems,
  supplierId,
}: {
  value: { stockItemId?: string; customName?: string; unit: string };
  onChange: (v: { stockItemId?: string; customName?: string; unit: string }) => void;
  stockItems: StockItem[];
  supplierId: string;
}) {
  const [query, setQuery] = useState(
    value.stockItemId
      ? (stockItems.find((s) => s.id === value.stockItemId)?.name ?? "")
      : (value.customName ?? "")
  );
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // All items shown: first supplier-linked, then rest
  const linked = stockItems.filter((s) => s.supplierId === supplierId);
  const others = stockItems.filter((s) => s.supplierId !== supplierId);
  const all = [...linked, ...others];

  const matches = query.trim()
    ? all.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : all;

  const isNew = query.trim() && !all.find((s) => s.name.toLowerCase() === query.toLowerCase());

  function select(item: StockItem) {
    setQuery(item.name);
    onChange({ stockItemId: item.id, customName: undefined, unit: item.unit });
    setOpen(false);
  }

  function confirm() {
    const trimmed = query.trim();
    if (!trimmed) return;
    const exact = all.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      onChange({ stockItemId: exact.id, customName: undefined, unit: exact.unit });
    } else {
      onChange({ stockItemId: undefined, customName: trimmed, unit: value.unit || "unit" });
    }
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Type item name or pick from list…"
        className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // If cleared, reset
          if (!e.target.value.trim()) onChange({ stockItemId: undefined, customName: undefined, unit: "unit" });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { setOpen(false); confirm(); }, 150)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm(); } if (e.key === "Escape") setOpen(false); }}
        autoComplete="off"
      />
      {open && (matches.length > 0 || isNew) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {isNew && (
            <button
              onMouseDown={(e) => { e.preventDefault(); confirm(); }}
              className="w-full text-left px-3 py-2 text-sm text-violet-700 font-medium hover:bg-violet-50 flex items-center gap-2 border-b border-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
              Add "<span className="font-semibold">{query.trim()}</span>" as new item
            </button>
          )}
          {matches.slice(0, 20).map((item) => (
            <button
              key={item.id}
              onMouseDown={(e) => { e.preventDefault(); select(item); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between gap-2"
            >
              <span className="text-slate-800">{item.name}</span>
              <span className="text-xs text-slate-400 shrink-0">{item.unit}{item.supplierId === supplierId ? " · linked" : ""}</span>
            </button>
          ))}
          {matches.length === 0 && !isNew && (
            <p className="px-3 py-2 text-xs text-slate-400">No matches — keep typing to add a new item</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OrderBuilderDialog ───────────────────────────────────────────────────────

function OrderBuilderDialog({
  open, onClose, suppliers, stockItems, onCreated,
}: {
  open: boolean; onClose: () => void;
  suppliers: Supplier[]; stockItems: StockItem[];
  onCreated: (order: SupplierOrder) => void;
}) {
  type Line = {
    stockItemId?: string;
    customName?: string;
    unit: string;
    quantity: string;
    unitPrice: string;
    notes: string;
  };

  const { symbol, fmt: fmtMoney } = useCurrency();
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setSupplierId(""); setNotes(""); setLines([]); setError(null); }
  }, [open]);

  function addLine() {
    setLines((prev) => [...prev, { stockItemId: undefined, customName: undefined, unit: "unit", quantity: "1", unitPrice: "", notes: "" }]);
  }

  function updateLineItem(i: number, v: { stockItemId?: string; customName?: string; unit: string }) {
    setLines((prev) => prev.map((l, idx) => {
      if (idx !== i) return l;
      const updated = { ...l, ...v };
      // Auto-fill price if picking an existing item
      if (v.stockItemId) {
        const item = stockItems.find((s) => s.id === v.stockItemId);
        if (item?.lastPrice != null) updated.unitPrice = String(item.lastPrice);
      }
      return updated;
    }));
  }

  function updateField(i: number, k: keyof Line, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  const lineLabel = (l: Line) => {
    if (l.stockItemId) return stockItems.find((s) => s.id === l.stockItemId)?.name ?? "";
    return l.customName ?? "";
  };

  async function handleCreate() {
    if (!supplierId) { setError("Select a supplier"); return; }
    const validLines = lines.filter((l) => (l.stockItemId || l.customName?.trim()) && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) { setError("Add at least one item with a name and quantity"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          notes: notes || null,
          items: validLines.map((l) => ({
            ...(l.stockItemId ? { stockItemId: l.stockItemId } : { customName: l.customName!.trim() }),
            unit: l.unit || "unit",
            quantity: parseFloat(l.quantity),
            unitPrice: l.unitPrice ? parseFloat(l.unitPrice) : null,
            notes: l.notes || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onCreated(data.order);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  const total = lines.reduce((acc, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unitPrice) || 0;
    return acc + qty * price;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Order List</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={supplierId || "none"} onValueChange={(v) => { setSupplierId(v === "none" ? "" : v); setLines([]); }}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select supplier</SelectItem>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions..." />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <Label>Items</Label>
                <p className="text-xs text-slate-400 mt-0.5">Pick from your stock list or type any item name</p>
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" /> Add Row
              </Button>
            </div>

            {lines.length === 0 && (
              <div className="border-2 border-dashed border-slate-200 rounded-xl py-8 text-center">
                <ClipboardList className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-400">Click <strong>Add Row</strong> to start building your order</p>
              </div>
            )}

            {lines.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[2.5fr_80px_80px_90px_36px] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-medium text-slate-500">Item name</span>
                  <span className="text-xs font-medium text-slate-500">Unit</span>
                  <span className="text-xs font-medium text-slate-500">Qty</span>
                  <span className="text-xs font-medium text-slate-500">Unit price</span>
                  <span />
                </div>

                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-[2.5fr_80px_80px_90px_36px] gap-2 px-3 py-2 border-b border-slate-50 last:border-0 items-center">
                    {/* Item name combobox */}
                    <ItemCombobox
                      value={line}
                      onChange={(v) => updateLineItem(i, v)}
                      stockItems={stockItems}
                      supplierId={supplierId}
                    />

                    {/* Unit */}
                    <Select
                      value={line.unit || "unit"}
                      onValueChange={(v) => updateField(i, "unit", v)}
                    >
                      <SelectTrigger className="h-9 text-xs px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {/* Qty */}
                    <Input
                      type="number" min="0.1" step="0.1"
                      value={line.quantity}
                      onChange={(e) => updateField(i, "quantity", e.target.value)}
                      className="h-9 text-sm"
                    />

                    {/* Unit price */}
                    <Input
                      type="number" min="0" step="0.01"
                      value={line.unitPrice}
                      onChange={(e) => updateField(i, "unitPrice", e.target.value)}
                      className="h-9 text-sm"
                      placeholder="€0.00"
                    />

                    <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-300 hover:text-red-500" onClick={() => removeLine(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {/* Totals footer */}
                {total > 0 && (
                  <div className="flex justify-end px-3 py-2 bg-slate-50 border-t border-slate-100">
                    <span className="text-sm font-semibold text-slate-700">Est. total: {fmtMoney(total)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Create Order List
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Suppliers Tab ────────────────────────────────────────────────────────────

function SuppliersTab({ suppliers, loading, onAdd, onEdit, onDelete }: {
  suppliers: Supplier[]; loading: boolean;
  onAdd: () => void; onEdit: (s: Supplier) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{suppliers.length} supplier{suppliers.length !== 1 ? "s" : ""}</p>
        <Button onClick={onAdd} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="h-4 w-4" /> Add Supplier
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Truck className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No suppliers yet — add your first one.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {suppliers.map((s) => (
            <Card key={s.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">{s.name}</h3>
                      {!s.active && <Badge variant="outline" className="text-xs text-slate-400">Inactive</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      {s.contactName && <span>{s.contactName}</span>}
                      {s.email && <span>{s.email}</span>}
                      {s.phone && <span>{s.phone}</span>}
                    </div>
                    {s.notes && <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">{s.notes}</p>}
                    <div className="mt-2 flex gap-3 text-xs text-slate-400">
                      <span>{s._count?.stockItems ?? 0} items</span>
                      <span>{s._count?.orders ?? 0} orders</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" onClick={() => onEdit(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stock Receipt Scan Dialog ────────────────────────────────────────────────

interface ScanSuggestion {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  existingItemId: string | null;
  existingName: string | null;
  existingPrice: number | null;
  priceChanged: boolean;
}

function StockReceiptScanDialog({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "review" | "done">("upload");
  const [uploading, setUploading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [vendor, setVendor] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ScanSuggestion[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [appliedCount, setAppliedCount] = useState(0);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setStep("upload");
    setUploading(false);
    setApplying(false);
    setError("");
    setPreviewUrl("");
    setVendor(null);
    setInvoiceDate(null);
    setSuggestions([]);
    setSelected({});
    setAppliedCount(0);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function processFile(file: File) {
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/stock/scan-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || data.error) { setError(data.error ?? "Scan failed"); setUploading(false); return; }

      setVendor(data.vendor ?? null);
      setInvoiceDate(data.invoiceDate ?? null);
      setSuggestions(data.suggestions ?? []);
      const init: Record<number, boolean> = {};
      (data.suggestions ?? []).forEach((_: ScanSuggestion, i: number) => { init[i] = true; });
      setSelected(init);
      setStep("review");
    } catch (e: any) {
      setError(e.message ?? "Scan failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleApply() {
    setApplying(true);
    setError("");
    let count = 0;
    for (let i = 0; i < suggestions.length; i++) {
      if (!selected[i]) continue;
      const s = suggestions[i];
      try {
        if (s.existingItemId) {
          await fetch(`/api/stock/${s.existingItemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...(s.unitPrice !== null ? { lastPrice: s.unitPrice } : {}),
              lastOrdered: invoiceDate ?? new Date().toISOString().split("T")[0],
            }),
          });
        } else {
          await fetch("/api/stock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: s.name,
              unit: s.unit,
              category: "general",
              ...(s.unitPrice !== null ? { lastPrice: s.unitPrice } : {}),
              lastOrdered: invoiceDate ?? new Date().toISOString().split("T")[0],
            }),
          });
        }
        count++;
      } catch {/* skip */}
    }
    setAppliedCount(count);
    setApplying(false);
    setStep("done");
    onApplied();
  }

  const toggleAll = (val: boolean) => {
    const next: Record<number, boolean> = {};
    suggestions.forEach((_, i) => { next[i] = val; });
    setSelected(next);
  };

  const anySelected = Object.values(selected).some(Boolean);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-violet-600" />
            Scan Delivery Note / Invoice
          </DialogTitle>
        </DialogHeader>

        {/* STEP: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Upload a photo or scan of a supplier invoice or delivery note. AI will read all line items and update your stock automatically.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) processFile(file);
              }}
              onClick={() => !uploading && fileRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50",
                uploading && "opacity-50 cursor-not-allowed"
              )}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                  <p className="text-sm font-medium text-slate-700">Scanning with AI…</p>
                  <p className="text-xs text-slate-400">Reading line items from your document</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-14 w-14 bg-violet-50 rounded-2xl flex items-center justify-center">
                    <Upload className="h-6 w-6 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Drop your invoice here</p>
                    <p className="text-xs text-slate-400 mt-1">or click to browse — JPG, PNG, PDF</p>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
            />

            {previewUrl && !uploading && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-48">
                <img src={previewUrl} alt="Preview" className="w-full object-contain max-h-48" />
              </div>
            )}
          </div>
        )}

        {/* STEP: Review */}
        {step === "review" && (
          <div className="space-y-4">
            {/* Vendor / date header */}
            {(vendor || invoiceDate) && (
              <div className="flex flex-wrap gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
                {vendor && (
                  <div className="text-sm"><span className="text-violet-500 font-medium">Supplier:</span> <span className="text-slate-800 font-semibold">{vendor}</span></div>
                )}
                {invoiceDate && (
                  <div className="text-sm"><span className="text-violet-500 font-medium">Date:</span> <span className="text-slate-800">{invoiceDate}</span></div>
                )}
              </div>
            )}

            {/* Preview thumbnail */}
            {previewUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-200 max-h-32">
                <img src={previewUrl} alt="Receipt" className="w-full object-contain max-h-32" />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {suggestions.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                <p className="text-sm font-medium text-amber-800">No line items found</p>
                <p className="text-xs text-amber-600 mt-1">AI couldn't read any line items. Try a clearer photo or add items manually.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">{suggestions.length} item{suggestions.length !== 1 ? "s" : ""} found</p>
                  <div className="flex gap-2">
                    <button onClick={() => toggleAll(true)} className="text-xs text-violet-600 hover:underline">Select all</button>
                    <span className="text-slate-300">·</span>
                    <button onClick={() => toggleAll(false)} className="text-xs text-slate-500 hover:underline">None</button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2.5"></th>
                        <th className="px-3 py-2.5 text-left text-xs font-medium text-slate-500">Item</th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-500">Qty</th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-500">Unit</th>
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-slate-500">Unit Price</th>
                        <th className="px-3 py-2.5 text-center text-xs font-medium text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suggestions.map((s, i) => (
                        <tr key={i} className={cn("border-b border-slate-50 transition-colors", selected[i] ? "bg-white" : "bg-slate-50/50 opacity-60")}>
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={!!selected[i]}
                              onChange={(e) => setSelected((p) => ({ ...p, [i]: e.target.checked }))}
                              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-slate-800">{s.name}</p>
                            {s.existingName && s.existingName !== s.name && (
                              <p className="text-xs text-slate-400 mt-0.5">→ matches "{s.existingName}"</p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-slate-600">{s.quantity}</td>
                          <td className="px-3 py-3 text-center text-xs text-slate-500">{s.unit}</td>
                          <td className="px-3 py-3 text-right">
                            {s.unitPrice !== null ? (
                              <span className={cn("font-medium", s.priceChanged ? "text-amber-700" : "text-slate-800")}>
                                €{s.unitPrice.toFixed(2)}
                              </span>
                            ) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {s.existingItemId ? (
                              <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium",
                                s.priceChanged ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                              )}>
                                {s.priceChanged ? <><AlertTriangle className="h-3 w-3" /> Price changed</> : <><CheckCircle2 className="h-3 w-3" /> Update</>}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">
                                <Plus className="h-3 w-3" /> New item
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {suggestions.some((s) => s.priceChanged) && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-amber-800">
                      Some items have a different price from what's on record. Confirming will update the price in Stock.
                    </span>
                  </div>
                )}
              </>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setSuggestions([]); }}>
                Scan Again
              </Button>
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              {suggestions.length > 0 && (
                <Button size="sm" onClick={handleApply} disabled={applying || !anySelected} className="bg-violet-600 hover:bg-violet-700">
                  {applying && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Apply {Object.values(selected).filter(Boolean).length} item{Object.values(selected).filter(Boolean).length !== 1 ? "s" : ""}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {/* STEP: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-14 w-14 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-base font-semibold text-slate-800">
              {appliedCount} item{appliedCount !== 1 ? "s" : ""} updated in Stock
            </p>
            <p className="text-sm text-slate-400 text-center max-w-sm">
              Prices and last-ordered dates have been updated.
            </p>
            <Button size="sm" onClick={handleClose} className="mt-2">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Stock List Tab ───────────────────────────────────────────────────────────

function StockListTab({ items, suppliers, loading, onAdd, onEdit, onDelete, onScan }: {
  items: StockItem[]; suppliers: Supplier[]; loading: boolean;
  onAdd: () => void; onEdit: (i: StockItem) => void; onDelete: (id: string) => void;
  onScan: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterCat, setFilterCat] = useState("all");

  const filtered = items.filter((item) => {
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    const matchSupplier = filterSupplier === "all" || item.supplierId === filterSupplier;
    const matchCat = filterCat === "all" || item.category === filterCat;
    return matchSearch && matchSupplier && matchCat;
  });

  // Group by supplier
  const grouped: Record<string, StockItem[]> = {};
  for (const item of filtered) {
    const key = item.supplier?.name ?? "No Supplier";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  const lowStock = items.filter((i) =>
    i.reorderLevel != null && i.currentStock != null && i.currentStock <= i.reorderLevel
  );

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Low stock alert</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {lowStock.map((i) => i.name).join(", ")} {lowStock.length === 1 ? "is" : "are"} at or below reorder level.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="pl-8 h-9 text-sm w-44" />
          </div>
          <Select value={filterSupplier} onValueChange={setFilterSupplier}>
            <SelectTrigger className="h-9 text-sm w-40"><SelectValue placeholder="Supplier" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All suppliers</SelectItem>
              {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="h-9 text-sm w-36"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={onScan} size="sm" variant="outline" className="gap-2 border-violet-200 text-violet-700 hover:bg-violet-50">
            <ScanLine className="h-4 w-4" /> Scan Receipt
          </Button>
          <Button onClick={onAdd} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{search || filterSupplier !== "all" || filterCat !== "all" ? "No items match your filter." : "No stock items yet — add your first item."}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([supplierName, groupItems]) => (
            <div key={supplierName}>
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{supplierName}</span>
                <span className="text-xs text-slate-400">({groupItems.length})</span>
              </div>
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs">Item</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs">Category</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs">Unit</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500 text-xs">Last Price</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500 text-xs">Stock</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500 text-xs">Reorder</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupItems.map((item) => {
                      const isLow = item.reorderLevel != null && item.currentStock != null && item.currentStock <= item.reorderLevel;
                      return (
                        <tr key={item.id} className={cn("hover:bg-slate-50", isLow && "bg-amber-50 hover:bg-amber-50")}>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-900">{item.name}</div>
                            {item.sku && <div className="text-xs text-slate-400">SKU: {item.sku}</div>}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge className={cn("text-xs font-normal", catColor(item.category))}>{item.category}</Badge>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{item.unit}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-900">{fmt(item.lastPrice)}</td>
                          <td className={cn("px-3 py-2.5 text-right font-medium", isLow ? "text-amber-700" : "text-slate-900")}>
                            {item.currentStock != null ? `${item.currentStock} ${item.unit}` : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500 text-xs">
                            {item.reorderLevel != null ? `${item.reorderLevel} ${item.unit}` : "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700" onClick={() => onEdit(item)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => onDelete(item.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Order Lists Tab ──────────────────────────────────────────────────────────

function OrdersTab({ orders, suppliers, stockItems, loading, onNew, onRefresh }: {
  orders: SupplierOrder[]; suppliers: Supplier[]; stockItems: StockItem[];
  loading: boolean; onNew: () => void; onRefresh: () => void;
}) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId);
    try {
      const body: any = { status };
      if (status === "sent") body.sentAt = new Date().toISOString();
      if (status === "received") body.receivedAt = new Date().toISOString();
      await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onRefresh();
    } finally { setUpdatingId(null); }
  }

  async function deleteOrder(orderId: string) {
    if (!confirm("Delete this order list?")) return;
    await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
    onRefresh();
  }

  function exportCSV(order: SupplierOrder) {
    const lines = [
      ["Item", "SKU", "Unit", "Quantity", "Unit Price", "Total"].join(","),
      ...order.items.map((item) => {
        const stockItem = stockItems.find((s) => s.id === item.stockItemId);
        const qty = item.quantity;
        const price = item.unitPrice ?? "";
        const total = item.unitPrice ? (qty * item.unitPrice).toFixed(2) : "";
        return [
          `"${item.stockItem?.name ?? stockItem?.name ?? ""}"`,
          `"${stockItem?.sku ?? ""}"`,
          item.stockItem?.unit ?? stockItem?.unit ?? "",
          qty,
          price,
          total,
        ].join(",");
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-${order.supplier.name.replace(/\s+/g, "-")}-${new Date(order.createdAt).toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = orders.filter((o) => filterStatus === "all" || o.status === filterStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orders</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onNew} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="h-4 w-4" /> New Order List
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No order lists yet — create one to send to a supplier.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const estTotal = order.items.reduce((acc, i) => acc + (i.unitPrice ?? 0) * i.quantity, 0);
            return (
              <Card key={order.id} className="border-slate-200">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900">{order.supplier.name}</span>
                        <Badge className={cn("text-xs font-normal", statusColor(order.status))}>
                          {order.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                        {order.sentAt && ` · Sent ${new Date(order.sentAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}`}
                        {order.receivedAt && ` · Received ${new Date(order.receivedAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" title="Export CSV" onClick={() => exportCSV(order)}>
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      {order.status === "draft" && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600" onClick={() => deleteOrder(order.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-medium text-slate-500">Item</th>
                          <th className="text-right px-3 py-1.5 font-medium text-slate-500">Qty</th>
                          <th className="text-right px-3 py-1.5 font-medium text-slate-500">Unit Price</th>
                          <th className="text-right px-3 py-1.5 font-medium text-slate-500">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {order.items.map((item, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-3 py-2">{item.stockItem?.name ?? "—"} <span className="text-slate-400">({item.stockItem?.unit ?? ""})</span></td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{item.unitPrice != null ? `€${item.unitPrice.toFixed(2)}` : "—"}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {item.unitPrice != null ? `€${(item.quantity * item.unitPrice).toFixed(2)}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {estTotal > 0 && (
                        <tfoot className="border-t border-slate-200 bg-slate-50">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-right font-semibold text-slate-600 text-xs">Est. Total</td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">{fmtMoney(estTotal)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {order.notes && <p className="text-xs text-slate-500 italic">{order.notes}</p>}

                  {/* Actions */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    {order.status === "draft" && (
                      <Button
                        size="sm" variant="outline"
                        className="gap-1.5 h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                        disabled={updatingId === order.id}
                        onClick={() => updateStatus(order.id, "sent")}
                      >
                        {updatingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Mark as Sent
                      </Button>
                    )}
                    {order.status === "sent" && (
                      <Button
                        size="sm" variant="outline"
                        className="gap-1.5 h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"
                        disabled={updatingId === order.id}
                        onClick={() => updateStatus(order.id, "received")}
                      >
                        {updatingId === order.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <PackageCheck className="h-3 w-3" />}
                        Mark as Received
                      </Button>
                    )}
                    {order.supplier.email && order.status === "draft" && (
                      <a
                        href={`mailto:${order.supplier.email}?subject=Order from Rotahr&body=Please find our order attached.`}
                        className="inline-flex items-center gap-1.5 text-xs h-8 px-3 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        <Send className="h-3 w-3" /> Email Supplier
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const { data: session } = useSession();
  const { symbol, locale, fmt: fmtMoney } = useCurrency();
  // local fmt wrapper handles null/undefined
  const fmt = (n: number | null | undefined) => (n == null ? "—" : fmtMoney(n));
  const isManager = session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [tab, setTab] = useState<"stock" | "suppliers" | "orders">("stock");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);

  // Dialogs
  const [supplierDialog, setSupplierDialog] = useState<{ open: boolean; editing: Supplier | null }>({ open: false, editing: null });
  const [stockDialog, setStockDialog] = useState<{ open: boolean; editing: StockItem | null; defaultSupplier?: string }>({ open: false, editing: null });
  const [orderDialog, setOrderDialog] = useState(false);
  const [scanDialog, setScanDialog] = useState(false);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    try {
      const res = await fetch("/api/suppliers?active=true");
      const data = await res.json();
      setSuppliers(data.suppliers ?? []);
    } finally { setLoadingSuppliers(false); }
  }, []);

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const res = await fetch("/api/stock");
      const data = await res.json();
      setStockItems(data.items ?? []);
    } finally { setLoadingStock(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      setOrders(data.orders ?? []);
    } finally { setLoadingOrders(false); }
  }, []);

  useEffect(() => { if (isManager) { loadSuppliers(); loadStock(); loadOrders(); } }, [isManager]);

  async function deleteSupplier(id: string) {
    if (!confirm("Remove this supplier? Their stock items will remain.")) return;
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    loadSuppliers();
  }

  async function deleteStockItem(id: string) {
    if (!confirm("Delete this stock item?")) return;
    await fetch(`/api/stock/${id}`, { method: "DELETE" });
    loadStock();
  }

  if (!isManager) {
    return (
      <div className="px-4 py-8 text-center max-w-sm mx-auto">
        <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">Stock management is available to managers only.</p>
      </div>
    );
  }

  const tabs = [
    { key: "stock", label: "Stock List", icon: Package, count: stockItems.length },
    { key: "suppliers", label: "Suppliers", icon: Truck, count: suppliers.length },
    { key: "orders", label: "Order Lists", icon: ClipboardList, count: orders.filter((o) => o.status !== "received").length || undefined },
  ] as const;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto w-full space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Package className="h-6 w-6 text-violet-600" />
          Stock & Ordering
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage suppliers, track stock items and prices, create ordering lists
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all flex-1 sm:flex-none justify-center sm:justify-start",
              tab === key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
            {count !== undefined && count > 0 && (
              <span className={cn(
                "text-xs rounded-full px-1.5 py-0.5 font-semibold",
                tab === key ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"
              )}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "suppliers" && (
        <SuppliersTab
          suppliers={suppliers} loading={loadingSuppliers}
          onAdd={() => setSupplierDialog({ open: true, editing: null })}
          onEdit={(s) => setSupplierDialog({ open: true, editing: s })}
          onDelete={deleteSupplier}
        />
      )}

      {tab === "stock" && (
        <StockListTab
          items={stockItems} suppliers={suppliers} loading={loadingStock}
          onAdd={() => setStockDialog({ open: true, editing: null })}
          onEdit={(i) => setStockDialog({ open: true, editing: i })}
          onDelete={deleteStockItem}
          onScan={() => setScanDialog(true)}
        />
      )}

      {tab === "orders" && (
        <OrdersTab
          orders={orders} suppliers={suppliers} stockItems={stockItems}
          loading={loadingOrders}
          onNew={() => setOrderDialog(true)}
          onRefresh={loadOrders}
        />
      )}

      {/* Dialogs */}
      <SupplierFormDialog
        open={supplierDialog.open}
        onClose={() => setSupplierDialog({ open: false, editing: null })}
        initial={supplierDialog.editing}
        onSaved={() => { setSupplierDialog({ open: false, editing: null }); loadSuppliers(); }}
      />

      <StockItemFormDialog
        open={stockDialog.open}
        onClose={() => setStockDialog({ open: false, editing: null })}
        initial={stockDialog.editing}
        suppliers={suppliers}
        defaultSupplierId={stockDialog.defaultSupplier}
        onSaved={() => { setStockDialog({ open: false, editing: null }); loadStock(); }}
      />

      <OrderBuilderDialog
        open={orderDialog}
        onClose={() => setOrderDialog(false)}
        suppliers={suppliers}
        stockItems={stockItems}
        onCreated={() => { setOrderDialog(false); loadOrders(); setTab("orders"); }}
      />

      <StockReceiptScanDialog
        open={scanDialog}
        onClose={() => setScanDialog(false)}
        onApplied={() => { loadStock(); }}
      />
    </div>
  );
}
