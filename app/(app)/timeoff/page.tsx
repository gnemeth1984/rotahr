"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate, getInitials } from "@/lib/utils";
import { Clock, Plus, CheckCircle, XCircle, Loader2, Sparkles, AlertTriangle, UserCheck, CalendarDays, Info } from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

interface TimeOffRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export default function TimeOffPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("id");
  const requestRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const deepLinkedRef = useRef(false);

  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Annual leave entitlement (OWT Act 1997 s.19)
  interface Entitlement {
    leaveYear: string;
    hoursWorked: number;
    entitlementHours: number;
    entitlementDays: number;
    daysTaken: number;
    daysRemaining: number;
    method: string;
    note: string;
  }
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [entitlementLoading, setEntitlementLoading] = useState(false);

  // Suggest Cover
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestRequestId, setSuggestRequestId] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestResult, setSuggestResult] = useState<any>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const isManager =
    session?.user?.role === Role.MANAGER ||
    session?.user?.role === Role.ADMIN;

  useEffect(() => {
    fetchRequests();
    fetchEntitlement();
  }, []);

  // Deep-link: scroll to and highlight the specific request
  useEffect(() => {
    if (!deepLinkId || !requests.length || deepLinkedRef.current) return;
    const target = requests.find((r) => r.id === deepLinkId);
    if (target) {
      deepLinkedRef.current = true;
      setTimeout(() => {
        requestRefs.current[deepLinkId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 200);
    }
  }, [deepLinkId, requests]);

  const fetchEntitlement = async () => {
    setEntitlementLoading(true);
    try {
      const res = await fetch("/api/timeoff/entitlement");
      if (res.ok) {
        const data = await res.json();
        setEntitlement(data);
      }
    } catch {
      // non-critical, ignore
    } finally {
      setEntitlementLoading(false);
    }
  };

  const fetchRequests = async () => {
    setLoading(true);
    const res = await fetch("/api/timeoff");
    const data = await res.json();
    setRequests(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/timeoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setDialogOpen(false);
        setForm({ startDate: "", endDate: "", reason: "" });
        fetchRequests();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActionLoading(id + status);
    try {
      await fetch(`/api/timeoff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchRequests();
    } finally {
      setActionLoading(null);
    }
  };

  const openSuggestCover = async (id: string) => {
    setSuggestRequestId(id);
    setSuggestResult(null);
    setSuggestError(null);
    setSuggestOpen(true);
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/ai/suggest-replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeOffRequestId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get suggestions");
      setSuggestResult(data.result);
    } catch (e: any) {
      setSuggestError(e.message);
    } finally {
      setSuggestLoading(false);
    }
  };

  const statusVariant = (s: string) =>
    s === "APPROVED" ? "success" : s === "PENDING" ? "warning" : "destructive";

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const otherRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Time Off</h1>
          <p className="text-slate-500 mt-1">
            {isManager ? "Review and manage time off requests" : "Submit and track your time off"}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Annual leave entitlement (OWT Act 1997 s.19) */}
      {entitlementLoading ? null : entitlement && entitlement.entitlementDays > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <p className="text-sm font-semibold text-slate-800">Your Annual Leave Entitlement</p>
            <span className="text-xs text-slate-400 ml-auto">{entitlement.leaveYear}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-blue-50 rounded-lg px-3 py-2.5">
              <p className="text-2xl font-bold text-blue-700">{entitlement.entitlementDays.toFixed(1)}</p>
              <p className="text-xs text-slate-500 mt-0.5">Days entitled</p>
            </div>
            <div className="text-center bg-slate-50 rounded-lg px-3 py-2.5">
              <p className="text-2xl font-bold text-slate-700">{entitlement.daysTaken}</p>
              <p className="text-xs text-slate-500 mt-0.5">Days taken</p>
            </div>
            <div className={cn(
              "text-center rounded-lg px-3 py-2.5",
              entitlement.daysRemaining <= 0 ? "bg-red-50" : entitlement.daysRemaining < 5 ? "bg-amber-50" : "bg-emerald-50"
            )}>
              <p className={cn(
                "text-2xl font-bold",
                entitlement.daysRemaining <= 0 ? "text-red-600" : entitlement.daysRemaining < 5 ? "text-amber-600" : "text-emerald-600"
              )}>
                {entitlement.daysRemaining.toFixed(1)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Days remaining</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-3 flex items-start gap-1">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            Based on {entitlement.hoursWorked.toFixed(0)}h worked ({entitlement.method}). Public holidays are additional. Figures are indicative — consult your manager for final approval.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (
        <>
          {/* Pending requests (managers see these prominently) */}
          {pendingRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                {isManager ? `Pending Approval (${pendingRequests.length})` : "Pending"}
              </h2>
              {pendingRequests.map((req) => (
                <Card
                  key={req.id}
                  ref={(el) => { requestRefs.current[req.id] = el as any; }}
                  className={`border-orange-200 bg-orange-50 ${req.id === deepLinkId ? "ring-2 ring-blue-400 border-blue-400" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {isManager && (
                        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                          <AvatarImage src={req.user?.email ?? ""} />
                          <AvatarFallback className="bg-orange-200 text-orange-800 text-xs">
                            {getInitials(`${req.user?.name ?? ""}`)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {isManager && (
                            <p className="font-semibold text-slate-900">
                              {`${req.user?.name ?? ""}`.trim() || req.user?.email}
                            </p>
                          )}
                          <Badge variant="warning">Pending</Badge>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-nowrap">
                          {formatDate(req.startDate)} — {formatDate(req.endDate)}
                        </p>
                        {req.reason && (
                          <p className="text-sm text-slate-500 mt-1">{req.reason}</p>
                        )}
                        {isManager && (
                          <div className="flex items-center gap-2 flex-wrap mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-300 text-green-700 hover:bg-green-50 gap-1"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(req.id, "APPROVED")}
                            >
                              {actionLoading === req.id + "APPROVED" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-300 text-red-700 hover:bg-red-50 gap-1"
                              disabled={!!actionLoading}
                              onClick={() => handleAction(req.id, "REJECTED")}
                            >
                              {actionLoading === req.id + "REJECTED" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <XCircle className="h-3 w-3" />
                              )}
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-violet-300 text-violet-700 hover:bg-violet-50 gap-1"
                              onClick={() => openSuggestCover(req.id)}
                            >
                              <Sparkles className="h-3 w-3" />
                              Suggest Cover
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Past / resolved requests */}
          {otherRequests.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                History
              </h2>
              {otherRequests.map((req) => (
                <Card
                  key={req.id}
                  ref={(el) => { requestRefs.current[req.id] = el as any; }}
                  className={req.id === deepLinkId ? "ring-2 ring-blue-400 border-blue-400" : ""}
                >
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {isManager && (
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarImage src={req.user?.email ?? ""} />
                          <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                            {getInitials(`${req.user?.name ?? ""}`)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        {isManager && (
                          <p className="font-medium text-slate-900">
                            {`${req.user?.name ?? ""}`.trim() || req.user?.email}
                          </p>
                        )}
                        <p className="text-sm text-slate-600">
                          {formatDate(req.startDate)} — {formatDate(req.endDate)}
                        </p>
                        {req.reason && (
                          <p className="text-xs text-slate-400 mt-0.5">{req.reason}</p>
                        )}
                      </div>
                      <Badge variant={statusVariant(req.status) as any}>
                        {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {requests.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <Clock className="h-12 w-12 mx-auto mb-3 text-slate-200" />
                <p className="text-slate-500 font-medium">No requests yet</p>
                {!isManager && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setDialogOpen(true)}
                  >
                    Submit your first request
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* New Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Time Off</DialogTitle>
            <DialogDescription>
              Submit a request for your manager to review.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">From</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">To</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="E.g. Family holiday, medical appointment..."
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Suggest Cover Dialog */}
      <Dialog open={suggestOpen} onOpenChange={(o) => !o && setSuggestOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Suggest Cover
            </DialogTitle>
            <DialogDescription>
              AI-ranked replacement candidates from the same department
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {suggestLoading && (
              <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Finding candidates...
              </div>
            )}

            {suggestError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {suggestError}
              </div>
            )}

            {suggestResult && !suggestLoading && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Covering for <strong>{suggestResult.absentEmployee?.firstName} {suggestResult.absentEmployee?.lastName}</strong>
                  {suggestResult.department ? ` · ${suggestResult.department}` : ""}
                </p>

                {suggestResult.warnings?.map((w: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                    {w}
                  </div>
                ))}

                {suggestResult.candidates?.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No suitable candidates found.</p>
                ) : (
                  suggestResult.candidates?.map((c: any, i: number) => (
                    <div key={c.id} className={cn(
                      "rounded-lg border p-3 text-sm",
                      i === 0 ? "border-green-200 bg-green-50" : "border-slate-200 bg-white"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {i === 0 && <UserCheck className="h-4 w-4 text-green-600" />}
                          <span className="font-semibold text-slate-900">
                            {i + 1}. {c.firstName} {c.lastName}
                          </span>
                          <span className="text-xs text-slate-500">{c.role}</span>
                        </div>
                        <span className="text-xs font-medium text-slate-500">Score: {c.score}</span>
                      </div>
                      <p className="text-xs text-slate-500">{c.email}</p>
                      {c.reasons?.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {c.reasons.map((r: string, ri: number) => (
                            <span key={ri} className="text-[10px] bg-green-100 text-green-700 rounded px-1.5 py-0.5">{r}</span>
                          ))}
                        </div>
                      )}
                      {c.warnings?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.warnings.map((w: string, wi: number) => (
                            <span key={wi} className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

