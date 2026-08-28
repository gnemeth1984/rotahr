// @ts-nocheck
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Wrench, Plus, AlertTriangle, ShieldCheck, ShieldAlert, Clock, Loader2,
  Trash2, Edit2, X, Upload, Phone, Mail, FileText, ChevronDown, ChevronUp,
  CalendarClock, Search, Paperclip,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";
import { useCurrency } from "@/components/shared/CurrencyProvider";

const CATEGORIES = [
  { value: "refrigeration", label: "Refrigeration" },
  { value: "cooking", label: "Cooking" },
  { value: "dishwashing", label: "Dishwashing" },
  { value: "bar", label: "Bar" },
  { value: "coffee", label: "Coffee" },
  { value: "hvac", label: "HVAC / Extraction" },
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "pos", label: "POS / Tills" },
  { value: "furniture", label: "Furniture & Fittings" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "active", label: "Working" },
  { value: "faulty", label: "Faulty" },
  { value: "awaiting_parts", label: "Awaiting parts" },
  { value: "out_of_service", label: "Out of service" },
  { value: "retired", label: "Retired" },
];

const SERVICE_KINDS = [
  { value: "service", label: "Routine service" },
  { value: "repair", label: "Repair" },
  { value: "inspection", label: "Inspection" },
  { value: "installation", label: "Installation" },
  { value: "callout", label: "Emergency callout" },
];

