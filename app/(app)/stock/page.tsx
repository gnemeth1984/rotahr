// @ts-nocheck
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
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

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return `€${n.toFixed(2)}`;
}

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
              <Label>Last Price (€)</Label>
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

function OrderBuilderDialog({
  open, onClose, suppliers, stockItems, onCreated,
}: {
  open: boolean; onClose: () => void;
  suppliers: Supplier[]; stockItems: StockItem[];
  onCreated: (order: SupplierOrder) => void;
}) {
  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<{ stockItemId: string; quantity: string; unitPrice: string; notes: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSupplierId(""); setNotes(""); setLines([]); setError(null);
    }
  }, [open]);

  const supplierItems = stockItems.filter((s) => !supplierId || s.supplierId === supplierId);

  function addLine() {
    setLines((prev) => [...prev, { stockItemId: "", quantity: "1", unitPrice: "", notes: "" }]);
  }

  function updateLine(i: number, k: string, v: string) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
    // Auto-fill unit price from stock item lastPrice
    if (k === "stockItemId") {
      const item = stockItems.find((s) => s.id === v);
      if (item?.lastPrice != null) {
        setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, stockItemId: v, unitPrice: String(item.lastPrice) } : l));
      }
    }
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleCreate() {
    if (!supplierId) { setError("Select a supplier"); return; }
    const validLines = lines.filter((l) => l.stockItemId && parseFloat(l.quantity) > 0);
    if (validLines.length === 0) { setError("Add at least one item"); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          notes: notes || null,
          items: validLines.map((l) => ({
            stockItemId: l.stockItemId,
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
        <div className="space-y-4 py-2">
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
              <Label>Items</Label>
              <Button variant="outline" size="sm" onClick={addLine} className="gap-1.5 h-7 text-xs">
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>
            {lines.length === 0 && (
              <p className="text-sm text-slate-400 italic text-center py-4">
                No items yet — click Add Item to start building the order.
              </p>
            )}
            {lines.map((line, i) => {
              const item = stockItems.find((s) => s.id === line.stockItemId);
              return (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    {i === 0 && <Label className="text-xs text-slate-500">Item</Label>}
                    <Select value={line.stockItemId || "none"} onValueChange={(v) => updateLine(i, "stockItemId", v === "none" ? "" : v)}>
                      <SelectTrigger className="text-sm h-9"><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select item</SelectItem>
                        {supplierItems.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} ({s.unit})</SelectItem>)}
                        {supplierId && supplierItems.length === 0 && (
                          <SelectItem value="_empty" disabled>No items for this supplier</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    {i === 0 && <Label className="text-xs text-slate-500">Qty</Label>}
                    <Input type="number" min="0.1" step="0.1" value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    {i === 0 && <Label className="text-xs text-slate-500">Unit Price €</Label>}
                    <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(i, "unitPrice", e.target.value)} className="h-9 text-sm" placeholder="Last known" />
                  </div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-500" onClick={() => removeLine(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            {lines.length > 0 && total > 0 && (
              <div className="flex justify-end pt-1">
                <span className="text-sm font-semibold text-slate-700">Est. total: €{total.toFixed(2)}</span>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
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

// ─── Stock List Tab ───────────────────────────────────────────────────────────

function StockListTab({ items, suppliers, loading, onAdd, onEdit, onDelete }: {
  items: StockItem[]; suppliers: Supplier[]; loading: boolean;
  onAdd: () => void; onEdit: (i: StockItem) => void; onDelete: (id: string) => void;
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
        <Button onClick={onAdd} size="sm" className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="h-4 w-4" /> Add Item
        </Button>
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
                        {new Date(order.createdAt).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                        {order.sentAt && ` · Sent ${new Date(order.sentAt).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}`}
                        {order.receivedAt && ` · Received ${new Date(order.receivedAt).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}`}
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
                            <td className="px-3 py-2 text-right font-bold text-slate-900">€{estTotal.toFixed(2)}</td>
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
    </div>
  );
}
