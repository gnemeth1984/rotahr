// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, User, Phone, Mail, Calendar, Clock, DollarSign, Award,
  Loader2, ChevronRight, CheckCircle2, XCircle, Badge as BadgeIcon,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  expiresAt?: string | null;
  status: string;
}

const CERT_LABELS: Record<string, string> = {
  HACCP: "HACCP / Food Safety",
  ALCOHOL: "Alcohol / RSA",
  MANUAL_HANDLING: "Manual Handling",
  FIRST_AID: "First Aid",
  FOOD_SAFETY: "Food Safety Mgmt",
  OTHER: "Other",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const router = useRouter();

  const isManager = session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeoff, setTimeoff] = useState<TimeOff[]>([]);
  const [certs, setCerts] = useState<Cert[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<number>(0);
  const [loading, setLoading] = useState(true);

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
          setEmployee(d.employee);
        }

        if (shiftsRes.status === "fulfilled" && shiftsRes.value.ok) {
          const d = await shiftsRes.value.json();
          const allShifts = d.shifts ?? [];
          setShifts(allShifts.slice(0, 8));
          // Weekly hours for current week
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
                <Badge variant={employee.active ? "default" : "secondary"} className={employee.active ? "bg-green-100 text-green-700 border-green-200" : ""}>
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
                {employee.venue && (
                  <span className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Building2 className="h-3.5 w-3.5" /> {employee.venue.name}
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
            <Link href="/employees">
              <Button variant="outline" size="sm">Edit</Button>
            </Link>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{weeklyHours}h</p>
              <p className="text-xs text-slate-500 mt-0.5">This week</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">
                {employee.hourlyRate ? `€${employee.hourlyRate.toFixed(2)}` : "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Hourly rate</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{certs.length}</p>
              <p className="text-xs text-slate-500 mt-0.5">Certifications</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                      <p className="text-sm font-medium text-slate-900">
                        {fmt(s.startTime)}
                      </p>
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
                        {fmt(t.startDate)} – {fmt(t.endDate)}
                      </p>
                      {t.reason && <p className="text-xs text-slate-500">{t.reason}</p>}
                    </div>
                    <Badge
                      className={cn("text-xs border",
                        t.status === "APPROVED" ? "bg-green-100 text-green-700 border-green-200" :
                        t.status === "REJECTED" ? "bg-red-100 text-red-700 border-red-200" :
                        "bg-amber-100 text-amber-700 border-amber-200"
                      )}
                    >
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
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{CERT_LABELS[c.category] ?? c.category}</p>
                      {c.issuer && <p className="text-xs text-slate-500">{c.issuer}</p>}
                      {c.expiresAt && (
                        <p className="text-xs text-slate-400">Expires {fmt(c.expiresAt)}</p>
                      )}
                    </div>
                    <Badge
                      className={cn("ml-auto text-xs border flex-shrink-0",
                        c.status === "VALID" ? "bg-green-100 text-green-700 border-green-200" :
                        c.status === "EXPIRING_SOON" ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-red-100 text-red-700 border-red-200"
                      )}
                    >
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
