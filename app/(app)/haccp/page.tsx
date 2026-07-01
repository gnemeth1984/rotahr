"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Thermometer,
  Truck,
  ClipboardCheck,
  Bug,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  History,
  Loader2,
  ChevronRight,
  Trash2,
  ShieldCheck,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";

// ─── Types ─────────────────────────────────────────────────────────────────

interface HACCPRecord {
  id: string;
  checkType: string;
  checkedAt: string;
  status: string;
  data: Record<string, unknown>;
  notes: string | null;
  checkedBy: { name: string | null; email: string };
}

// ─── Check type config ──────────────────────────────────────────────────────

const CHECK_GROUPS = [
  {
    label: "Temperature Control",
    icon: Thermometer,
    color: "text-orange-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    checks: [
      {
        type: "fridge_temp",
        label: "Fridge / Cold Room",
        description: "Log temperatures for fridges and cold rooms",
        minTemp: 1,
        maxTemp: 4,
        unit: "°C",
        frequency: "2× daily",
      },
      {
        type: "freezer_temp",
        label: "Freezer",
        description: "Log freezer temperatures",
        minTemp: -25,
        maxTemp: -18,
        unit: "°C",
        frequency: "Daily",
      },
      {
        type: "hot_holding",
        label: "Hot Holding",
        description: "Food kept hot must be above 63°C",
        minTemp: 63,
        maxTemp: 100,
        unit: "°C",
        frequency: "Every 2hrs",
      },
      {
        type: "cooking_temp",
        label: "Cooking Temperature",
        description: "Core temp must reach ≥75°C",
        minTemp: 75,
        maxTemp: 100,
        unit: "°C",
        frequency: "Per cook",
      },
      {
        type: "cooling",
        label: "Cooling Record",
        description: "Food must cool from 60°C to below 4°C within 4 hours",
        minTemp: 0,
        maxTemp: 4,
        unit: "°C",
        frequency: "Per batch",
      },
    ],
  },
  {
    label: "Deliveries",
    icon: Truck,
    color: "text-blue-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    checks: [
      {
        type: "delivery",
        label: "Delivery Check",
        description: "Log incoming deliveries: temperature, condition, accept/reject",
        frequency: "Per delivery",
      },
    ],
  },
  {
    label: "Cleaning Records",
    icon: ClipboardCheck,
    color: "text-green-500",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    checks: [
      {
        type: "cleaning_daily",
        label: "Daily Cleaning",
        description: "Kitchen surfaces, equipment, floors, sinks",
        frequency: "Daily",
      },
      {
        type: "cleaning_weekly",
        label: "Weekly Cleaning",
        description: "Behind equipment, storage areas, vents, drains",
        frequency: "Weekly",
      },
      {
        type: "cleaning_deep",
        label: "Deep Clean",
        description: "Full kitchen deep clean record",
        frequency: "Monthly",
      },
      {
        type: "opening_checks",
        label: "Opening Checks",
        description: "Daily opening safety and hygiene checklist",
        frequency: "Daily AM",
      },
      {
        type: "closing_checks",
        label: "Closing Checks",
        description: "Daily closing safety and hygiene checklist",
        frequency: "Daily PM",
      },
    ],
  },
  {
    label: "Incidents & Control",
    icon: Bug,
    color: "text-red-500",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    checks: [
      {
        type: "pest_control",
        label: "Pest Control Log",
        description: "Log any pest sightings or control actions",
        frequency: "As needed",
      },
      {
        type: "corrective_action",
        label: "Corrective Action",
        description: "Log when a check fails and what action was taken",
        frequency: "As needed",
      },
    ],
  },
];

const ALL_CHECKS = CHECK_GROUPS.flatMap((g) => g.checks.map((c) => ({ ...c, group: g.label })));

// ─── Helpers ───────────────────────────────────────────────────────────────

function getCheckConfig(type: string) {
  return ALL_CHECKS.find((c) => c.type === type);
}

