// @ts-nocheck
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  Award, Plus, AlertTriangle, CheckCircle2, Clock, Loader2,
  Trash2, Edit2, X, Upload, Filter, Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";

const CATEGORIES = [
  { value: "HACCP", label: "HACCP / Food Safety" },
  { value: "ALCOHOL", label: "Alcohol / Bar Skills (RSA)" },
  { value: "MANUAL_HANDLING", label: "Manual Handling" },
  { value: "FIRST_AID", label: "First Aid" },
  { value: "FOOD_SAFETY", label: "Food Safety Management" },
  { value: "OTHER", label: "Other" },
];

type Cert = {
  id: string;
  employeeId: string;
  title: string;
  issuer?: string;
  category: string;
  issuedDate?: string;
  expiryDate?: string;
  documentUrl?: string;
  notes?: string;
  status: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY";
  employee: { id: string; firstName: string; lastName: string; email: string };
};

type Employee = { id: string; firstName: string; lastName: string };

function statusBadge(status: string) {
  switch (status) {
    case "EXPIRED":
      return <Badge variant="destructive">Expired</Badge>;
    case "EXPIRING_SOON":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Expiring Soon</Badge>;
    case "VALID":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Valid</Badge>;
    default:
      return <Badge variant="outline">No Expiry</Badge>;
  }
}

