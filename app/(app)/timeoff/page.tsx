"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
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
import { Clock, Plus, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Role } from "@prisma/client";

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
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isManager =
    session?.user?.role === Role.MANAGER ||
    session?.user?.role === Role.ADMIN;

  useEffect(() => {
    fetchRequests();
  }, []);

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
        {!isManager && (
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

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
                <Card key={req.id} className="border-orange-200 bg-orange-50">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      {isManager && (
                        <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
                          <AvatarImage src={req.user.image ?? ""} />
                          <AvatarFallback className="bg-orange-200 text-orange-800 text-xs">
                            {getInitials(req.user.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        {isManager && (
                          <p className="font-semibold text-slate-900">
                            {req.user.name ?? req.user.email}
                          </p>
                        )}
                        <p className="text-sm text-slate-700">
                          {formatDate(req.startDate)} — {formatDate(req.endDate)}
                        </p>
                        {req.reason && (
                          <p className="text-sm text-slate-500 mt-1">{req.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="warning">Pending</Badge>
                        {isManager && (
                          <>
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
                          </>
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
                <Card key={req.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center gap-4">
                      {isManager && (
                        <Avatar className="h-9 w-9 flex-shrink-0">
                          <AvatarImage src={req.user.image ?? ""} />
                          <AvatarFallback className="bg-slate-100 text-slate-600 text-xs">
                            {getInitials(req.user.name)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div className="flex-1 min-w-0">
                        {isManager && (
                          <p className="font-medium text-slate-900">
                            {req.user.name ?? req.user.email}
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
    </div>
  );
}
