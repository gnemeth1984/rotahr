"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  Tag,
  Calendar,
  Phone,
  Mail,
  Eye,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Merge,
  X,
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

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      fetchCustomers();
    }, 300);
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
      <div className="flex items-center justify-center h-64 text-gray-500">
        Access restricted to managers and admins.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600" />
            Customer CRM
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} customers · auto-built from reservations
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length === 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowMerge(true); setKeepId(selectedIds[0]); }}
              className="gap-2"
            >
              <Merge className="h-4 w-4" />
              Merge 2
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44">
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
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastVisit">Last Visit</SelectItem>
            <SelectItem value="visits">Most Visits</SelectItem>
            <SelectItem value="noShows">No-show Risk</SelectItem>
            <SelectItem value="name">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tag quick filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        {TAG_PRESETS.map((t) => (
          <button
            key={t}
            onClick={() => setTagFilter(tagFilter === t ? "" : t)}
            className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
              tagFilter === t
                ? TAG_COLORS[t] + " ring-2 ring-offset-1 ring-indigo-400"
                : TAG_COLORS[t] + " opacity-60 hover:opacity-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Loading…</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No customers yet</p>
          <p className="text-sm mt-1">They'll appear automatically as reservations come in.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left w-8"></th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Tags</th>
                <th className="px-4 py-3 text-center">Visits</th>
                <th className="px-4 py-3 text-center">No-shows</th>
                <th className="px-4 py-3 text-left">Last Visit</th>
                <th className="px-4 py-3 text-left">GDPR</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className={`hover:bg-indigo-50/40 transition-colors ${selectedIds.includes(c.id) ? "bg-indigo-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      className="rounded border-gray-300 text-indigo-600"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.birthday && (
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(c.birthday).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.email && (
                      <div className="flex items-center gap-1 text-xs">
                        <Mail className="h-3 w-3" /> {c.email}
                      </div>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-1 text-xs mt-0.5">
                        <Phone className="h-3 w-3" /> {c.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TAG_COLORS[t] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-gray-800">{c.totalVisits}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.noShows > 0 ? (
                      <span className="text-red-600 font-semibold flex items-center justify-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> {c.noShows}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{formatDate(c.lastVisit)}</td>
                  <td className="px-4 py-3">
                    {c.gdprConsent ? (
                      <span className="text-green-600 text-xs font-medium">✓ Consented</span>
                    ) : (
                      <span className="text-gray-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => router.push(`/crm/${c.id}`)}
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {Math.ceil(total / 50)}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 50)} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Name *</Label>
                <Input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Doe" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={createForm.phone} onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+353..." />
              </div>
              <div>
                <Label>Birthday</Label>
                <Input type="date" value={createForm.birthday} onChange={(e) => setCreateForm((f) => ({ ...f, birthday: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
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
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                      createForm.tags.includes(t)
                        ? TAG_COLORS[t] + " ring-2 ring-indigo-400 ring-offset-1"
                        : "bg-gray-100 text-gray-600 border-gray-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Dietary Notes</Label>
              <Input value={createForm.dietaryNotes} onChange={(e) => setCreateForm((f) => ({ ...f, dietaryNotes: e.target.value }))} placeholder="Vegetarian, gluten-free..." />
            </div>
            <div>
              <Label>Allergies</Label>
              <Input value={createForm.allergies} onChange={(e) => setCreateForm((f) => ({ ...f, allergies: e.target.value }))} placeholder="Nuts, shellfish..." />
            </div>
            <div>
              <Label>Internal Notes</Label>
              <Input value={createForm.internalNotes} onChange={(e) => setCreateForm((f) => ({ ...f, internalNotes: e.target.value }))} placeholder="Prefers window table..." />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="gdpr"
                checked={createForm.gdprConsent}
                onCheckedChange={(v) => setCreateForm((f) => ({ ...f, gdprConsent: !!v }))}
              />
              <Label htmlFor="gdpr" className="text-sm cursor-pointer">
                Customer consents to marketing emails (GDPR)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createCustomer} disabled={creating || !createForm.name} className="bg-indigo-600 hover:bg-indigo-700">
              {creating ? "Creating…" : "Create Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMerge} onOpenChange={setShowMerge}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Merge Customers</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mb-3">
            Choose which profile to keep. All reservations, notes, and emails from the other will be moved across, then it will be deleted.
          </p>
          <div className="space-y-2">
            {selectedIds.map((id) => {
              const c = customers.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => setKeepId(id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    keepId === id ? "border-indigo-500 bg-indigo-50 font-medium" : "border-gray-200 hover:border-indigo-300"
                  }`}
                >
                  <span className="font-medium">{c?.name}</span>
                  {c?.email && <span className="text-gray-500 ml-2">{c.email}</span>}
                  {keepId === id && <span className="text-indigo-600 ml-2 text-xs">← Keep this one</span>}
                </button>
              );
            })}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowMerge(false)}>Cancel</Button>
            <Button onClick={mergeCustomers} disabled={merging || !keepId} className="bg-red-600 hover:bg-red-700">
              {merging ? "Merging…" : "Merge & Delete Duplicate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
