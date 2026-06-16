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
import { Users, Search, Pencil, Plus, Loader2, Phone, ShieldAlert, HeartPulse } from "lucide-react";
import { UserRole as Role } from "@/types/roles";

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  ppsNumber: string | null;
  role: string;
  active: boolean;
  departmentId: string | null;
  department?: { id: string; name: string } | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  medicalConditions: string | null;
  medications: string | null;
  bloodType: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  medicalNotes: string | null;
  _count?: { shifts: number };
}

interface Department {
  id: string;
  name: string;
}

const EMPTY_ADD = {
  firstName: "", lastName: "", email: "", phone: "", ppsNumber: "",
  role: "staff", departmentId: "",
  emergencyName: "", emergencyPhone: "", emergencyRelation: "",
  medicalConditions: "", medications: "", bloodType: "",
  doctorName: "", doctorPhone: "", medicalNotes: "",
};

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD);
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_ADD);
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
      const body: Record<string, string | undefined> = {
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        email: addForm.email,
        role: addForm.role,
        phone: addForm.phone || undefined,
        ppsNumber: addForm.ppsNumber || undefined,
        departmentId: addForm.departmentId || undefined,
        emergencyName: addForm.emergencyName || undefined,
        emergencyPhone: addForm.emergencyPhone || undefined,
        emergencyRelation: addForm.emergencyRelation || undefined,
        medicalConditions: addForm.medicalConditions || undefined,
        medications: addForm.medications || undefined,
        bloodType: addForm.bloodType || undefined,
        doctorName: addForm.doctorName || undefined,
        doctorPhone: addForm.doctorPhone || undefined,
        medicalNotes: addForm.medicalNotes || undefined,
      };
      const res = await fetch("/api/employee/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error ?? "Failed to add employee"); return; }
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
      phone: emp.phone ?? "",
      ppsNumber: emp.ppsNumber ?? "",
      role: emp.role,
      departmentId: emp.departmentId ?? "",
      emergencyName: emp.emergencyName ?? "",
      emergencyPhone: emp.emergencyPhone ?? "",
      emergencyRelation: emp.emergencyRelation ?? "",
      medicalConditions: emp.medicalConditions ?? "",
      medications: emp.medications ?? "",
      bloodType: emp.bloodType ?? "",
      doctorName: emp.doctorName ?? "",
      doctorPhone: emp.doctorPhone ?? "",
      medicalNotes: emp.medicalNotes ?? "",
    });
    setEditError("");
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee) return;
    setEditError("");
    setEditSaving(true);
    try {
      const body = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone || null,
        ppsNumber: editForm.ppsNumber || null,
        role: editForm.role,
        departmentId: editForm.departmentId || null,
        emergencyName: editForm.emergencyName || null,
        emergencyPhone: editForm.emergencyPhone || null,
        emergencyRelation: editForm.emergencyRelation || null,
        medicalConditions: editForm.medicalConditions || null,
        medications: editForm.medications || null,
        bloodType: editForm.bloodType || null,
        doctorName: editForm.doctorName || null,
        doctorPhone: editForm.doctorPhone || null,
        medicalNotes: editForm.medicalNotes || null,
      };
      const res = await fetch(`/api/employee/${editEmployee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    form: typeof EMPTY_ADD,
    setForm: (f: typeof EMPTY_ADD) => void
  ) => (
    <div className="space-y-5">
      {/* Basic info */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Basic Info</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input type="tel" placeholder="+353..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>PPS Number</Label>
              <Input placeholder="1234567A" value={form.ppsNumber} onChange={(e) => setForm({ ...form, ppsNumber: e.target.value })} />
            </div>
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
      </div>

      {/* Emergency contact */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Emergency Contact</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="Jane Doe" value={form.emergencyName} onChange={(e) => setForm({ ...form, emergencyName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Input placeholder="Spouse, Parent..." value={form.emergencyRelation} onChange={(e) => setForm({ ...form, emergencyRelation: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input type="tel" placeholder="+353..." value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Medical info */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Medical Info</p>
          <span className="text-[10px] text-slate-400 normal-case tracking-normal">— confidential, manager only</span>
        </div>
        <div className="space-y-3 bg-rose-50/50 border border-rose-100 rounded-lg p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Blood Type</Label>
              <Input placeholder="A+, O-, B+…" value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Allergies / Conditions</Label>
              <Input placeholder="e.g. Penicillin allergy, Asthma" value={form.medicalConditions} onChange={(e) => setForm({ ...form, medicalConditions: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Current Medications</Label>
            <Input placeholder="e.g. Ventolin inhaler" value={form.medications} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Doctor / GP Name</Label>
              <Input placeholder="Dr. Murphy" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Doctor Phone</Label>
              <Input type="tel" placeholder="+353..." value={form.doctorPhone} onChange={(e) => setForm({ ...form, doctorPhone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Additional Medical Notes</Label>
            <Input placeholder="Any other relevant information…" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} />
          </div>
        </div>
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
          <Button onClick={() => { setAddForm(EMPTY_ADD); setAddError(""); setAddOpen(true); }} className="gap-2">
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
                  <Avatar className="h-10 w-10 flex-shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                      {getInitials(`${emp.firstName} ${emp.lastName}`)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-slate-900">{emp.firstName} {emp.lastName}</p>
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
                      {emp.emergencyName && (
                        <span className="text-xs text-amber-600 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />{emp.emergencyName}
                        </span>
                      )}
                      {emp.medicalConditions && (
                        <span className="text-xs text-rose-500 flex items-center gap-1">
                          <HeartPulse className="h-3 w-3" />Medical info on file
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4 py-1">
            {renderFormFields(editForm, setEditForm)}
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