function categoryLabel(cat: string) {
  return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

const EMPTY_FORM = {
  employeeId: "",
  title: "",
  issuer: "",
  category: "HACCP",
  issuedDate: "",
  expiryDate: "",
  notes: "",
  documentUrl: "",
};

function TrainingInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const empParam = searchParams.get("employeeId");
  const role = session?.user?.role;
  const isManager = role === Role.MANAGER || role === Role.ADMIN;

  const [certs, setCerts] = useState<Cert[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterEmp, setFilterEmp] = useState<string>(empParam ?? "");

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Cert | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const certFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/certifications").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ]).then(([certsData, empData]) => {
      setCerts(certsData.certifications ?? []);
      setEmployees(empData.employees ?? empData ?? []);
      setLoading(false);
    });
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(cert: Cert) {
    setEditing(cert);
    setForm({
      employeeId: cert.employeeId,
      title: cert.title,
      issuer: cert.issuer ?? "",
      category: cert.category,
      issuedDate: cert.issuedDate ? cert.issuedDate.split("T")[0] : "",
      expiryDate: cert.expiryDate ? cert.expiryDate.split("T")[0] : "",
      notes: cert.notes ?? "",
      documentUrl: cert.documentUrl ?? "",
    });
    setShowDialog(true);
  }

  async function uploadCertImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", "cert");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        setForm((f) => ({ ...f, documentUrl: data.url }));
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveCert() {
    setSaving(true);
    const payload = {
      ...form,
      issuedDate: form.issuedDate || null,
      expiryDate: form.expiryDate || null,
      documentUrl: form.documentUrl || null,
    };
    try {
      if (editing) {
        const res = await fetch(`/api/certifications/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        setCerts((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? { ...c, ...data.certification, employee: c.employee }
              : c
          )
        );
      } else {
        const res = await fetch("/api/certifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const emp = employees.find((e) => e.id === form.employeeId);
        if (data.certification && emp) {
          setCerts((prev) => [
            {
              ...data.certification,
              employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName, email: "" },
            },
            ...prev,
          ]);
        }
      }
      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCert(id: string) {
    await fetch(`/api/certifications/${id}`, { method: "DELETE" });
    setCerts((prev) => prev.filter((c) => c.id !== id));
    setDeleteId(null);
  }

  const filtered = certs.filter((c) => {
    const name = `${c.employee.firstName} ${c.employee.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) || c.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "ALL" || c.category === filterCat;
    const matchStatus = filterStatus === "ALL" || c.status === filterStatus;
    const matchEmp = !filterEmp || c.employeeId === filterEmp;
    return matchSearch && matchCat && matchStatus && matchEmp;
  });

  // Summary counts
  const expired = certs.filter((c) => c.status === "EXPIRED").length;
  const expiringSoon = certs.filter((c) => c.status === "EXPIRING_SOON").length;
  const valid = certs.filter((c) => c.status === "VALID").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // Find employee name for banner
  const filteredEmpName = filterEmp
    ? employees.find((e) => e.id === filterEmp)
    : null;

  return (
    <div className="space-y-6">
      {/* Deep-link employee filter banner */}
      {filterEmp && (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800">
          <span>
            Showing certifications for{" "}
            <strong>
              {filteredEmpName
                ? `${filteredEmpName.firstName} ${filteredEmpName.lastName}`
                : "this employee"}
            </strong>
          </span>
          <button
            onClick={() => setFilterEmp("")}
            className="ml-4 flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
          >
            <X className="h-3.5 w-3.5" />
            Clear filter
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Training & Certifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            HACCP, alcohol serving certs, manual handling, first aid — track expiry dates and stay compliant
          </p>
        </div>
        {isManager && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Certificate
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{expired}</p>
              <p className="text-xs text-slate-500">Expired</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{expiringSoon}</p>
              <p className="text-xs text-slate-500">Expiring within 30 days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{valid}</p>
              <p className="text-xs text-slate-500">Valid</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or cert title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
                <SelectItem value="VALID">Valid</SelectItem>
                <SelectItem value="NO_EXPIRY">No Expiry</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Award className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No certifications found</p>
            <p className="text-slate-400 text-sm mt-1">
              {certs.length === 0
                ? "Add your first staff certificate to start tracking compliance"
                : "Try adjusting the filters"}
            </p>
            {isManager && certs.length === 0 && (
              <Button className="mt-4" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" /> Add Certificate
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left p-3 font-medium text-slate-600">Employee</th>
                  <th className="text-left p-3 font-medium text-slate-600">Certificate</th>
                  <th className="text-left p-3 font-medium text-slate-600">Category</th>
                  <th className="text-left p-3 font-medium text-slate-600">Issued</th>
                  <th className="text-left p-3 font-medium text-slate-600">Expires</th>
                  <th className="text-left p-3 font-medium text-slate-600">Status</th>
                  {isManager && <th className="p-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((cert) => (
                  <tr
                    key={cert.id}
                    className={cn(
                      "hover:bg-slate-50",
                      cert.status === "EXPIRED" && "bg-red-50/50",
                      cert.status === "EXPIRING_SOON" && "bg-amber-50/50"
                    )}
                  >
                    <td className="p-3 font-medium text-slate-800">
                      {cert.employee.firstName} {cert.employee.lastName}
                    </td>
                    <td className="p-3 text-slate-700">
                      <p className="font-medium flex items-center gap-1.5">
                        {cert.title}
                        {cert.documentUrl && (
                          <a href={cert.documentUrl} target="_blank" rel="noopener noreferrer" title="View certificate" className="text-blue-400 hover:text-blue-600">
                            <Upload className="h-3 w-3 rotate-180" />
                          </a>
                        )}
                      </p>
                      {cert.issuer && <p className="text-xs text-slate-400">{cert.issuer}</p>}
                    </td>
                    <td className="p-3 text-slate-600">{categoryLabel(cert.category)}</td>
                    <td className="p-3 text-slate-500">
                      {cert.issuedDate
                        ? new Date(cert.issuedDate).toLocaleDateString("en-IE")
                        : "—"}
                    </td>
                    <td className="p-3 text-slate-500">
                      {cert.expiryDate
                        ? new Date(cert.expiryDate).toLocaleDateString("en-IE")
                        : "—"}
                    </td>
                    <td className="p-3">{statusBadge(cert.status)}</td>
                    {isManager && (
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => openEdit(cert)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            onClick={() => setDeleteId(cert.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Certificate" : "Add Certificate"}</DialogTitle>
            <DialogDescription>
              Track training certifications and set expiry date alerts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Employee</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Certificate Title</Label>
              <Input
                placeholder="e.g. HACCP Level 2, RSA Bar Skills"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issuer (optional)</Label>
              <Input
                placeholder="e.g. Failte Ireland, QQI, HSA"
                value={form.issuer}
                onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date Issued</Label>
                <Input
                  type="date"
                  value={form.issuedDate}
                  onChange={(e) => setForm((f) => ({ ...f, issuedDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any additional notes..."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            {/* Certificate image/document upload */}
            <div>
              <Label>Certificate Image / Document</Label>
              <input
                ref={certFileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCertImage(f);
                }}
              />
              {form.documentUrl ? (
                <div className="mt-1.5 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {form.documentUrl.match(/\.(jpg|jpeg|png|webp|gif)/i) ? (
                    <img src={form.documentUrl} alt="cert" className="h-10 w-10 object-cover rounded border border-slate-200 flex-shrink-0" />
                  ) : (
                    <Award className="h-5 w-5 text-slate-400 flex-shrink-0" />
                  )}
                  <a href={form.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex-1 truncate">View uploaded file</a>
                  <button onClick={() => setForm((f) => ({ ...f, documentUrl: "" }))} className="text-slate-400 hover:text-red-500 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => certFileRef.current?.click()}
                  disabled={uploading}
                  className="mt-1.5 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-lg py-3 text-sm text-slate-500 hover:border-blue-300 hover:text-blue-500 transition-colors"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Upload cert image or PDF"}
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveCert} disabled={saving || !form.employeeId || !form.title}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Save Changes" : "Add Certificate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Certificate?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteCert(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TrainingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" /></div>}>
      <TrainingInner />
    </Suspense>
  );
}