const DOC_KINDS = [
  { value: "warranty", label: "Warranty" },
  { value: "invoice", label: "Invoice / receipt" },
  { value: "service_report", label: "Service report" },
  { value: "manual", label: "Manual" },
  { value: "photo", label: "Photo" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  name: "", category: "other", location: "", make: "", model: "", serialNumber: "",
  purchaseDate: "", purchasePrice: "", warrantyExpiry: "", warrantyProvider: "",
  warrantyNotes: "", contactCompany: "", contactName: "", contactPhone: "",
  contactEmail: "", serviceIntervalMonths: "", lastServiceDate: "",
  nextServiceDate: "", status: "active", notes: "",
};

function fmt(d) {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IE", { day: "2-digit", month: "short", year: "numeric" });
}

function toInput(d) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function serviceBadge(a) {
  switch (a.service) {
    case "OVERDUE":
      return <Badge variant="destructive">Service overdue</Badge>;
    case "DUE_SOON":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Service due {a.serviceDays}d</Badge>;
    case "SCHEDULED":
      return <Badge variant="outline" className="text-slate-600">Serviced</Badge>;
    default:
      return null;
  }
}

function warrantyBadge(a) {
  switch (a.warranty) {
    case "EXPIRING_SOON":
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Warranty ends {a.warrantyDays}d</Badge>;
    case "VALID":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Under warranty</Badge>;
    case "EXPIRED":
      return <Badge variant="outline" className="text-slate-500">Warranty expired</Badge>;
    default:
      return null;
  }
}

function statusBadge(status) {
  if (status === "active") return null;
  const map = {
    faulty: <Badge variant="destructive">Faulty</Badge>,
    awaiting_parts: <Badge className="bg-amber-100 text-amber-800 border-amber-200">Awaiting parts</Badge>,
    out_of_service: <Badge variant="destructive">Out of service</Badge>,
    retired: <Badge variant="outline" className="text-slate-500">Retired</Badge>,
  };
  return map[status] ?? null;
}

export default function AssetsPage() {
  const { symbol } = useCurrency();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isManager = role === Role.MANAGER || role === Role.ADMIN;

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [imported, setImported] = useState(0);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const [expanded, setExpanded] = useState(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/assets", { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Failed to load (${res.status})`);
      }
      const j = await res.json();
      setAssets(j.assets ?? []);
      setImported(j.imported ?? 0);
    } catch (e) {
      setErr(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isManager) load(); }, [isManager, load]);

  const counts = useMemo(() => {
    const overdue = assets.filter((a) => a.service === "OVERDUE").length;
    const dueSoon = assets.filter((a) => a.service === "DUE_SOON").length;
    const warrantySoon = assets.filter((a) => a.warranty === "EXPIRING_SOON").length;
    const broken = assets.filter((a) => a.status === "faulty" || a.status === "out_of_service").length;
    return { overdue, dueSoon, warrantySoon, broken, total: assets.length };
  }, [assets]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((a) => {
      if (catFilter !== "all" && a.category !== catFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (attentionOnly && a.rank > 5) return false;
      if (!q) return true;
      return [a.name, a.location, a.make, a.model, a.serialNumber, a.contactCompany, a.contactName]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [assets, search, catFilter, statusFilter, attentionOnly]);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(a) {
    setEditingId(a.id);
    setForm({
      name: a.name ?? "", category: a.category ?? "other", location: a.location ?? "",
      make: a.make ?? "", model: a.model ?? "", serialNumber: a.serialNumber ?? "",
      purchaseDate: toInput(a.purchaseDate),
      purchasePrice: a.purchasePrice != null ? String(a.purchasePrice) : "",
      warrantyExpiry: toInput(a.warrantyExpiry),
      warrantyProvider: a.warrantyProvider ?? "", warrantyNotes: a.warrantyNotes ?? "",
      contactCompany: a.contactCompany ?? "", contactName: a.contactName ?? "",
      contactPhone: a.contactPhone ?? "", contactEmail: a.contactEmail ?? "",
      serviceIntervalMonths: a.serviceIntervalMonths != null ? String(a.serviceIntervalMonths) : "",
      lastServiceDate: toInput(a.lastServiceDate),
      nextServiceDate: toInput(a.nextServiceDate),
      status: a.status ?? "active", notes: a.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.name.trim()) { setErr("Give the item a name."); return; }
    setSaving(true);
    setErr("");
    try {
      const url = editingId ? `/api/assets?id=${editingId}` : "/api/assets";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Save failed");
      }
      setDialogOpen(false);
      await load();
    } catch (e) {
      setErr(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this item and its whole service history? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/assets?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      await load();
    } catch (e) {
      setErr(e.message ?? "Delete failed");
    }
  }

  if (!session) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
  }

  if (!isManager) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-slate-300 mb-3" />
        <h1 className="text-lg font-semibold text-slate-900">Managers only</h1>
        <p className="text-sm text-slate-500 mt-1">
          The equipment and service register is limited to managers and admins.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-orange-500" />
            Equipment &amp; Service
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Warranties, service dates and who to ring. Log a service and the next date rolls forward on its own.
          </p>
        </div>
        <Button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600">
          <Plus className="h-4 w-4 mr-1.5" /> Add equipment
        </Button>
      </div>

      {imported > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Pulled in {imported} unit{imported === 1 ? "" : "s"} from your HACCP equipment list. Add warranty and
          service details to each one.
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{err}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Service overdue" value={counts.overdue} tone={counts.overdue ? "red" : "plain"} />
        <StatCard label="Due in 30 days" value={counts.dueSoon} tone={counts.dueSoon ? "amber" : "plain"} />
        <StatCard label="Warranty ending" value={counts.warrantySoon} tone={counts.warrantySoon ? "orange" : "plain"} />
        <StatCard label="Faulty / down" value={counts.broken} tone={counts.broken ? "red" : "plain"} />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search name, make, serial, engineer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any condition</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant={attentionOnly ? "default" : "outline"}
          onClick={() => setAttentionOnly((v) => !v)}
          className={cn(attentionOnly && "bg-slate-900")}
        >
          Needs attention
        </Button>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : visible.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Wrench className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="font-medium text-slate-700">
            {assets.length === 0 ? "No equipment logged yet" : "Nothing matches those filters"}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            {assets.length === 0
              ? "Add your fridges, ovens, glasswasher and coffee machine — then you'll know what's still under warranty before you pay a callout."
              : "Try clearing the search or filters."}
          </p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {visible.map((a) => (
            <AssetRow
              key={a.id}
              asset={a}
              expanded={expanded === a.id}
              onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
              onEdit={() => openEdit(a)}
              onDelete={() => remove(a.id)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit equipment" : "Add equipment"}</DialogTitle>
            <DialogDescription>
              Only the name is required. Everything else you can fill in as you find the paperwork.
            </DialogDescription>
          </DialogHeader>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Name" className="sm:col-span-2">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Walk-in fridge" />
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Location">
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Main kitchen" />
            </Field>
            <Field label="Make"><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
            <Field label="Model"><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
            <Field label="Serial number" className="sm:col-span-2">
              <Input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                placeholder="Off the plate on the back — the engineer always asks" />
            </Field>

            <SectionLabel>Purchase</SectionLabel>
            <Field label="Purchase date">
              <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            </Field>
            <Field label={`Purchase price (${symbol})`}>
              <Input type="number" step="0.01" value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="0.00" />
            </Field>

            <SectionLabel>Warranty</SectionLabel>
            <Field label="Warranty expires">
              <Input type="date" value={form.warrantyExpiry}
                onChange={(e) => setForm({ ...form, warrantyExpiry: e.target.value })} />
            </Field>
            <Field label="Warranty provider">
              <Input value={form.warrantyProvider} onChange={(e) => setForm({ ...form, warrantyProvider: e.target.value })}
                placeholder="Supplier or manufacturer" />
            </Field>
            <Field label="Warranty notes" className="sm:col-span-2">
              <Textarea rows={2} value={form.warrantyNotes}
                onChange={(e) => setForm({ ...form, warrantyNotes: e.target.value })}
                placeholder="What's covered, claim reference, excess…" />
            </Field>

            <SectionLabel>Who to ring</SectionLabel>
            <Field label="Company">
              <Input value={form.contactCompany} onChange={(e) => setForm({ ...form, contactCompany: e.target.value })} />
            </Field>
            <Field label="Contact name">
              <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </Field>

            <SectionLabel>Service schedule</SectionLabel>
            <Field label="Service every (months)">
              <Input type="number" min="1" value={form.serviceIntervalMonths}
                onChange={(e) => setForm({ ...form, serviceIntervalMonths: e.target.value })} placeholder="6" />
            </Field>
            <Field label="Condition">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Last serviced">
              <Input type="date" value={form.lastServiceDate}
                onChange={(e) => setForm({ ...form, lastServiceDate: e.target.value })} />
            </Field>
            <Field label="Next service due">
              <Input type="date" value={form.nextServiceDate}
                onChange={(e) => setForm({ ...form, nextServiceDate: e.target.value })} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {editingId ? "Save changes" : "Add equipment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    plain: "border-slate-200 bg-white text-slate-700",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", tones[tone] ?? tones.plain)}>
      <div className="text-2xl font-bold leading-none">{value}</div>
      <div className="text-xs mt-1 opacity-80">{label}</div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="sm:col-span-2 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400 border-t border-slate-100 mt-1">
      {children}
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <Label className="text-xs text-slate-600">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function AssetRow({ asset: a, expanded, onToggle, onEdit, onDelete, onChanged }) {
  const contact = [a.contactCompany, a.contactName].filter(Boolean).join(" · ");
  return (
    <Card className={cn(a.rank <= 1 && "border-red-200", a.rank === 2 && "border-orange-200")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onToggle} className="text-left flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900">{a.name}</span>
              {a.location && <span className="text-sm text-slate-500">· {a.location}</span>}
              {statusBadge(a.status)}
              {serviceBadge(a)}
              {warrantyBadge(a)}
              {a.haccpEquipmentId && (
                <Badge variant="outline" className="text-slate-500 text-[10px]">HACCP unit</Badge>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {(a.make || a.model) && <span>{[a.make, a.model].filter(Boolean).join(" ")}</span>}
              {a.serialNumber && <span>S/N {a.serialNumber}</span>}
              {a.nextServiceDate && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" /> Next service {fmt(a.nextServiceDate)}
                </span>
              )}
              {a.warrantyExpiry && (
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Warranty to {fmt(a.warrantyExpiry)}
                </span>
              )}
              {a._count?.services > 0 && <span>{a._count.services} service record{a._count.services === 1 ? "" : "s"}</span>}
            </div>
            {contact && (
              <div className="text-xs text-slate-600 mt-1.5 flex flex-wrap gap-x-3">
                <span className="font-medium">{contact}</span>
                {a.contactPhone && <a href={`tel:${a.contactPhone}`} onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-orange-600 hover:underline">
                  <Phone className="h-3 w-3" />{a.contactPhone}</a>}
                {a.contactEmail && <a href={`mailto:${a.contactEmail}`} onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-orange-600 hover:underline">
                  <Mail className="h-3 w-3" />{a.contactEmail}</a>}
              </div>
            )}
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={onEdit} title="Edit">
              <Edit2 className="h-4 w-4 text-slate-500" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onDelete} title="Delete">
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onToggle}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {expanded && <AssetDetail asset={a} onChanged={onChanged} />}
      </CardContent>
    </Card>
  );
}

function AssetDetail({ asset: a, onChanged }) {
  const { symbol, fmt: fmtMoney } = useCurrency();
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [svc, setSvc] = useState({
    servicedOn: new Date().toISOString().slice(0, 10),
    kind: "service", engineer: "", company: a.contactCompany ?? "",
    cost: "", underWarranty: a.warranty === "VALID", summary: "", nextDue: "",
  });
  const [uploading, setUploading] = useState(false);
  const [docKind, setDocKind] = useState("warranty");

  const loadServices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assets/service?assetId=${a.id}`, { cache: "no-store" });
      const j = await res.json();
      setServices(j.services ?? []);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [a.id]);

  useEffect(() => { loadServices(); }, [loadServices]);

  async function logService() {
    setLogging(true);
    setErr("");
    try {
      const res = await fetch("/api/assets/service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...svc, assetId: a.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not log the service");
      }
      setShowForm(false);
      setSvc({ ...svc, engineer: "", cost: "", summary: "", nextDue: "" });
      await loadServices();
      await onChanged();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLogging(false);
    }
  }

  async function upload(file, serviceId) {
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("assetId", a.id);
      fd.append("kind", docKind);
      if (serviceId) fd.append("serviceId", serviceId);
      const res = await fetch("/api/assets/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Upload failed");
      }
      await onChanged();
      await loadServices();
    } catch (e) {
      setErr(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function deleteDoc(id) {
    try {
      await fetch(`/api/assets/doc?id=${id}`, { method: "DELETE" });
      await onChanged();
      await loadServices();
    } catch { /* surfaced on next load */ }
  }

  const assetDocs = (a.docs ?? []).filter((d) => !d.serviceId);

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{err}</div>
      )}

      {(a.warrantyNotes || a.notes || a.purchaseDate || a.purchasePrice != null) && (
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          {a.purchaseDate && <Detail label="Purchased">{fmt(a.purchaseDate)}</Detail>}
          {a.purchasePrice != null && <Detail label="Purchase price">{fmtMoney(Number(a.purchasePrice))}</Detail>}
          {a.serviceIntervalMonths && <Detail label="Service interval">Every {a.serviceIntervalMonths} months</Detail>}
          {a.lastServiceDate && <Detail label="Last serviced">{fmt(a.lastServiceDate)}</Detail>}
          {a.warrantyProvider && <Detail label="Warranty provider">{a.warrantyProvider}</Detail>}
          {a.warrantyNotes && <Detail label="Warranty notes" wide>{a.warrantyNotes}</Detail>}
          {a.notes && <Detail label="Notes" wide>{a.notes}</Detail>}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paperwork</h4>
          <div className="flex items-center gap-2">
            <Select value={docKind} onValueChange={setDocKind}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_KINDS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border cursor-pointer",
              uploading ? "opacity-50 cursor-wait" : "hover:bg-slate-50"
            )}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Add photo / scan
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={uploading}
                onChange={(e) => { upload(e.target.files?.[0], null); e.target.value = ""; }} />
            </label>
          </div>
        </div>
        {assetDocs.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nothing attached yet. A photo of the warranty card or the purchase invoice is the thing you'll want
            when something breaks.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assetDocs.map((d) => <DocChip key={d.id} doc={d} onDelete={() => deleteDoc(d.id)} />)}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Service history</h4>
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)} className="h-8 text-xs">
            {showForm ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
            {showForm ? "Cancel" : "Log a service"}
          </Button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3 grid sm:grid-cols-2 gap-2.5">
            <Field label="Date"><Input type="date" className="bg-white" value={svc.servicedOn}
              onChange={(e) => setSvc({ ...svc, servicedOn: e.target.value })} /></Field>
            <Field label="What was it">
              <Select value={svc.kind} onValueChange={(v) => setSvc({ ...svc, kind: v })}>
                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Engineer"><Input className="bg-white" value={svc.engineer}
              onChange={(e) => setSvc({ ...svc, engineer: e.target.value })} /></Field>
            <Field label="Company"><Input className="bg-white" value={svc.company}
              onChange={(e) => setSvc({ ...svc, company: e.target.value })} /></Field>
            <Field label={`Cost (${symbol})`}><Input type="number" step="0.01" className="bg-white" value={svc.cost}
              onChange={(e) => setSvc({ ...svc, cost: e.target.value })} placeholder="0.00" /></Field>
            <Field label="Next due (optional)"><Input type="date" className="bg-white" value={svc.nextDue}
              onChange={(e) => setSvc({ ...svc, nextDue: e.target.value })} /></Field>
            <Field label="What was done" className="sm:col-span-2">
              <Textarea rows={2} className="bg-white" value={svc.summary}
                onChange={(e) => setSvc({ ...svc, summary: e.target.value })}
                placeholder="Replaced door seal, regassed, cleaned condenser…" />
            </Field>
            <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={svc.underWarranty}
                onChange={(e) => setSvc({ ...svc, underWarranty: e.target.checked })} />
              Covered by warranty (we didn't pay)
            </label>
            <div className="sm:col-span-2 flex justify-end">
              <Button size="sm" onClick={logService} disabled={logging} className="bg-orange-500 hover:bg-orange-600">
                {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Save service
              </Button>
            </div>
            <p className="sm:col-span-2 text-[11px] text-slate-500">
              A routine service or inspection rolls the next due date forward by the interval. A repair or callout
              doesn't — fixing a breakdown isn't the annual service.
            </p>
          </div>
        )}

        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
        ) : services?.length === 0 ? (
          <p className="text-xs text-slate-400">No services logged yet.</p>
        ) : (
          <div className="space-y-2">
            {services?.map((s) => (
              <div key={s.id} className="rounded border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-sm font-medium text-slate-800">
                    {fmt(s.servicedOn)}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {SERVICE_KINDS.find((k) => k.value === s.kind)?.label ?? s.kind}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.underWarranty && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">Under warranty</Badge>
                    )}
                    {s.cost != null && <span className="text-xs text-slate-600">{fmtMoney(Number(s.cost))}</span>}
                    <label className="text-[11px] text-orange-600 hover:underline cursor-pointer">
                      attach
                      <input type="file" accept="image/*,application/pdf" className="hidden"
                        onChange={(e) => { upload(e.target.files?.[0], s.id); e.target.value = ""; }} />
                    </label>
                  </div>
                </div>
                {(s.engineer || s.company) && (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {[s.engineer, s.company].filter(Boolean).join(" · ")}
                  </div>
                )}
                {s.summary && <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{s.summary}</p>}
                {s.nextDue && (
                  <div className="text-[11px] text-slate-500 mt-1">Set next due to {fmt(s.nextDue)}</div>
                )}
                {s.docs?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {s.docs.map((d) => <DocChip key={d.id} doc={d} onDelete={() => deleteDoc(d.id)} small />)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, children, wide }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="text-slate-400 uppercase tracking-wide text-[10px]">{label}</div>
      <div className="text-slate-700 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

function DocChip({ doc, onDelete, small }) {
  const isImage = (doc.mimeType ?? "").startsWith("image/");
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white pl-2 pr-1 py-1",
      small ? "text-[11px]" : "text-xs"
    )}>
      {isImage ? <Paperclip className="h-3 w-3 text-slate-400" /> : <FileText className="h-3 w-3 text-slate-400" />}
      <a href={`/api/assets/doc?id=${doc.id}`} target="_blank" rel="noreferrer"
        className="text-slate-700 hover:text-orange-600 hover:underline max-w-[160px] truncate">
        {DOC_KINDS.find((k) => k.value === doc.kind)?.label ?? doc.kind}
      </a>
      <button onClick={onDelete} className="p-0.5 hover:bg-slate-100 rounded" title="Remove">
        <X className="h-3 w-3 text-slate-400" />
      </button>
    </span>
  );
}
