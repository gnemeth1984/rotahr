"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ArrowRightLeft, CheckCircle2, XCircle, Clock,
  Loader2, AlertCircle, Plus, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShiftBrief {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  role: string | null;
}

interface SwapRequest {
  id: string;
  status: string;
  offerer: { id: string; firstName: string; lastName: string };
  receiver?: { id: string; firstName: string; lastName: string } | null;
  offeredShift: ShiftBrief | null;
  receiverShift?: ShiftBrief | null;
  managerNote?: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", {
    weekday: "short", day: "numeric", month: "short",
  });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IE", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  open:      { label: "Open",             cls: "bg-blue-100 text-blue-700" },
  pending:   { label: "Pending approval", cls: "bg-amber-100 text-amber-700" },
  approved:  { label: "Approved",         cls: "bg-emerald-100 text-emerald-700" },
  rejected:  { label: "Rejected",         cls: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled",        cls: "bg-slate-100 text-slate-500" },
};

// ── Request Swap Modal ────────────────────────────────────────────────────────

function RequestSwapModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [shifts, setShifts] = useState<ShiftBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    fetch(`/api/shifts/my?from=${today}`)
      .then((r) => r.json())
      .then((d) => {
        setShifts(d.shifts ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    const r = await fetch("/api/shifts/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offeredShiftId: selected }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error ?? "Could not create swap request");
      setSubmitting(false);
      return;
    }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Request a shift swap</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-slate-500 mb-4">
            Pick one of your upcoming shifts to put up for swapping.
            Another staff member can then accept it and the manager will approve.
          </p>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
            </div>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              You have no upcoming published shifts.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {shifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setSelected(shift.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors",
                    selected === shift.id
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-slate-200 hover:border-slate-300 text-slate-700"
                  )}
                >
                  <span className="font-medium">{fmtDate(shift.date)}</span>
                  <span className="mx-2 text-slate-400">·</span>
                  {fmtTime(shift.startTime)}–{fmtTime(shift.endTime)}
                  {shift.role && (
                    <span className="ml-2 text-slate-400">· {shift.role}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={!selected || submitting || loading}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 mr-1" />
            )}
            Submit request
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ShiftSwapsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isManager = role === Role.MANAGER || role === Role.ADMIN;

  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [managerNote, setManagerNote] = useState("");
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/shifts/swap");
    const d = r.ok ? await r.json() : {};
    setSwaps(d.swaps ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function acceptSwap(swapId: string) {
    setActioning(swapId);
    setError("");
    const r = await fetch("/api/shifts/swap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swapId, action: "accept" }),
    });
    const d = await r.json();
    if (!r.ok) setError(d.error ?? "Could not accept swap");
    setActioning(null);
    load();
  }

  async function cancelSwap(swapId: string) {
    setActioning(swapId);
    const r = await fetch("/api/shifts/swap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swapId, action: "cancel" }),
    });
    if (!r.ok) {
      const d = await r.json();
      setError(d.error ?? "Could not withdraw");
    }
    setActioning(null);
    load();
  }

  async function managerDecide(swapId: string, decision: "approved" | "rejected") {
    setActioning(swapId);
    setError("");
    const r = await fetch("/api/shifts/swap/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ swapId, decision, managerNote }),
    });
    const d = await r.json();
    if (!r.ok) setError(d.error ?? "Error");
    setManagerNote("");
    setActioning(null);
    load();
  }

  const openSwaps    = swaps.filter((s) => s.status === "open");
  const pendingSwaps = swaps.filter((s) => s.status === "pending");
  const pastSwaps    = swaps.filter((s) => ["approved", "rejected", "cancelled"].includes(s.status));

  return (
    <>
      {showModal && (
        <RequestSwapModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); load(); }}
        />
      )}

      <div className="max-w-3xl mx-auto space-y-6">
        {/* ── Page header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-blue-500" />
              Shift Swaps
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Offer your shift for swapping — a colleague accepts, manager approves.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowModal(true)} className="flex-shrink-0">
            <Plus className="h-4 w-4 mr-1.5" />
            Request swap
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
          </div>
        ) : (
          <>
            {/* ── Pending manager approval ── */}
            {isManager && pendingSwaps.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Awaiting your approval ({pendingSwaps.length})
                </h2>
                <div className="space-y-3">
                  {pendingSwaps.map((swap) => (
                    <SwapCard
                      key={swap.id} swap={swap} isManager={isManager}
                      onApprove={() => managerDecide(swap.id, "approved")}
                      onReject={() => managerDecide(swap.id, "rejected")}
                      actioning={actioning === swap.id}
                      managerNote={managerNote}
                      onNoteChange={setManagerNote}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Open swaps ── */}
            {openSwaps.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Open swap offers</h2>
                <div className="space-y-3">
                  {openSwaps.map((swap) => (
                    <SwapCard
                      key={swap.id} swap={swap} isManager={isManager}
                      onAccept={() => acceptSwap(swap.id)}
                      onCancel={() => cancelSwap(swap.id)}
                      actioning={actioning === swap.id}
                      currentUserId={session?.user?.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Empty state ── */}
            {openSwaps.length === 0 && pendingSwaps.length === 0 && pastSwaps.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
                <ArrowRightLeft className="h-10 w-10 mx-auto mb-3 text-slate-200" />
                <p className="font-medium text-slate-600">No swap requests yet</p>
                {!isManager && (
                  <p className="text-sm text-slate-400 mt-1">
                    Hit <span className="font-medium text-slate-500">Request swap</span> above to offer one of your shifts.
                  </p>
                )}
                {isManager && (
                  <p className="text-sm text-slate-400 mt-1">
                    Staff can request swaps from this page.
                  </p>
                )}
              </div>
            )}

            {/* ── History ── */}
            {pastSwaps.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-slate-500 mb-3">History</h2>
                <div className="space-y-2">
                  {pastSwaps.map((swap) => (
                    <SwapCard key={swap.id} swap={swap} isManager={isManager} actioning={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Swap Card ─────────────────────────────────────────────────────────────────

function SwapCard({
  swap,
  isManager,
  onAccept,
  onApprove,
  onReject,
  onCancel,
  actioning,
  currentUserId,
  managerNote,
  onNoteChange,
}: {
  swap: SwapRequest;
  isManager: boolean;
  onAccept?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  actioning: boolean;
  currentUserId?: string;
  managerNote?: string;
  onNoteChange?: (v: string) => void;
}) {
  const statusBadge = STATUS_BADGE[swap.status] ?? { label: swap.status, cls: "bg-slate-100 text-slate-600" };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {swap.offerer.firstName} {swap.offerer.lastName} offering their shift
          </p>
          {swap.offeredShift && (
            <p className="text-xs text-slate-500 mt-0.5">
              {fmtDate(swap.offeredShift.date)}
              {" · "}
              {fmtTime(swap.offeredShift.startTime)}–{fmtTime(swap.offeredShift.endTime)}
              {swap.offeredShift.role && (
                <span className="ml-1 text-slate-400">· {swap.offeredShift.role}</span>
              )}
            </p>
          )}
        </div>
        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0", statusBadge.cls)}>
          {statusBadge.label}
        </span>
      </div>

      {/* Accepted-by info */}
      {swap.receiver && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
          <span className="font-medium">Accepted by:</span>{" "}
          {swap.receiver.firstName} {swap.receiver.lastName}
          {swap.receiverShift && (
            <span className="ml-1">
              · their shift: {fmtDate(swap.receiverShift.date)}{" "}
              {fmtTime(swap.receiverShift.startTime)}–{fmtTime(swap.receiverShift.endTime)}
            </span>
          )}
        </p>
      )}

      {/* Manager note */}
      {swap.managerNote && (
        <p className="text-xs text-slate-500 italic">Manager note: {swap.managerNote}</p>
      )}

      {/* Actions — open swap */}
      {swap.status === "open" && (
        <div className="flex gap-2 pt-1">
          {onAccept && (
            <Button size="sm" className="h-7 text-xs" onClick={onAccept} disabled={actioning}>
              {actioning ? <Loader2 className="h-3 w-3 animate-spin" /> : "Accept swap"}
            </Button>
          )}
          {onCancel && (
            <Button
              size="sm" variant="ghost"
              className="h-7 text-xs text-slate-500"
              onClick={onCancel} disabled={actioning}
            >
              Withdraw
            </Button>
          )}
        </div>
      )}

      {/* Actions — pending manager */}
      {swap.status === "pending" && isManager && (
        <div className="space-y-2 pt-1">
          <input
            type="text"
            placeholder="Optional note to staff..."
            value={managerNote ?? ""}
            onChange={(e) => onNoteChange?.(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
              onClick={onApprove} disabled={actioning}
            >
              {actioning
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><CheckCircle2 className="h-3 w-3 mr-1" />Approve</>}
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
              onClick={onReject} disabled={actioning}
            >
              <XCircle className="h-3 w-3 mr-1" />Reject
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