function getGroupConfig(type: string) {
  return CHECK_GROUPS.find((g) => g.checks.some((c) => c.type === type));
}

function formatDate(d: string) {
  return new Date(d).toLocaleString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pass")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Pass
      </Badge>
    );
  if (status === "fail")
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 gap-1">
        <XCircle className="h-3 w-3" /> Fail
      </Badge>
    );
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
      <AlertTriangle className="h-3 w-3" /> Action Taken
    </Badge>
  );
}

// ─── Check Forms ───────────────────────────────────────────────────────────

function TempForm({
  config,
  onSubmit,
  loading,
}: {
  config: (typeof ALL_CHECKS)[0];
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const [location, setLocation] = useState("");
  const [temp, setTemp] = useState("");
  const [notes, setNotes] = useState("");

  const tempNum = parseFloat(temp);
  const inRange =
    temp !== "" &&
    !isNaN(tempNum) &&
    "minTemp" in config &&
    "maxTemp" in config &&
    tempNum >= (config.minTemp as number) &&
    tempNum <= (config.maxTemp as number);
  const outOfRange = temp !== "" && !isNaN(tempNum) && !inRange;

  const handleSubmit = () => {
    const status = outOfRange ? "fail" : "pass";
    onSubmit({ location, temperature: tempNum }, status, notes);
  };

  return (
    <div className="space-y-4">
      {"minTemp" in config && (
        <div className="rounded-lg bg-slate-50 border p-3 text-sm text-slate-600">
          Safe range:{" "}
          <strong>
            {config.minTemp as number}°C – {config.maxTemp as number}°C
          </strong>
        </div>
      )}
      <div className="space-y-2">
        <Label>Location / Equipment</Label>
        <Input
          placeholder={
            config.type === "fridge_temp"
              ? "e.g. Main fridge, Walk-in, Bar fridge"
              : config.type === "freezer_temp"
              ? "e.g. Chest freezer, Walk-in freezer"
              : config.type === "cooking_temp"
              ? "e.g. Chicken breast, Beef burger"
              : "e.g. Soup, Stew, Sauce"
          }
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Temperature (°C)</Label>
        <Input
          type="number"
          step="0.1"
          placeholder="e.g. 3.5"
          value={temp}
          onChange={(e) => setTemp(e.target.value)}
          className={cn(
            outOfRange && "border-red-400 bg-red-50",
            inRange && "border-green-400 bg-green-50"
          )}
        />
        {outOfRange && (
          <p className="text-red-600 text-sm flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Out of safe range — corrective action required
          </p>
        )}
        {inRange && (
          <p className="text-green-600 text-sm flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Within safe range
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>Notes {outOfRange && <span className="text-red-500">(required — corrective action)</span>}</Label>
        <Textarea
          placeholder={outOfRange ? "What action was taken?" : "Optional notes..."}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={handleSubmit}
        disabled={loading || !location || temp === "" || (outOfRange && !notes)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Record
      </Button>
    </div>
  );
}

function DeliveryForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const [supplier, setSupplier] = useState("");
  const [product, setProduct] = useState("");
  const [deliveryTemp, setDeliveryTemp] = useState("");
  const [packaging, setPackaging] = useState("good");
  const [accepted, setAccepted] = useState("yes");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    const status = accepted === "no" || packaging === "rejected" ? "fail" : "pass";
    onSubmit(
      {
        supplier,
        product,
        deliveryTemp: deliveryTemp ? parseFloat(deliveryTemp) : null,
        packagingCondition: packaging,
        accepted: accepted === "yes",
      },
      status,
      notes
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Supplier</Label>
          <Input placeholder="e.g. Dawn Meats" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Product / Item</Label>
          <Input placeholder="e.g. Chicken, Dairy" value={product} onChange={(e) => setProduct(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Delivery Temperature (°C)</Label>
        <Input
          type="number"
          step="0.1"
          placeholder="e.g. 3.2"
          value={deliveryTemp}
          onChange={(e) => setDeliveryTemp(e.target.value)}
        />
        <p className="text-xs text-slate-500">Chilled goods must arrive below 5°C</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Packaging Condition</Label>
          <Select value={packaging} onValueChange={setPackaging}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="good">Good condition</SelectItem>
              <SelectItem value="damaged">Damaged</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Delivery Accepted?</Label>
          <Select value={accepted} onValueChange={setAccepted}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Yes — accepted</SelectItem>
              <SelectItem value="no">No — rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Any issues or comments..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={handleSubmit}
        disabled={loading || !supplier || !product}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Record
      </Button>
    </div>
  );
}

const DAILY_CLEANING_ITEMS = [
  "Kitchen prep surfaces wiped and sanitised",
  "Cooking equipment cleaned (fryers, grills, ovens)",
  "Fridge/freezer door seals wiped",
  "Sinks and taps sanitised",
  "Floor swept and mopped",
  "Bins emptied and cleaned",
  "Hand washing stations stocked (soap, paper towels)",
  "Dishwasher/glasswasher cleaned and checked",
];

const WEEKLY_CLEANING_ITEMS = [
  "Behind/under cooking equipment cleaned",
  "Extraction hood and filters degreased",
  "Cold room/walk-in walls and floors scrubbed",
  "Dry store shelves wiped and organised",
  "Waste area cleaned and disinfected",
  "Drains cleaned and deodorised",
  "Bar fridges deep cleaned",
];

const DEEP_CLEAN_ITEMS = [
  "Full extraction system cleaned",
  "All equipment moved and cleaned behind/under",
  "Grease traps cleaned",
  "All walls and ceilings wiped down",
  "All drains jetted and cleaned",
  "Cold rooms fully defrosted and scrubbed",
  "Chemical store checked and organised",
  "Pest bait stations checked",
];

const OPENING_ITEMS = [
  "All fridges and freezers at correct temperature",
  "Hot holding equipment working",
  "Hand washing sinks stocked and working",
  "Cleaning chemicals stored correctly",
  "Probe thermometers calibrated and available",
  "Food stored correctly (covered, labelled, dated)",
  "Pest bait stations checked — no activity",
  "All surfaces clean and sanitised",
];

const CLOSING_ITEMS = [
  "All food covered, labelled, and dated in fridge",
  "Cooking equipment switched off and cleaned",
  "Surfaces cleaned and sanitised",
  "Floors swept and mopped",
  "Bins emptied",
  "Dishwasher/glasswasher cleaned",
  "Extraction switched off",
  "Back door secured",
];

function ChecklistForm({
  items,
  onSubmit,
  loading,
}: {
  items: string[];
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [cleaner, setCleaner] = useState("");

  const allChecked = items.every((i) => checked[i]);
  const someUnchecked = items.some((i) => !checked[i]);

  const toggle = (item: string) => setChecked((prev) => ({ ...prev, [item]: !prev[item] }));

  const handleSubmit = () => {
    const missed = items.filter((i) => !checked[i]);
    const status = missed.length === 0 ? "pass" : missed.length <= 2 ? "corrective" : "fail";
    onSubmit({ items: checked, completedBy: cleaner }, status, notes);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Completed by</Label>
        <Input placeholder="Staff name" value={cleaner} onChange={(e) => setCleaner(e.target.value)} />
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {items.map((item) => (
          <label
            key={item}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              checked[item] ? "bg-green-50 border-green-200" : "bg-white border-slate-200 hover:bg-slate-50"
            )}
          >
            <input
              type="checkbox"
              checked={!!checked[item]}
              onChange={() => toggle(item)}
              className="mt-0.5 accent-green-600 h-4 w-4 flex-shrink-0"
            />
            <span className={cn("text-sm", checked[item] ? "text-green-800 line-through" : "text-slate-700")}>
              {item}
            </span>
          </label>
        ))}
      </div>
      {someUnchecked && (
        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
          {items.filter((i) => !checked[i]).length} item(s) not completed — please note reason below
        </div>
      )}
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Any issues or comments..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={handleSubmit}
        disabled={loading || !cleaner}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Record {allChecked ? "✓" : `(${items.filter((i) => checked[i]).length}/${items.length})`}
      </Button>
    </div>
  );
}

function PestForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const [type, setType] = useState("");
  const [location, setLocation] = useState("");
  const [action, setAction] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type of pest</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="rodent">Rodent</SelectItem>
              <SelectItem value="insect">Insect / Flies</SelectItem>
              <SelectItem value="bird">Bird</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="no_activity">No activity (routine check)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Location</Label>
          <Input placeholder="e.g. Dry store, back door" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Action taken</Label>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger><SelectValue placeholder="Select action..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None required</SelectItem>
            <SelectItem value="trap_set">Trap set</SelectItem>
            <SelectItem value="pest_control_notified">Pest control company notified</SelectItem>
            <SelectItem value="area_sealed">Entry point sealed</SelectItem>
            <SelectItem value="hsda_notified">HACCP manager notified</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Additional details..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={() =>
          onSubmit({ pestType: type, location, action }, type === "no_activity" ? "pass" : "corrective", notes)
        }
        disabled={loading || !type || !location || !action}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Record
      </Button>
    </div>
  );
}

function CorrectiveForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const [issue, setIssue] = useState("");
  const [checkType, setCheckType] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [resolvedBy, setResolvedBy] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Related check type</Label>
        <Select value={checkType} onValueChange={setCheckType}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {ALL_CHECKS.map((c) => (
              <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Issue identified</Label>
        <Textarea
          placeholder="Describe the problem — e.g. fridge temp was 8°C, food left out too long"
          value={issue}
          onChange={(e) => setIssue(e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Corrective action taken</Label>
        <Textarea
          placeholder="What was done to fix it — e.g. food discarded, fridge engineer called"
          value={actionTaken}
          onChange={(e) => setActionTaken(e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label>Resolved by</Label>
        <Input placeholder="Staff name" value={resolvedBy} onChange={(e) => setResolvedBy(e.target.value)} />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={() => onSubmit({ relatedCheck: checkType, issue, actionTaken, resolvedBy }, "corrective", "")}
        disabled={loading || !issue || !actionTaken || !resolvedBy}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Corrective Action
      </Button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function HACCPPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<HACCPRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<HACCPRecord[]>([]);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"dashboard" | "history">("dashboard");
  const [historyFilter, setHistoryFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const role = (session?.user as { role?: string })?.role;
  const isManager = role === Role.MANAGER || role === Role.ADMIN;

  const today = new Date().toISOString().split("T")[0];

  const fetchRecords = useCallback(async () => {
    const [todayRes, allRes] = await Promise.all([
      fetch(`/api/haccp?date=${today}&limit=200`),
      fetch(`/api/haccp?limit=200`),
    ]);
    const todayData = await todayRes.json();
    const allData = await allRes.json();
    setTodayRecords(todayData.records || []);
    setRecords(allData.records || []);
  }, [today]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSave = async (
    checkType: string,
    data: Record<string, unknown>,
    status: string,
    notes: string
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/haccp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkType, data, status, notes }),
      });
      if (res.ok) {
        setActiveModal(null);
        await fetchRecords();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/haccp?id=${id}`, { method: "DELETE" });
      await fetchRecords();
    } finally {
      setDeletingId(null);
    }
  };

  // Compliance score — how many required daily checks have been done today
  const requiredDaily = ["fridge_temp", "freezer_temp", "opening_checks", "closing_checks", "cleaning_daily"];
  const doneToday = requiredDaily.filter((t) => todayRecords.some((r) => r.checkType === t));
  const complianceScore = Math.round((doneToday.length / requiredDaily.length) * 100);

  const filteredHistory =
    historyFilter === "all" ? records : records.filter((r) => r.checkType === historyFilter);

  const activeConfig = activeModal ? getCheckConfig(activeModal) : null;


  const handleDownloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dateStr = new Date().toLocaleDateString("en-IE", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });

    const rows = filteredHistory.map((r) => {
      const cfg = getCheckConfig(r.checkType);
      const d = r.data as Record<string, unknown>;
      const parts: string[] = [];
      if (d.location) parts.push(String(d.location));
      if (d.temperature !== undefined) parts.push(String(d.temperature) + "\u00b0C");
      if (d.supplier) parts.push(String(d.supplier));
      if (d.product) parts.push(String(d.product));
      if (d.deliveryTemp !== undefined && d.deliveryTemp !== null) parts.push(String(d.deliveryTemp) + "\u00b0C");
      if (d.packagingCondition) parts.push(String(d.packagingCondition));
      if (d.accepted !== undefined) parts.push(d.accepted ? "Accepted" : "Rejected");
      if (d.pestType) parts.push(String(d.pestType));
      if (d.issue) parts.push(String(d.issue).slice(0, 80));
      const summary = parts.join(" · ") || "\u2014";
      const statusLabel = r.status === "pass" ? "Pass" : r.status === "fail" ? "Fail" : "Action";
      const statusColor = r.status === "pass" ? "#16a34a" : r.status === "fail" ? "#dc2626" : "#d97706";
      const dateFormatted = new Date(r.checkedAt).toLocaleString("en-IE", {
        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      });
      return (
        "<tr>" +
        "<td>" + (cfg?.label || r.checkType) + "</td>" +
        "<td>" + summary + "</td>" +
        "<td style=\"color:" + statusColor + ";font-weight:600\">" + statusLabel + "</td>" +
        "<td>" + (r.checkedBy.name || r.checkedBy.email) + "</td>" +
        "<td>" + dateFormatted + "</td>" +
        "<td>" + (r.notes || "\u2014") + "</td>" +
        "</tr>"
      );
    }).join("");

    const scoreColor = complianceScore === 100 ? "#16a34a" : complianceScore >= 60 ? "#d97706" : "#dc2626";

    const html =
      "<!DOCTYPE html><html><head><meta charset=\"UTF-8\" />" +
      "<title>HACCP Records</title>" +
      "<style>" +
      "@page{margin:15mm 12mm;}" +
      "body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#1e293b;margin:0;}" +
      "h1{font-size:18px;margin:0 0 4px 0;}" +
      ".sub{font-size:11px;color:#64748b;margin-bottom:14px;}" +
      ".score{font-size:13px;font-weight:bold;margin-bottom:14px;display:block;}" +
      "table{width:100%;border-collapse:collapse;}" +
      "thead th{background:#0f172a;color:white;padding:7px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;}" +
      "tbody td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top;}" +
      "tbody tr:nth-child(even){background:#f8fafc;}" +
      ".footer{margin-top:14px;font-size:9px;color:#94a3b8;text-align:center;}" +
      "</style></head><body>" +
      "<h1>HACCP Food Safety Records</h1>" +
      "<div class=\"sub\">Printed: " + dateStr + " \u00b7 Rotahr Workforce Management</div>" +
      "<div class=\"score\">Today\u2019s compliance: <span style=\"color:" + scoreColor + "\">" + complianceScore + "%</span> (" + doneToday.length + "/" + requiredDaily.length + " required daily checks)</div>" +
      "<table><thead><tr>" +
      "<th>Check Type</th><th>Details</th><th>Status</th><th>Logged By</th><th>Date / Time</th><th>Notes</th>" +
      "</tr></thead><tbody>" +
      (rows || "<tr><td colspan=\"6\" style=\"text-align:center;color:#94a3b8;padding:20px\">No records found</td></tr>") +
      "</tbody></table>" +
      "<div class=\"footer\">Generated by Rotahr \u00b7 rotahr.com</div>" +
      "<script>setTimeout(function(){window.print();},400);<\/script>" +
      "</body></html>";

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const renderForm = () => {
    if (!activeModal) return null;
    const tempTypes = ["fridge_temp", "freezer_temp", "hot_holding", "cooking_temp", "cooling"];
    if (tempTypes.includes(activeModal) && activeConfig) {
      return (
        <TempForm
          config={activeConfig}
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "delivery") {
      return (
        <DeliveryForm
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "cleaning_daily") {
      return (
        <ChecklistForm
          items={DAILY_CLEANING_ITEMS}
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "cleaning_weekly") {
      return (
        <ChecklistForm
          items={WEEKLY_CLEANING_ITEMS}
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "cleaning_deep") {
      return (
        <ChecklistForm
          items={DEEP_CLEAN_ITEMS}
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "opening_checks") {
      return (
        <ChecklistForm
          items={OPENING_ITEMS}
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "closing_checks") {
      return (
        <ChecklistForm
          items={CLOSING_ITEMS}
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "pest_control") {
      return (
        <PestForm
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    if (activeModal === "corrective_action") {
      return (
        <CorrectiveForm
          onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
          loading={saving}
        />
      );
    }
    return null;
  };

  function renderDataSummary(record: HACCPRecord) {
    const d = record.data as Record<string, unknown>;
    const parts: string[] = [];
    if (d.location) parts.push(String(d.location));
    if (d.temperature !== undefined) parts.push(`${d.temperature}°C`);
    if (d.supplier) parts.push(String(d.supplier));
    if (d.product) parts.push(String(d.product));
    if (d.deliveryTemp !== undefined && d.deliveryTemp !== null) parts.push(`${d.deliveryTemp}°C`);
    if (d.packagingCondition) parts.push(String(d.packagingCondition));
    if (d.accepted !== undefined) parts.push(d.accepted ? "Accepted ✓" : "Rejected ✗");
    if (d.completedBy) parts.push(`by ${d.completedBy}`);
    if (d.pestType) parts.push(String(d.pestType));
    if (d.issue) parts.push(String(d.issue).slice(0, 60) + (String(d.issue).length > 60 ? "…" : ""));
    return parts.join(" · ") || "—";
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">HACCP Records</h1>
            <p className="text-slate-500 text-sm">Paperless food safety compliance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "dashboard" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("dashboard")}
          >
            <ClipboardCheck className="h-4 w-4 mr-1" /> Dashboard
          </Button>
          <Button
            variant={view === "history" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("history")}
          >
            <History className="h-4 w-4 mr-1" /> History
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
          >
            <Download className="h-4 w-4 mr-1" /> Download PDF
          </Button>
        </div>
      </div>

      {/* Today's Compliance Banner */}
      <div
        className={cn(
          "rounded-xl border p-5 flex items-center justify-between gap-4",
          complianceScore === 100
            ? "bg-green-50 border-green-200"
            : complianceScore >= 60
            ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-200"
        )}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4",
              complianceScore === 100
                ? "border-green-500 text-green-700 bg-white"
                : complianceScore >= 60
                ? "border-amber-500 text-amber-700 bg-white"
                : "border-red-500 text-red-700 bg-white"
            )}
          >
            {complianceScore}%
          </div>
          <div>
            <p className="font-semibold text-slate-900">Today's compliance score</p>
            <p className="text-sm text-slate-500">
              {doneToday.length} of {requiredDaily.length} required daily checks completed
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {requiredDaily.map((t) => {
                const done = todayRecords.some((r) => r.checkType === t);
                const cfg = getCheckConfig(t);
                return (
                  <span
                    key={t}
                    className={cn(
                      "text-xs px-2 py-1 rounded-full border font-medium",
                      done
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-white text-slate-400 border-slate-200"
                    )}
                  >
                    {done ? "✓ " : ""}{cfg?.label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-slate-500">{new Date().toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long" })}</p>
          <p className="text-xs text-slate-400 mt-1">All records are timestamped and signed</p>
        </div>
      </div>

      {/* Dashboard View */}
      {view === "dashboard" && (
        <div className="space-y-6">
          {CHECK_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={cn("h-5 w-5", group.color)} />
                  <h2 className="font-semibold text-slate-800">{group.label}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.checks.map((check) => {
                    const todayCount = todayRecords.filter((r) => r.checkType === check.type).length;
                    const lastRecord = records.find((r) => r.checkType === check.type);
                    const hasFail = todayRecords.some(
                      (r) => r.checkType === check.type && r.status === "fail"
                    );

                    return (
                      <button
                        key={check.type}
                        onClick={() => setActiveModal(check.type)}
                        className={cn(
                          "w-full text-left rounded-xl border p-4 hover:shadow-md transition-all group",
                          hasFail ? "border-red-300 bg-red-50" : "bg-white border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900 text-sm">{check.label}</span>
                              {hasFail && <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Fail</Badge>}
                            </div>
                            <p className="text-xs text-slate-400 mb-2">{check.description}</p>
                            <div className="flex items-center gap-3">
                              <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", group.bgColor, group.borderColor, group.color)}>
                                {check.frequency}
                              </span>
                              {todayCount > 0 && (
                                <span className="text-xs text-green-600 font-medium">
                                  ✓ {todayCount} logged today
                                </span>
                              )}
                            </div>
                            {lastRecord && (
                              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Last: {formatDate(lastRecord.checkedAt)}
                              </p>
                            )}
                          </div>
                          <div className={cn("p-2 rounded-lg ml-3 transition-colors", group.bgColor, "group-hover:opacity-80")}>
                            <Plus className={cn("h-4 w-4", group.color)} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History View */}
      {view === "history" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={historyFilter} onValueChange={setHistoryFilter}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All check types</SelectItem>
                {ALL_CHECKS.map((c) => (
                  <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-slate-500">{filteredHistory.length} records</span>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No records yet. Start logging checks from the dashboard.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Check</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 hidden md:table-cell">Details</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 hidden lg:table-cell">By</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Date</th>
                    {isManager && <th className="py-3 px-4"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record, i) => {
                    const cfg = getCheckConfig(record.checkType);
                    const grp = getGroupConfig(record.checkType);
                    const Icon = grp?.icon || ClipboardCheck;
                    return (
                      <tr key={record.id} className={cn("border-b border-slate-100 hover:bg-slate-50", i % 2 === 0 ? "" : "")}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4 flex-shrink-0", grp?.color || "text-slate-400")} />
                            <span className="font-medium text-slate-800">{cfg?.label || record.checkType}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 hidden md:table-cell max-w-xs truncate">
                          {renderDataSummary(record)}
                          {record.notes && <span className="text-slate-400 ml-1">· {record.notes}</span>}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={record.status} />
                        </td>
                        <td className="py-3 px-4 text-slate-500 hidden lg:table-cell">
                          {record.checkedBy.name || record.checkedBy.email}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(record.checkedAt)}
                        </td>
                        {isManager && (
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleDelete(record.id)}
                              disabled={deletingId === record.id}
                              className="text-slate-300 hover:text-red-400 transition-colors"
                            >
                              {deletingId === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Check Modal */}
      <Dialog open={!!activeModal} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeConfig && (() => {
                const grp = getGroupConfig(activeModal!);
                const Icon = grp?.icon || ClipboardCheck;
                return <Icon className={cn("h-5 w-5", grp?.color)} />;
              })()}
              {activeConfig?.label}
            </DialogTitle>
            {activeConfig?.description && (
              <p className="text-sm text-slate-500 mt-1">{activeConfig.description}</p>
            )}
          </DialogHeader>
          <div className="mt-2">{renderForm()}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
