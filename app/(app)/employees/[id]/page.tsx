// @ts-nocheck
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCurrency } from "@/components/shared/CurrencyProvider";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, Calendar, Clock, Award,
  Loader2, ChevronRight, CheckCircle2, XCircle, Building2,
  FileText, Upload, Trash2, Plus, CheckSquare, Square, ExternalLink,
  FolderOpen, ClipboardList, Edit2, Save, X, MapPin, Globe,
  CreditCard, ShieldAlert, Contact,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, getInitials } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";

interface EmployeeProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  hourlyRate?: number | null;
  active: boolean;
  department?: { name: string } | null;
  venue?: { name: string } | null;
  permissions: string[];
  createdAt: string;
  // HR / Payroll
  startDate?: string | null;
  contractType?: string | null;
  address?: string | null;
  nationality?: string | null;
  ppsn?: string | null;
  bankIban?: string | null;
  bankBic?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  emergencyRel?: string | null;
}

interface Shift {
  id: string;
  startTime: string;
  endTime: string;
  role?: string | null;
  published: boolean;
}

interface TimeOff {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: string;
}

interface Cert {
  id: string;
  category: string;
  issuer?: string | null;
  expiryDate?: string | null;
  status: string;
}

interface EmployeeDoc {
  id: string;
  title: string;
  category: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  createdAt: string;
}

interface OnboardingTask {
  id: string;
  title: string;
  description?: string | null;
  completed: boolean;
  dueDate?: string | null;
  completedAt?: string | null;
  sortOrder: number;
}

const CONTRACT_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "casual": "Casual",
  "zero-hours": "Zero-hours",
};

function InfoField({ label, value, sensitive = false }: { label: string; value?: string | null; sensitive?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const display = value ?? "—";
  const masked = value ? "••••••••" : "—";
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-slate-400">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className={cn("text-sm font-medium", value ? "text-slate-800" : "text-slate-300")}>
          {sensitive && value && !revealed ? masked : display}
        </p>
        {sensitive && value && (
          <button
            onClick={() => setRevealed((r) => !r)}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            {revealed ? "hide" : "show"}
          </button>
        )}
      </div>
    </div>
  );
}

const CERT_LABELS: Record<string, string> = {
  HACCP: "HACCP / Food Safety",
  ALCOHOL: "Alcohol / RSA",
  MANUAL_HANDLING: "Manual Handling",
  FIRST_AID: "First Aid",
  FOOD_SAFETY: "Food Safety Mgmt",
  OTHER: "Other",
};

