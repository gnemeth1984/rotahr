"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Users, Search, Pencil, Plus, Loader2, Trash2 } from "lucide-react";
import { UserRole as Role } from "@/types/roles";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  _count?: { shifts: number };
}

interface Department {
  id: string;
  name: string;
}

const EMPTY_ADD = { firstName: "", lastName: "", email: "", role: "staff", departmentId: "" };

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Edit dialog
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", role: "staff", departmentId: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const isManager =
    session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  useEffect(() => {
    fetchAll();
  }, []);

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
      const body: Record<string, string> = {
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        email: addForm.email,
        role: addForm.role,
      };
      if (addForm.departmentId) body.departmentId = addForm.departmentId;

      const res = await fetch("/api/employee/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add employee");
        return;
      }
      setAddOpen(false);
      setAddForm(EMPTY_ADD);
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
      role: emp.role,
      departmentId: emp.departmentId ?? "",
    });
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    setEditError("");
    setEditSaving(true);
    try {
      const body: Record<string, string | null> = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        role: editForm.role,
        departmentId: editForm.departmentId || null,
      };
      const res = await fetch(`/api/employee/${editEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Failed to update");
        return;
      }
      setEditEmployee(null);
      fetchAll();
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeactivate = async () => {
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

  // ── Filter ───────────────────────────────────────────────────────────────

  const filtered = employees.filter(
    (e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleColor = (role: string) => {
    if (role === "admin") return "default";
    if (role === "manager") return "secondary";
    return "outline";
  };

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
          <Button onClick={() => { setAddForm(EMPTY_ADD); setAddError(""); setAddOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search by name or email…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
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
              <p className="text-slate-400 text-sm mt-1">
                Click "Add Employee" to get started.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((emp) => (
            <Card key={emp.id} className={`hover:shadow-md transition-shadow ${!emp.active ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                      {getInitials(`${emp.firstName} ${emp.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <Badge variant={roleColor(emp.role)} className="capitalize text-xs">
                        {emp.role}
                      </Badge>
                      {!emp.active && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{emp.email}</p>
                    {emp.department && (
                      <p className="text-xs text-slate-400 mt-0.5">{emp.department.name}</p>
                    )}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">First name</Label>
                <Input
                  id="fn"
                  value={addForm.firstName}
                  onChange={(e) => setAddForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Last name</Label>
                <Input
                  id="ln"
                  value={addForm.lastName}
                  onChange={(e) => setAddForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="em">Email</Label>
              <Input
                id="em"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={addForm.role} onValueChange={(v) => setAddForm((f) => ({ ...f, role: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                    value={addForm.departmentId || "none"}
                    onValueChange={(v) => setAddForm((f) => ({ ...f, departmentId: v === "none" ? "" : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="efn">First name</Label>
                <Input
                  id="efn"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eln">Last name</Label>
                <Input
                  id="eln"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eem">Email</Label>
              <Input
                id="eem"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm((f) => ({ ...f, role: v }))}>
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
                    value={editForm.departmentId || "none"}
                    onValueChange={(v) => setEditForm((f) => ({ ...f, departmentId: v === "none" ? "" : v }))}
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
            {editError && <p className="text-sm text-red-500">{editError}</p>}
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeactivate}
                disabled={editSaving}
              >
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
