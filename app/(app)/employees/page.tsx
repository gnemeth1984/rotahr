"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Users, Search, Pencil, Plus, Loader2, Phone, ShieldCheck } from "lucide-react";
import { UserRole as Role } from "@/types/roles";

const GRANTABLE_PERMISSIONS = [
  { key: "bookkeeping", label: "Bookkeeping" },
  { key: "stocktaking", label: "Stock & Orders" },
  { key: "payroll", label: "Payroll" },
  { key: "tips", label: "Tips & Tronc" },
  { key: "bookings", label: "Bookings (manage)" },
  { key: "training", label: "Training & Certs (all staff)" },
  { key: "reports", label: "Dashboard reports" },
] as const;

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  active: boolean;
  departmentId: string | null;
  permissions: string[];
  department?: { id: string; name: string } | null;
  _count?: { shifts: number };
}

interface Department {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "staff",
  departmentId: "",
};

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        fetch("/api/employee/list"),
        fetch("/api/department/list"),
      ]);
      const empData = empRes.ok ? await empRes.json() : { employees: [] };
      const deptData = deptRes.ok ? await deptRes.json() : { departments: [] };
      setEmployees(empData.employees ?? []);
      setDepartments(deptData.departments ?? []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Add ──────────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSaving(true);
    try {
      const res = await fetch("/api/employee/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: addForm.firstName,
          lastName: addForm.lastName,
          email: addForm.email,
          phone: addForm.phone || undefined,
          role: addForm.role,
          departmentId: addForm.departmentId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Failed to add employee"); return; }
      setAddOpen(false);
      setAddForm(EMPTY_FORM);
      fetchAll();
    } finally {
      setAddSaving(false);
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
    setEditForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone ?? "",
      role: emp.role,
      departmentId: emp.departmentId ?? "",
    });
    setEditPermissions(emp.permissions ?? []);
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    setEditError("");
    setEditSaving(true);
    try {
      const res = await fetch(`/api/employee/${editEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone || null,
          role: editForm.role,
          departmentId: editForm.departmentId || null,
          permissions: editPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error ?? "Failed to update"); return; }
      setEditEmployee(null);
      fetchAll();
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!editEmployee) return;
    setEditSaving(true);
    try {
      await fetch(`/api/employee/${editEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !editEmployee.active }),
      });
      setEditEmployee(null);
      fetchAll();
    } finally {
      setEditSaving(false);
    }
  };

  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => {
    if (role === "admin") return "default";
    if (role === "manager") return "secondary";
    return "outline";
  };

  // ── Shared form fields ────────────────────────────────────────────────────

  const renderFormFields = (
    form: typeof EMPTY_FORM,
    setForm: (f: typeof EMPTY_FORM) => void
  ) => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>First name *</Label>
          <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
        </div>
        <div className="space-y-1.5">
          <Label>Last name *</Label>
          <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Email *</Label>
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
      </div>
      <div className="space-y-1.5">
        <Label>Phone</Label>
        <Input type="tel" placeholder="+353..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {departments.length > 0 && (
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={form.departmentId || "none"}
              onValueChange={(v) => setForm({ ...form, departmentId: v === "none" ? "" : v })}
            >
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {employees.length} team member{employees.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => { setAddForm(EMPTY_FORM); setAddError(""); setAddOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search by name or email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            <p className="text-slate-500 font-medium">
              {search ? "No employees match your search" : "No employees yet"}
            </p>
            {!search && isManager && (
              <p className="text-slate-400 text-sm mt-1">Click "Add Employee" to get started.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((emp) => (
            <Card key={emp.id} className={`hover:shadow-md transition-shadow ${!emp.active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Link href={`/employees/${emp.id}`} className="flex-shrink-0">
                    <Avatar className="h-10 w-10 hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer">
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                        {getInitials(`${emp.firstName} ${emp.lastName}`)}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/employees/${emp.id}`} className="font-semibold text-slate-900 hover:text-blue-600 transition-colors">
                        {emp.firstName} {emp.lastName}
                      </Link>
                      <Badge variant={roleColor(emp.role)} className="capitalize text-xs">{emp.role}</Badge>
                      {!emp.active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{emp.email}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {emp.department && (
                        <span className="text-xs text-slate-400">{emp.department.name}</span>
                      )}
                      {emp.phone && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="h-3 w-3" />{emp.phone}
                        </span>
                      )}
                      {emp.permissions && emp.permissions.length > 0 && emp.role === "staff" && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {emp.permissions.length} permission{emp.permissions.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  {emp._count !== undefined && (
                    <p className="text-xs text-slate-400 hidden sm:block flex-shrink-0">
                      {emp._count.shifts} shift{emp._count.shifts !== 1 ? "s" : ""}
                    </p>
                  )}
                  {isManager && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0" onClick={() => openEdit(emp)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>Add a new team member to your business.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 py-1">
            {renderFormFields(addForm, setAddForm)}
            {addError && <p className="text-sm text-red-500">{addError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addSaving}>
                {addSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Employee
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={(o) => !o && setEditEmployee(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-1">
            {renderFormFields(editForm, setEditForm)}

            {/* Permissions panel — only shown for non-manager staff */}
            {(editForm.role === "staff" || editForm.role === "EMPLOYEE") && (
              <div className="border rounded-lg p-3 space-y-2 bg-slate-50">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <p className="text-sm font-medium text-slate-700">Module Access</p>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Grant access to specific modules without changing their role.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {GRANTABLE_PERMISSIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <Checkbox
                        checked={editPermissions.includes(perm.key)}
                        onCheckedChange={(checked: boolean | "indeterminate") => {
                          setEditPermissions((prev) =>
                            checked === true
                              ? [...prev, perm.key]
                              : prev.filter((p) => p !== perm.key)
                          );
                        }}
                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                      />
                      <span className="text-xs text-slate-600 group-hover:text-slate-900">
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleToggleActive} disabled={editSaving}>
                {editEmployee?.active ? "Deactivate" : "Reactivate"}
              </Button>
              <div className="flex-1" />
              <Button type="button" variant="outline" onClick={() => setEditEmployee(null)}>Cancel</Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
