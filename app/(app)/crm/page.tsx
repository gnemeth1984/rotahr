"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users,
  Search,
  Download,
  Plus,
  Calendar,
  Phone,
  Mail,
  Eye,
  AlertCircle,
  Merge,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const TAG_PRESETS = ["VIP", "Regular", "No-show Risk", "Allergy", "Corporate", "Birthday"];

const TAG_COLORS: Record<string, string> = {
  VIP: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Regular: "bg-blue-100 text-blue-800 border-blue-300",
  "No-show Risk": "bg-red-100 text-red-800 border-red-300",
  Allergy: "bg-orange-100 text-orange-800 border-orange-300",
  Corporate: "bg-purple-100 text-purple-800 border-purple-300",
  Birthday: "bg-pink-100 text-pink-800 border-pink-300",
};

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
  totalVisits: number;
  noShows: number;
  lastVisit: string | null;
  gdprConsent: boolean;
  birthday: string | null;
  createdAt: string;
}

export default function CrmPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [sort, setSort] = useState("lastVisit");
  const [page, setPage] = useState(1);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    birthday: "",
    dietaryNotes: "",
    allergies: "",
    tags: [] as string[],
    internalNotes: "",
    gdprConsent: false,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMerge, setShowMerge] = useState(false);
  const [merging, setMerging] = useState(false);
  const [keepId, setKeepId] = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        sort,
        page: String(page),
        ...(tagFilter ? { tag: tagFilter } : {}),
      });
      const res = await fetch(`/api/crm/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [search, sort, page, tagFilter]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchCustomers(); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const exportCSV = async () => {
    const res = await fetch("/api/crm/customers/export");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createCustomer = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/crm/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          email: createForm.email || null,
          phone: createForm.phone || null,
          birthday: createForm.birthday || null,
          dietaryNotes: createForm.dietaryNotes || null,
          allergies: createForm.allergies || null,
          internalNotes: createForm.internalNotes || null,
        }),
      });
      if (res.ok) {
        const c = await res.json();
        setShowCreate(false);
        setCreateForm({ name: "", email: "", phone: "", birthday: "", dietaryNotes: "", allergies: "", tags: [], internalNotes: "", gdprConsent: false });
        router.push(`/crm/${c.id}`);
      } else {
        const err = await res.json();
        if (res.status === 409) alert(`Duplicate: ${err.error}`);
        else alert("Failed to create customer");
      }
    } finally {
      setCreating(false);
    }
  };

  const mergeCustomers = async () => {
    if (!keepId || selectedIds.length !== 2) return;
    const mergeId = selectedIds.find((id) => id !== keepId)!;
    setMerging(true);
    try {
      const res = await fetch("/api/crm/customers/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepId, mergeId }),
      });
      if (res.ok) {
        setShowMerge(false);
        setSelectedIds([]);
        setKeepId("");
        fetchCustomers();
      } else {
        alert("Merge failed");
      }
    } finally {
      setMerging(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
  };

  if (!["ADMIN", "MANAGER"].includes(session?.user?.role ?? "")) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm px-4 text-center">
        Access restricted to managers and admins.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600 flex-shrink-0" />
            CRM
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{total} customers</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedIds.length === 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowMerge(true); setKeepId(selectedIds[0]); }}
              className="gap-1.5 h-9 px-3"
            >
              <Merge className="h-3.5 w-3.5" />
              Merge
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 h-9 px-3">
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5 h-9 px-3 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      {/* ── Search + filters ── */}
      <div className="px-4 pb-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {TAG_PRESETS.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lastVisit">Last Visit</SelectItem>
              <SelectItem value="visits">Most Visits</SelectItem>
              <SelectItem value="noShows">No-shows</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Tag quick filters ── */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {TAG_PRESETS.map((t) => (
          <button
            key={t}
            onClick={() => setTagFilter(tagFilter === t ? "" : t)}
            className={cn(
              "flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
              tagFilter === t
                ? TAG_COLORS[t] + " ring-2 ring-offset-1 ring-indigo-400"
                : TAG_COLORS[t] + " opacity-60 hover:opacity-100"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Customer list ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2">
        {loading ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Users className="h-12 w-12 text-slate-200" />
            <p className="text-slate-400 font-medium text-sm">No customers yet</p>
            <p className="text-slate-300 text-xs text-center max-w-[220px]">
              They appear automatically as reservations come in.
            </p>
          </div>
        ) : (
          customers.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/crm/${c.id}`)}
              className={cn(
                "w-full text-left bg-white border rounded-2xl p-4 transition-all shadow-sm hover:shadow-md active:scale-[0.98]",
                selectedIds.includes(c.id) ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <div
                  className="flex-shrink-0 mt-0.5"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelect(c.id)}
                    className="rounded border-slate-300 text-indigo-600 h-4 w-4"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Name + visit count */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">{c.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.noShows > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-red-600 font-medium">
                          <AlertCircle className="h-3 w-3" />{c.noShows}
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{c.totalVisits} visits</span>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                    )}
                    {c.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        {c.phone}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full border font-medium",
                            TAG_COLORS[t] ?? "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer: last visit + GDPR */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Last visit: {formatDate(c.lastVisit)}</span>
                    {c.gdprConsent && (
                      <span className="text-green-600 font-medium">✓ GDPR</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between pt-2 text-sm text-slate-600">
            <span className="text-xs">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@..." className="mt-1" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+353..." className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Birthday</Label>
              <Input type="date" value={createForm.birthday} onChange={(e) => setCreateForm((f) => ({ ...f, birthday: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {TAG_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      setCreateForm((f) => ({
                        ...f,
                        tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t],
                      }))
                    }
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border font-medium transition-all",
                      createForm.tags.includes(t)
                        ? TAG_COLORS[t] + " ring-2 ring-indigo-400 ring-offset-1"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Dietary / Allergies</Label>
              <Input value={createForm.dietaryNotes} onChange={(e) => setCreateForm((f) => ({ ...f, dietaryNotes: e.target.value }))} placeholder="Vegetarian, nuts..." className="mt-1" />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Input value={createForm.internalNotes} onChange={(e) => setCreateForm((f) => ({ ...f, internalNotes: e.target.value }))} placeholder="Prefers window table..." className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gdpr"
                checked={createForm.gdprConsent}
                onCheckedChange={(v) => setCreateForm((f) => ({ ...f, gdprConsent: !!v }))}
              />
              <Label htmlFor="gdpr" className="text-sm cursor-pointer leading-snug">
                Customer consents to marketing emails (GDPR)
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
            <Button onClick={createCustomer} disabled={creating || !createForm.name} className="flex-1 bg-indigo-600 hover:bg-indigo-700">
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating…</> : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Merge Dialog ── */}
      <Dialog open={showMerge} onOpenChange={setShowMerge}>
        <DialogContent className="max-w-sm mx-4 rounded-2xl">
          <DialogHeader>
            <DialogTitle>Merge Customers</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mb-3">
            Choose which profile to keep. All history from the other will be moved across, then deleted.
          </p>
          <div className="space-y-2">
            {selectedIds.map((id) => {
              const c = customers.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => setKeepId(id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all",
                    keepId === id ? "border-indigo-500 bg-indigo-50 font-medium" : "border-slate-200 hover:border-indigo-300"
                  )}
                >
                  <span className="font-medium">{c?.name}</span>
                  {c?.email && <span className="text-slate-500 ml-2 text-xs">{c.email}</span>}
                  {keepId === id && <span className="text-indigo-600 ml-2 text-xs">← Keep</span>}
                </button>
              );
            })}
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowMerge(false)} className="flex-1">Cancel</Button>
            <Button onClick={mergeCustomers} disabled={merging || !keepId} className="flex-1 bg-red-600 hover:bg-red-700">
              {merging ? "Merging…" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