const DOC_CATEGORIES = [
  { value: "CONTRACT", label: "Contract" },
  { value: "ID", label: "ID Document" },
  { value: "CERT", label: "Certificate" },
  { value: "HANDBOOK", label: "Handbook" },
  { value: "TAX", label: "Tax / Revenue" },
  { value: "OTHER", label: "Other" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtFileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "onboarding", label: "Onboarding" },
  { id: "documents", label: "Documents" },
];

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { fmt } = useCurrency();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManager = session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeoff, setTimeoff] = useState<TimeOff[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Onboarding
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  // Documents
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("OTHER");

  // Edit HR fields
  const [editingHR, setEditingHR] = useState(false);
  const [hrSaving, setHrSaving] = useState(false);
  const [hrForm, setHrForm] = useState({
    startDate: "",
    contractType: "",
    address: "",
    nationality: "",
    ppsn: "",
    bankIban: "",
    bankBic: "",
    emergencyName: "",
    emergencyPhone: "",
    emergencyRel: "",
    hourlyRate: "",
    phone: "",
  });

  useEffect(() => {
    if (!session || !isManager) return;
    async function load() {
      setLoading(true);
      try {
        const [empRes, shiftsRes, toRes, certRes] = await Promise.allSettled([
          fetch(`/api/employee/${id}`),
          fetch(`/api/shifts/list?employeeId=${id}&limit=10`),
          fetch(`/api/timeoff?employeeId=${id}`),
          fetch(`/api/certifications?employeeId=${id}`),
        ]);

        if (empRes.status === "fulfilled" && empRes.value.ok) {
          const d = await empRes.value.json();
          const emp = d.employee;
          setEmployee(emp);
          setHrForm({
            startDate: emp.startDate ? emp.startDate.slice(0, 10) : "",
            contractType: emp.contractType ?? "",
            address: emp.address ?? "",
            nationality: emp.nationality ?? "",
            ppsn: emp.ppsn ?? "",
            bankIban: emp.bankIban ?? "",
            bankBic: emp.bankBic ?? "",
            emergencyName: emp.emergencyName ?? "",
            emergencyPhone: emp.emergencyPhone ?? "",
            emergencyRel: emp.emergencyRel ?? "",
            hourlyRate: emp.hourlyRate != null ? String(emp.hourlyRate) : "",
            phone: emp.phone ?? "",
          });
        }
        if (shiftsRes.status === "fulfilled" && shiftsRes.value.ok) {
          const d = await shiftsRes.value.json();
          const allShifts = d.shifts ?? [];
          setShifts(allShifts.slice(0, 8));
          const now = new Date();
          const mon = new Date(now);
          mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          mon.setHours(0, 0, 0, 0);
          const sun = new Date(mon);
          sun.setDate(mon.getDate() + 6);
          sun.setHours(23, 59, 59, 999);
          const thisWeek = allShifts.filter((s: Shift) => {
            const d = new Date(s.startTime);
            return d >= mon && d <= sun;
          });
          const hrs = thisWeek.reduce((sum: number, s: Shift) => {
            return sum + (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 3600000;
          }, 0);
          setWeeklyHours(Math.round(hrs * 10) / 10);
        }
        if (toRes.status === "fulfilled" && toRes.value.ok) {
          const d = await toRes.value.json();
          setTimeoff(Array.isArray(d) ? d.slice(0, 5) : []);
        }
        if (certRes.status === "fulfilled" && certRes.value.ok) {
          const d = await certRes.value.json();
          setCerts(d.certifications ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, session, isManager]);

  // Load onboarding tasks when tab opens
  useEffect(() => {
    if (activeTab === "onboarding" && id) loadTasks();
  }, [activeTab, id]);

  // Load documents when tab opens
  useEffect(() => {
    if (activeTab === "documents" && id) loadDocs();
  }, [activeTab, id]);

  const loadTasks = async () => {
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/hr/onboarding?employeeId=${id}`);
      const data = res.ok ? await res.json() : { tasks: [] };
      setTasks(data.tasks ?? []);
    } finally {
      setTasksLoading(false);
    }
  };

  const toggleTask = async (task: OnboardingTask) => {
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    await fetch(`/api/hr/onboarding/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
  };

  const addTask = async () => {
    if (!addTaskTitle.trim()) return;
    setAddingTask(true);
    try {
      const res = await fetch("/api/hr/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: id, title: addTaskTitle.trim() }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.task) setTasks((prev) => [...prev, data.task]);
      setAddTaskTitle("");
    } finally {
      setAddingTask(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/hr/onboarding/${taskId}`, { method: "DELETE" });
  };

  const loadDocs = async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/hr/documents?employeeId=${id}`);
      const data = res.ok ? await res.json() : { documents: [] };
      setDocs(data.documents ?? []);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !docTitle.trim()) {
      alert("Please enter a document title before uploading.");
      return;
    }
    setUploading(true);
    try {
      // Upload to Vercel Blob via existing upload endpoint
      const formData = new FormData();
      formData.append("file", file);
      const blobRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!blobRes.ok) { alert("Upload failed"); return; }
      const { url } = await blobRes.json();

      // Save document record
      const res = await fetch("/api/hr/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: id,
          title: docTitle.trim(),
          category: docCategory,
          fileUrl: url,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      const data = res.ok ? await res.json() : null;
      if (data?.document) {
        setDocs((prev) => [data.document, ...prev]);
        setDocTitle("");
        setDocCategory("OTHER");
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteDoc = async (docId: string) => {
    if (!confirm("Delete this document?")) return;
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    await fetch(`/api/hr/documents/${docId}`, { method: "DELETE" });
  };

  const saveHR = async () => {
    if (!employee) return;
    setHrSaving(true);
    try {
      const body: Record<string, any> = {
        startDate: hrForm.startDate || null,
        contractType: hrForm.contractType || null,
        address: hrForm.address || null,
        nationality: hrForm.nationality || null,
        ppsn: hrForm.ppsn || null,
        bankIban: hrForm.bankIban || null,
        bankBic: hrForm.bankBic || null,
        emergencyName: hrForm.emergencyName || null,
        emergencyPhone: hrForm.emergencyPhone || null,
        emergencyRel: hrForm.emergencyRel || null,
        phone: hrForm.phone || null,
        hourlyRate: hrForm.hourlyRate ? parseFloat(hrForm.hourlyRate) : null,
      };
      const res = await fetch(`/api/employee/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const d = await res.json();
        setEmployee((prev) => prev ? { ...prev, ...d.employee } : prev);
        setEditingHR(false);
      }
    } finally {
      setHrSaving(false);
    }
  };

  if (!isManager) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Managers only.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-20 text-slate-400">
        <p>Employee not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
      </div>
    );
  }

  const fullName = `${employee.firstName} ${employee.lastName}`;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const onboardingPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back */}
      <div>
        <Link href="/employees">
          <Button variant="ghost" size="sm" className="gap-1 text-slate-500 hover:text-slate-900 -ml-2">
            <ArrowLeft className="h-4 w-4" /> All Employees
          </Button>
        </Link>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-blue-600 text-white text-xl font-semibold">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{fullName}</h1>
                <Badge className={employee.active ? "bg-green-100 text-green-700 border-green-200" : ""} variant={employee.active ? "default" : "secondary"}>
                  {employee.active ? "Active" : "Inactive"}
                </Badge>
                <Badge variant="outline" className="capitalize">{employee.role}</Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                <span className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5" /> {employee.email}
                </span>
                {employee.phone && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Phone className="h-3.5 w-3.5" /> {employee.phone}
                  </span>
                )}
                {employee.department && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Building2 className="h-3.5 w-3.5" /> {employee.department.name}
                  </span>
                )}
              </div>
              {employee.permissions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {employee.permissions.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs capitalize">{p}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{weeklyHours}h</p>
              <p className="text-xs text-slate-500 mt-0.5">This week</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {employee.hourlyRate ? fmt(employee.hourlyRate) : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Hourly rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{certs.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Certs</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{docs.length || "—"}</p>
              <p className="text-xs text-slate-500 mt-0.5">Documents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
            {tab.id === "onboarding" && tasks.length > 0 && (
              <span className={cn(
                "ml-2 text-xs font-bold px-1.5 py-0.5 rounded-full",
                onboardingPct === 100 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              )}>
                {completedTasks}/{tasks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent shifts */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-600" /> Recent Shifts
                </CardTitle>
                <Link href="/rota">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                    Rota <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No shifts found</p>
              ) : (
                <div className="space-y-2">
                  {shifts.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{fmtDate(s.startTime)}</p>
                        <p className="text-xs text-slate-500">
                          {fmtTime(s.startTime)} – {fmtTime(s.endTime)}
                          {s.role && ` · ${s.role}`}
                        </p>
                      </div>
                      {s.published ? (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Published</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Draft</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time off */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" /> Time Off
                </CardTitle>
                <Link href="/timeoff">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                    Manage <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {timeoff.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No time off requests</p>
              ) : (
                <div className="space-y-2">
                  {timeoff.map((t) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                        </p>
                        {t.reason && <p className="text-xs text-slate-500">{t.reason}</p>}
                      </div>
                      <Badge className={cn("text-xs border",
                        t.status === "APPROVED" ? "bg-green-100 text-green-700 border-green-200" :
                        t.status === "REJECTED" ? "bg-red-100 text-red-700 border-red-200" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      )}>
                        {t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certifications */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4 text-violet-600" /> Certifications
                </CardTitle>
                <Link href="/training">
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
                    Manage <ChevronRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {certs.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No certifications on record</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {certs.map((c) => (
                    <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                      <div className={cn("h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                        c.status === "VALID" ? "bg-green-100" :
                        c.status === "EXPIRING_SOON" ? "bg-amber-100" : "bg-red-100"
                      )}>
                        <Award className={cn("h-4 w-4",
                          c.status === "VALID" ? "text-green-600" :
                          c.status === "EXPIRING_SOON" ? "text-amber-600" : "text-red-600"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900">{CERT_LABELS[c.category] ?? c.category}</p>
                        {c.expiryDate && <p className="text-xs text-slate-400">Expires {fmtDate(c.expiryDate)}</p>}
                      </div>
                      <Badge className={cn("text-xs border flex-shrink-0",
                        c.status === "VALID" ? "bg-green-100 text-green-700 border-green-200" :
                        c.status === "EXPIRING_SOON" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-red-100 text-red-700 border-red-200"
                      )}>
                        {c.status?.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Personal & Payroll ── */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600" /> Personal & Payroll
                </CardTitle>
                {!editingHR ? (
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setEditingHR(true)}>
                    <Edit2 className="h-3 w-3" /> Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-slate-500" onClick={() => setEditingHR(false)}>
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                    <Button size="sm" className="text-xs h-7 gap-1" onClick={saveHR} disabled={hrSaving}>
                      {hrSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {editingHR ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Employment */}
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Employment</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Start Date</Label>
                        <Input type="date" value={hrForm.startDate} onChange={(e) => setHrForm((f) => ({ ...f, startDate: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Contract Type</Label>
                        <Select value={hrForm.contractType} onValueChange={(v) => setHrForm((f) => ({ ...f, contractType: v }))}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full-time">Full-time</SelectItem>
                            <SelectItem value="part-time">Part-time</SelectItem>
                            <SelectItem value="casual">Casual</SelectItem>
                            <SelectItem value="zero-hours">Zero-hours</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hourly Rate (€)</Label>
                        <Input type="number" step="0.01" placeholder="e.g. 13.50" value={hrForm.hourlyRate} onChange={(e) => setHrForm((f) => ({ ...f, hourlyRate: e.target.value }))} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                  {/* Contact */}
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input placeholder="+353 …" value={hrForm.phone} onChange={(e) => setHrForm((f) => ({ ...f, phone: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">Address</Label>
                        <Input placeholder="Street, City, County" value={hrForm.address} onChange={(e) => setHrForm((f) => ({ ...f, address: e.target.value }))} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                  {/* Payroll */}
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Payroll</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">PPS Number</Label>
                        <Input placeholder="1234567A" value={hrForm.ppsn} onChange={(e) => setHrForm((f) => ({ ...f, ppsn: e.target.value }))} className="h-8 text-sm font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IBAN</Label>
                        <Input placeholder="IE29 AIBK …" value={hrForm.bankIban} onChange={(e) => setHrForm((f) => ({ ...f, bankIban: e.target.value }))} className="h-8 text-sm font-mono" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">BIC</Label>
                        <Input placeholder="AIBKIE2D" value={hrForm.bankBic} onChange={(e) => setHrForm((f) => ({ ...f, bankBic: e.target.value }))} className="h-8 text-sm font-mono" />
                      </div>
                    </div>
                  </div>
                  {/* Emergency */}
                  <div className="sm:col-span-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Emergency Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input placeholder="Full name" value={hrForm.emergencyName} onChange={(e) => setHrForm((f) => ({ ...f, emergencyName: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input placeholder="+353 …" value={hrForm.emergencyPhone} onChange={(e) => setHrForm((f) => ({ ...f, emergencyPhone: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Relationship</Label>
                        <Input placeholder="e.g. Spouse" value={hrForm.emergencyRel} onChange={(e) => setHrForm((f) => ({ ...f, emergencyRel: e.target.value }))} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Employment row */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Employment</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <InfoField label="Start Date" value={employee.startDate ? fmtDate(employee.startDate) : null} />
                      <InfoField label="Contract" value={employee.contractType ? CONTRACT_LABELS[employee.contractType] ?? employee.contractType : null} />
                      <InfoField label="Hourly Rate" value={employee.hourlyRate ? fmt(employee.hourlyRate) : null} />
                      <InfoField label="Phone" value={employee.phone} />
                    </div>
                  </div>
                  {/* Personal row */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Personal</p>
                    <div className="grid grid-cols-1 gap-3">
                      <InfoField label="Address" value={employee.address} />
                    </div>
                  </div>
                  {/* Payroll row */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Payroll</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <InfoField label="PPS Number" value={employee.ppsn} sensitive />
                      <InfoField label="IBAN" value={employee.bankIban} sensitive />
                      <InfoField label="BIC" value={employee.bankBic} />
                    </div>
                  </div>
                  {/* Emergency */}
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Emergency Contact</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <InfoField label="Name" value={employee.emergencyName} />
                      <InfoField label="Phone" value={employee.emergencyPhone} />
                      <InfoField label="Relationship" value={employee.emergencyRel} />
                    </div>
                  </div>
                  {(!employee.startDate && !employee.contractType && !employee.ppsn && !employee.bankIban && !employee.emergencyName && !employee.address) && (
                    <div className="text-center py-4">
                      <p className="text-sm text-slate-400">No HR details added yet.</p>
                      <Button variant="ghost" size="sm" className="mt-2 text-xs gap-1 text-blue-600" onClick={() => setEditingHR(true)}>
                        <Edit2 className="h-3 w-3" /> Add details
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Onboarding Tab ── */}
      {activeTab === "onboarding" && (
        <div className="space-y-4">
          {/* Progress */}
          {tasks.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Onboarding Progress</p>
                    <p className="text-xs text-slate-500">{completedTasks} of {tasks.length} tasks complete</p>
                  </div>
                  <span className={cn(
                    "text-2xl font-bold",
                    onboardingPct === 100 ? "text-green-600" : onboardingPct > 50 ? "text-amber-600" : "text-red-500"
                  )}>
                    {onboardingPct}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500",
                      onboardingPct === 100 ? "bg-green-500" : onboardingPct > 50 ? "bg-amber-500" : "bg-blue-500"
                    )}
                    style={{ width: `${onboardingPct}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Task list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" /> Onboarding Checklist
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border transition-all",
                        task.completed ? "bg-green-50 border-green-200" : "bg-white border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <button
                        onClick={() => toggleTask(task)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {task.completed ? (
                          <CheckSquare className="h-5 w-5 text-green-600" />
                        ) : (
                          <Square className="h-5 w-5 text-slate-400 hover:text-blue-500 transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", task.completed ? "line-through text-slate-400" : "text-slate-800")}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          {task.dueDate && (
                            <span className="text-xs text-slate-400">Due {fmtDate(task.dueDate)}</span>
                          )}
                          {task.completedAt && (
                            <span className="text-xs text-green-600">✓ {fmtDate(task.completedAt)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="flex-shrink-0 p-1 text-slate-300 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {/* Add task */}
                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Add a custom task…"
                      value={addTaskTitle}
                      onChange={(e) => setAddTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask()}
                      className="flex-1"
                    />
                    <Button onClick={addTask} disabled={addingTask || !addTaskTitle.trim()} size="sm" className="gap-1.5">
                      {addingTask ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Add
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Documents Tab ── */}
      {activeTab === "documents" && (
        <div className="space-y-4">
          {/* Upload form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" /> Upload Document
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap items-end">
                <div className="space-y-1.5 flex-1 min-w-[160px]">
                  <Label>Document title *</Label>
                  <Input
                    placeholder="e.g. Employment Contract 2024"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 w-40">
                  <Label>Category</Label>
                  <Select value={docCategory} onValueChange={setDocCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !docTitle.trim()}
                  className="gap-1.5"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading…" : "Choose file"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileUpload}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">Supported: PDF, Word, images. Max 10MB.</p>
            </CardContent>
          </Card>

          {/* Document list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-slate-500" />
                Documents
                {docs.length > 0 && (
                  <span className="text-xs font-normal text-slate-400">({docs.length})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {docsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No documents uploaded yet</p>
                  <p className="text-xs mt-1">Upload contracts, IDs, and other staff documents above</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map((doc) => {
                    const catLabel = DOC_CATEGORIES.find((c) => c.value === doc.category)?.label ?? doc.category;
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4.5 w-4.5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{doc.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{catLabel}</Badge>
                            <span className="text-xs text-slate-400">{doc.fileName}</span>
                            {doc.fileSize && <span className="text-xs text-slate-400">{fmtFileSize(doc.fileSize)}</span>}
                            <span className="text-xs text-slate-400">{fmtDate(doc.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View / Download"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            onClick={() => deleteDoc(doc.id)}
                            className="p-1.5 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
