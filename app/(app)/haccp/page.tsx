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
  Trash2,
  ShieldCheck,
  Download,
  Settings2,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface HACCPRecord {
  id: string;
  checkType: string;
  checkedAt: string;
  status: string;
  data: Record<string, unknown>;
  notes: string | null;
  checkedBy: { name: string | null; email: string };
}

interface HACCPEquipment {
  id: string;
  name: string;
  equipType: string;
}

interface ExpenseItem {
  id: string;
  vendor: string | null;
  description: string | null;
  category: string;
  date: string;
  aiLineItems: unknown;
}

// ─── Check type config ───────────────────────────────────────────────────────

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
        equipType: "fridge",
      },
      {
        type: "freezer_temp",
        label: "Freezer",
        description: "Log freezer temperatures",
        minTemp: -25,
        maxTemp: -18,
        unit: "°C",
        frequency: "Daily",
        equipType: "freezer",
      },
      {
        type: "hot_holding",
        label: "Hot Holding",
        description: "Food kept hot must be above 63°C",
        minTemp: 63,
        maxTemp: 100,
        unit: "°C",
        frequency: "Every 2hrs",
        equipType: "hot_holding",
      },
      {
        type: "cooking_temp",
        label: "Cooking Temperature",
        description: "Core temp must reach ≥75°C",
        minTemp: 75,
        maxTemp: 100,
        unit: "°C",
        frequency: "Per cook",
        equipType: null,
      },
      {
        type: "cooling",
        label: "Cooling Record",
        description: "Food must cool from 60°C to below 4°C within 4 hours",
        minTemp: 0,
        maxTemp: 4,
        unit: "°C",
        frequency: "Per batch",
        equipType: null,
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
        equipType: null,
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
        equipType: null,
      },
      {
        type: "cleaning_weekly",
        label: "Weekly Cleaning",
        description: "Behind equipment, storage areas, vents, drains",
        frequency: "Weekly",
        equipType: null,
      },
      {
        type: "cleaning_deep",
        label: "Deep Clean",
        description: "Full kitchen deep clean record",
        frequency: "Monthly",
        equipType: null,
      },
      {
        type: "opening_checks",
        label: "Opening Checks",
        description: "Daily opening safety and hygiene checklist",
        frequency: "Daily AM",
        equipType: null,
      },
      {
        type: "closing_checks",
        label: "Closing Checks",
        description: "Daily closing safety and hygiene checklist",
        frequency: "Daily PM",
        equipType: null,
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
        equipType: null,
      },
      {
        type: "corrective_action",
        label: "Corrective Action",
        description: "Log when a check fails and what action was taken",
        frequency: "As needed",
        equipType: null,
      },
    ],
  },
];

const ALL_CHECKS = CHECK_GROUPS.flatMap((g) =>
  g.checks.map((c) => ({ ...c, group: g.label }))
);
// Equipment-list modal only for these types
const EQUIP_TEMP_TYPES = ["fridge_temp", "freezer_temp", "hot_holding"];
// All temp check types (used for routing)
const TEMP_TYPES = ["fridge_temp", "freezer_temp", "hot_holding", "cooking_temp", "cooling"];

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

// ─── Equipment Temp Modal ─────────────────────────────────────────────────────
// Shows named equipment list — user types only the temperature, everything else auto-filled

function EquipmentTempModal({
  config,
  equipment,
  isManager,
  onSaveAll,
  onAddEquipment,
  onDeleteEquipment,
  saving,
}: {
  config: (typeof ALL_CHECKS)[0];
  equipment: HACCPEquipment[];
  isManager: boolean;
  onSaveAll: (
    entries: { equipmentId: string; name: string; temp: number; status: string; notes: string }[]
  ) => Promise<void>;
  onAddEquipment: (name: string) => Promise<void>;
  onDeleteEquipment: (id: string) => Promise<void>;
  saving: boolean;
}) {
  // temps[equipmentId] = { value: string; notes: string }
  const [temps, setTemps] = useState<Record<string, { value: string; notes: string }>>({});
  const [addingName, setAddingName] = useState("");
  const [addingEquip, setAddingEquip] = useState(false);
  const [addingLoading, setAddingLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);

  const minTemp = ("minTemp" in config ? config.minTemp : 0) as number;
  const maxTemp = ("maxTemp" in config ? config.maxTemp : 100) as number;

  function inRange(val: string) {
    const n = parseFloat(val);
    return val !== "" && !isNaN(n) && n >= minTemp && n <= maxTemp;
  }
  function outOfRange(val: string) {
    const n = parseFloat(val);
    return val !== "" && !isNaN(n) && !inRange(val);
  }

  const readyEntries = equipment.filter((eq) => {
    const t = temps[eq.id];
    if (!t || t.value === "") return false;
    if (outOfRange(t.value) && !t.notes) return false;
    return true;
  });

  const handleSaveAll = async () => {
    const entries = readyEntries.map((eq) => {
      const t = temps[eq.id]!;
      const n = parseFloat(t.value);
      return {
        equipmentId: eq.id,
        name: eq.name,
        temp: n,
        status: inRange(t.value) ? "pass" : "fail",
        notes: t.notes,
      };
    });
    await onSaveAll(entries);
    setTemps({});
  };

  const handleAdd = async () => {
    if (!addingName.trim()) return;
    setAddingLoading(true);
    await onAddEquipment(addingName.trim());
    setAddingLoading(false);
    setAddingName("");
    setAddingEquip(false);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await onDeleteEquipment(id);
    setDeletingId(null);
  };

  const now = new Date().toLocaleString("en-IE", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });

  if (equipment.length === 0 && !isManager) {
    return (
      <div className="py-8 text-center text-slate-400">
        <Thermometer className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No equipment set up yet.</p>
        <p className="text-xs mt-1">Ask your manager to add equipment units.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Safe range banner */}
      <div className="flex items-center justify-between">
        <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm text-slate-600">
          Safe range:{" "}
          <strong>
            {minTemp}°C – {maxTemp}°C
          </strong>
          <span className="ml-3 text-slate-400 text-xs">{now}</span>
        </div>
        {isManager && (
          <button
            onClick={() => setManageMode((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
              manageMode
                ? "bg-slate-900 text-white border-slate-900"
                : "text-slate-500 border-slate-200 hover:bg-slate-50"
            )}
          >
            <Settings2 className="h-3 w-3" />
            {manageMode ? "Done" : "Manage"}
          </button>
        )}
      </div>

      {/* Equipment list */}
      {equipment.length === 0 && isManager && (
        <p className="text-sm text-slate-400 text-center py-4">
          No equipment added yet — add your first unit below.
        </p>
      )}

      <div className="space-y-2">
        {equipment.map((eq) => {
          const t = temps[eq.id] || { value: "", notes: "" };
          const isIn = inRange(t.value);
          const isOut = outOfRange(t.value);
          return (
            <div
              key={eq.id}
              className={cn(
                "rounded-xl border p-3 transition-all",
                isOut
                  ? "border-red-200 bg-red-50"
                  : isIn
                  ? "border-green-200 bg-green-50"
                  : "border-slate-200 bg-white"
              )}
            >
              <div className="flex items-center gap-3">
                {manageMode && isManager ? (
                  <button
                    onClick={() => handleDelete(eq.id)}
                    disabled={deletingId === eq.id}
                    className="text-slate-300 hover:text-red-400 flex-shrink-0"
                  >
                    {deletingId === eq.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </button>
                ) : null}

                {/* Equipment name */}
                <span className="flex-1 text-sm font-medium text-slate-800">{eq.name}</span>

                {/* Status indicator */}
                {isIn && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                {isOut && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}

                {/* Temp input */}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="—"
                    value={t.value}
                    onChange={(e) =>
                      setTemps((prev) => ({
                        ...prev,
                        [eq.id]: { ...prev[eq.id], value: e.target.value, notes: prev[eq.id]?.notes || "" },
                      }))
                    }
                    className={cn(
                      "w-24 text-right font-mono tabular-nums",
                      isOut && "border-red-400 bg-red-50 focus:border-red-400",
                      isIn && "border-green-400 bg-green-50 focus:border-green-400"
                    )}
                    disabled={manageMode}
                  />
                  <span className="text-sm text-slate-400 w-6">°C</span>
                </div>
              </div>

              {/* Out of range: notes required */}
              {isOut && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Out of safe range — add corrective action note
                  </p>
                  <Input
                    placeholder="What action was taken?"
                    value={t.notes}
                    onChange={(e) =>
                      setTemps((prev) => ({
                        ...prev,
                        [eq.id]: { ...prev[eq.id], notes: e.target.value },
                      }))
                    }
                    className="text-sm border-red-300"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add equipment (managers only) */}
      {isManager && (
        <div>
          {addingEquip ? (
            <div className="flex items-center gap-2 mt-1">
              <Input
                autoFocus
                placeholder={`e.g. Main ${config.type === "fridge_temp" ? "Fridge" : config.type === "freezer_temp" ? "Freezer" : "Unit"}`}
                value={addingName}
                onChange={(e) => setAddingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") setAddingEquip(false);
                }}
                className="flex-1"
              />
              <Button size="sm" onClick={handleAdd} disabled={addingLoading || !addingName.trim()}>
                {addingLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddingEquip(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setAddingEquip(true)}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-700 transition-colors mt-1"
            >
              <Plus className="h-4 w-4" /> Add equipment unit
            </button>
          )}
        </div>
      )}

      {/* Save All */}
      {!manageMode && (
        <Button
          className="w-full bg-slate-900 hover:bg-slate-800"
          onClick={handleSaveAll}
          disabled={saving || readyEntries.length === 0}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          {readyEntries.length === 0
            ? "Enter at least one temperature"
            : `Save ${readyEntries.length} record${readyEntries.length > 1 ? "s" : ""}`}
        </Button>
      )}
    </div>
  );
}

// ─── Delivery Form ────────────────────────────────────────────────────────────

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
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetch("/api/expenses/list")
      .then((r) => (r.ok ? r.json() : { expenses: [] }))
      .then((data) => {
        const foodCats = ["stock", "food", "beverages"];
        const filtered = ((data.expenses || []) as ExpenseItem[])
          .filter((e) => foodCats.includes(e.category) && e.vendor)
          .slice(0, 20);
        setExpenses(filtered);
      })
      .catch(() => {});
  }, []);

  const handleImport = (exp: ExpenseItem) => {
    setSupplier(exp.vendor || "");
    let prod = "";
    if (exp.aiLineItems && Array.isArray(exp.aiLineItems)) {
      const items = exp.aiLineItems as Array<{ description?: string; name?: string }>;
      prod = items
        .map((i) => i.description || i.name || "")
        .filter(Boolean)
        .join(", ")
        .slice(0, 80);
    }
    if (!prod && exp.description) prod = exp.description;
    setProduct(prod);
    setImportOpen(false);
  };

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
      {/* Import from bookkeeping */}
      {expenses.length > 0 && (
        <div>
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <Truck className="h-4 w-4" />
            Import from recent expense {importOpen ? "▲" : "▼"}
          </button>
          {importOpen && (
            <div className="mt-2 rounded-lg border border-slate-200 divide-y overflow-hidden max-h-48 overflow-y-auto">
              {expenses.map((exp) => (
                <button
                  key={exp.id}
                  onClick={() => handleImport(exp)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                >
                  <span className="font-medium text-slate-800">{exp.vendor}</span>
                  {exp.description && (
                    <span className="text-slate-400 ml-2">
                      {exp.description.slice(0, 50)}
                    </span>
                  )}
                  <span className="text-xs text-slate-300 ml-2">
                    {new Date(exp.date).toLocaleDateString("en-IE")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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

// ─── Checklist Form ───────────────────────────────────────────────────────────

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
  "All drains jet washed",
  "Pest control check completed",
  "Signed off by manager",
];
const OPENING_ITEMS = [
  "All fridge/freezer temps within safe range",
  "Hand washing facilities clean and stocked",
  "All food covered and correctly labelled",
  "Prep surfaces sanitised before use",
  "Date labels checked — remove expired stock",
  "Pest check — no signs of activity",
  "Equipment working correctly (no faults)",
];
const CLOSING_ITEMS = [
  "All food stored, covered and labelled",
  "Cooking equipment switched off and cleaned",
  "Surfaces wiped and sanitised",
  "Floor swept and mopped",
  "Bins emptied",
  "Fridges/freezers closed and temps normal",
  "Gas/electrics checked",
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
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [notes, setNotes] = useState("");

  const toggle = (i: number) => setChecked((p) => ({ ...p, [i]: !p[i] }));
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const missed = items.length - checkedCount;
  const status = missed > 2 ? "fail" : missed > 0 ? "corrective" : "pass";

  const handleSubmit = () => {
    const completedItems = items.filter((_, i) => checked[i]);
    const missedItems = items.filter((_, i) => !checked[i]);
    onSubmit({ completedItems, missedItems, completedBy: "Staff" }, status, notes);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((item, i) => (
          <label
            key={i}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
              checked[i]
                ? "bg-green-50 border-green-200"
                : "bg-white border-slate-200 hover:bg-slate-50"
            )}
          >
            <input
              type="checkbox"
              checked={!!checked[i]}
              onChange={() => toggle(i)}
              className="mt-0.5 h-4 w-4 accent-green-600"
            />
            <span className="text-sm text-slate-700">{item}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {checkedCount} / {items.length} completed
        </span>
        {missed > 0 && (
          <span className={cn("font-medium", missed > 2 ? "text-red-600" : "text-amber-600")}>
            {missed} item{missed > 1 ? "s" : ""} missed
            {missed > 2 ? " — FAIL" : " — corrective action"}
          </span>
        )}
      </div>
      {missed > 0 && (
        <div className="space-y-2">
          <Label>Notes / corrective action</Label>
          <Textarea
            placeholder="What was missed and why?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      )}
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={handleSubmit}
        disabled={loading || checkedCount === 0}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Record ({checkedCount}/{items.length})
      </Button>
    </div>
  );
}

// ─── Pest Form ────────────────────────────────────────────────────────────────

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
      <div className="space-y-2">
        <Label>Observation type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="no_activity">No activity observed</SelectItem>
            <SelectItem value="rodent">Rodent signs</SelectItem>
            <SelectItem value="insects">Insects / flies</SelectItem>
            <SelectItem value="other">Other pest</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Location</Label>
        <Input placeholder="e.g. Dry store, back door" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Action taken</Label>
        <Textarea placeholder="e.g. Bait station checked, contractor called, no action required" value={action} onChange={(e) => setAction(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea placeholder="Additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={() => onSubmit({ pestType: type, location, action }, type === "no_activity" ? "pass" : "corrective", notes)}
        disabled={loading || !type || !location || !action}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Record
      </Button>
    </div>
  );
}

// ─── Corrective Action Form ───────────────────────────────────────────────────

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
        <Textarea placeholder="e.g. fridge temp was 8°C, food left out too long" value={issue} onChange={(e) => setIssue(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Corrective action taken</Label>
        <Textarea placeholder="e.g. food discarded, fridge engineer called" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} rows={2} />
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

// ─── Cooking Temp Form ────────────────────────────────────────────────────────

function CookingTempForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const nowTime = () => new Date().toTimeString().slice(0, 5);
  const [itemName, setItemName] = useState("");
  const [startTime, setStartTime] = useState(nowTime());
  const [endTime, setEndTime] = useState("");
  const [coreTemp, setCoreTemp] = useState("");
  const [notes, setNotes] = useState("");

  const temp = parseFloat(coreTemp);
  const isPassed = !isNaN(temp) && temp >= 75;
  const isFailed = coreTemp !== "" && !isNaN(temp) && temp < 75;

  const handleSubmit = () => {
    onSubmit(
      { itemName, startTime, endTime, coreTemp: temp },
      isPassed ? "pass" : "fail",
      notes
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-700">
        Core temperature must reach <strong>≥75°C</strong> to pass
      </div>
      <div className="space-y-2">
        <Label>Item / Food Name</Label>
        <Input
          placeholder="e.g. Chicken breast, Lasagne, Soup"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Core Temperature (°C)</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            placeholder="e.g. 78.5"
            value={coreTemp}
            onChange={(e) => setCoreTemp(e.target.value)}
            className={cn(
              isPassed && "border-green-400 bg-green-50",
              isFailed && "border-red-400 bg-red-50"
            )}
          />
          <span className="text-sm text-slate-400 w-6">°C</span>
          {isPassed && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />}
          {isFailed && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />}
        </div>
        {coreTemp && (
          <p className={cn("text-xs font-medium", isPassed ? "text-green-600" : "text-red-600")}>
            {isPassed
              ? "✓ Safe cooking temperature reached"
              : `✗ Below 75°C — continue cooking or discard. Currently: ${coreTemp}°C`}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label>{isFailed ? "Corrective Action (required)" : "Notes (optional)"}</Label>
        <Textarea
          placeholder={
            isFailed
              ? "e.g. Continued cooking for 5 mins, batch discarded"
              : "Any additional notes..."
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={handleSubmit}
        disabled={loading || !itemName || !coreTemp || !endTime || (isFailed && !notes)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Cooking Record
      </Button>
    </div>
  );
}

// ─── Cooling Form ─────────────────────────────────────────────────────────────

function CoolingForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, unknown>, status: string, notes: string) => void;
  loading: boolean;
}) {
  const nowTime = () => new Date().toTimeString().slice(0, 5);
  const [itemName, setItemName] = useState("");
  const [startTime, setStartTime] = useState(nowTime());
  const [startTemp, setStartTemp] = useState("");
  const [endTime, setEndTime] = useState("");
  const [endTemp, setEndTemp] = useState("");
  const [notes, setNotes] = useState("");

  const elapsedHours = (() => {
    if (!startTime || !endTime) return null;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    const diff =
      endMins >= startMins ? endMins - startMins : 24 * 60 - startMins + endMins;
    return diff / 60;
  })();

  const finalTemp = parseFloat(endTemp);
  const tempOk = !isNaN(finalTemp) && finalTemp <= 4;
  const timeOk = elapsedHours !== null && elapsedHours <= 4;
  const isPassed = endTemp !== "" && tempOk && timeOk;
  const isFailed = endTemp !== "" && !isNaN(finalTemp) && !isPassed;

  // Use-by = today + 3 days
  const useByDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toLocaleDateString("en-IE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();

  const handleSubmit = () => {
    onSubmit(
      {
        itemName,
        startTime,
        startTemp: startTemp ? parseFloat(startTemp) : null,
        endTime,
        endTemp: finalTemp,
        elapsedHours: elapsedHours !== null ? Math.round(elapsedHours * 10) / 10 : null,
        useByDate: isPassed ? useByDate : null,
      },
      isPassed ? "pass" : "fail",
      notes
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-700">
        Food must cool to <strong>≤4°C within 4 hours</strong>
      </div>
      <div className="space-y-2">
        <Label>Item / Food Name</Label>
        <Input
          placeholder="e.g. Chicken stock, Lasagne, Curry sauce"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Start Temp (°C)</Label>
          <Input
            type="number"
            step="0.1"
            placeholder="e.g. 60"
            value={startTemp}
            onChange={(e) => setStartTemp(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Final Temp (°C)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.1"
              placeholder="e.g. 3.5"
              value={endTemp}
              onChange={(e) => setEndTemp(e.target.value)}
              className={cn(
                isPassed && "border-green-400 bg-green-50",
                isFailed && "border-red-400 bg-red-50"
              )}
            />
            {isPassed && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
            {isFailed && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
          </div>
        </div>
      </div>

      {endTemp && elapsedHours !== null && (
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            isPassed
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          )}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span>
              {isPassed ? "✓ Pass" : "✗ Fail"} — {elapsedHours.toFixed(1)}h elapsed,{" "}
              final temp {endTemp}°C
            </span>
            {isPassed && (
              <span className="font-semibold">Use by: {useByDate}</span>
            )}
          </div>
          {!isPassed && (
            <p className="text-xs mt-1">
              {!tempOk ? `Final temp above 4°C (${endTemp}°C). ` : ""}
              {!timeOk ? `Cooling took ${elapsedHours.toFixed(1)}h — over 4hr limit. ` : ""}
              Food must be discarded.
            </p>
          )}
        </div>
      )}

      {isPassed && (
        <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm text-slate-600 flex items-center gap-2">
          <Clock className="h-4 w-4 flex-shrink-0" />
          Auto use-by: <strong>{useByDate}</strong> — label before storing
        </div>
      )}

      <div className="space-y-2">
        <Label>{isFailed ? "Corrective Action (required)" : "Notes (optional)"}</Label>
        <Textarea
          placeholder={
            isFailed
              ? "e.g. Food discarded, switched to blast chiller"
              : "Any additional notes..."
          }
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>
      <Button
        className="w-full bg-slate-900 hover:bg-slate-800"
        onClick={handleSubmit}
        disabled={loading || !itemName || !endTemp || !endTime || (isFailed && !notes)}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Save Cooling Record
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HACCPPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<HACCPRecord[]>([]);
  const [todayRecords, setTodayRecords] = useState<HACCPRecord[]>([]);
  const [equipment, setEquipment] = useState<HACCPEquipment[]>([]);
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
      fetch(`/api/haccp?date=${today}&limit=500`),
      fetch(`/api/haccp?limit=500`),
    ]);
    const todayData = await todayRes.json();
    const allData = await allRes.json();
    setTodayRecords(todayData.records || []);
    setRecords(allData.records || []);
  }, [today]);

  const fetchEquipment = useCallback(async () => {
    const res = await fetch("/api/haccp/equipment");
    const data = await res.json();
    setEquipment(data.equipment || []);
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchEquipment();
  }, [fetchRecords, fetchEquipment]);

  // Save a single HACCP record
  const saveRecord = async (
    checkType: string,
    data: Record<string, unknown>,
    status: string,
    notes: string
  ) => {
    const res = await fetch("/api/haccp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkType, data, status, notes }),
    });
    return res.ok;
  };

  // For non-temp checks: save one record and close
  const handleSave = async (
    checkType: string,
    data: Record<string, unknown>,
    status: string,
    notes: string
  ) => {
    setSaving(true);
    try {
      const ok = await saveRecord(checkType, data, status, notes);
      if (ok) {
        setActiveModal(null);
        await fetchRecords();
      }
    } finally {
      setSaving(false);
    }
  };

  // For temp checks with equipment list: save all entries in parallel
  const handleSaveEquipmentTemps = async (
    checkType: string,
    entries: { equipmentId: string; name: string; temp: number; status: string; notes: string }[]
  ) => {
    setSaving(true);
    try {
      await Promise.all(
        entries.map((entry) =>
          saveRecord(
            checkType,
            { location: entry.name, temperature: entry.temp, equipmentId: entry.equipmentId },
            entry.status,
            entry.notes
          )
        )
      );
      setActiveModal(null);
      await fetchRecords();
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

  const handleAddEquipment = async (name: string, equipType: string) => {
    try {
      const res = await fetch("/api/haccp/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, equipType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to add equipment unit");
        return;
      }
      await fetchEquipment();
      toast.success(`"${name}" added`);
    } catch {
      toast.error("Network error — could not add equipment");
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      const res = await fetch(`/api/haccp/equipment?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete equipment unit");
        return;
      }
      await fetchEquipment();
    } catch {
      toast.error("Network error — could not delete equipment");
    }
  };

  // Compliance score
  const requiredDaily = ["fridge_temp", "freezer_temp", "opening_checks", "closing_checks", "cleaning_daily"];
  const doneToday = requiredDaily.filter((t) => todayRecords.some((r) => r.checkType === t));
  const complianceScore = Math.round((doneToday.length / requiredDaily.length) * 100);

  const filteredHistory =
    historyFilter === "all" ? records : records.filter((r) => r.checkType === historyFilter);

  const activeConfig = activeModal ? getCheckConfig(activeModal) : null;

  // Equipment for current modal's type
  const activeEquipType = activeConfig?.equipType || null;
  const activeEquipment = activeEquipType
    ? equipment.filter((e) => e.equipType === activeEquipType)
    : [];

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
    if (d.pestType) parts.push(String(d.pestType));
    if (d.issue) parts.push(String(d.issue).slice(0, 60) + (String(d.issue).length > 60 ? "…" : ""));
    return parts.join(" · ") || "—";
  }

  // PDF export
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
      const summary = parts.join(" \u00b7 ") || "\u2014";
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

  // ─── Render ──────────────────────────────────────────────────────────────

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
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="h-4 w-4 mr-1" /> PDF
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
            <p className="font-semibold text-slate-900">Today&apos;s compliance score</p>
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
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("en-IE", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <p className="text-xs text-slate-400 mt-1">All records timestamped & signed</p>
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
                    // For temp checks: show equipment count
                    const eqCount = check.equipType
                      ? equipment.filter((e) => e.equipType === check.equipType).length
                      : null;

                    return (
                      <button
                        key={check.type}
                        onClick={() => setActiveModal(check.type)}
                        className={cn(
                          "w-full text-left rounded-xl border p-4 hover:shadow-md transition-all group",
                          hasFail
                            ? "border-red-300 bg-red-50"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-slate-900 text-sm">
                                {check.label}
                              </span>
                              {hasFail && (
                                <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                                  Fail
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mb-2">{check.description}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span
                                className={cn(
                                  "text-xs px-2 py-0.5 rounded-full border font-medium",
                                  group.bgColor,
                                  group.borderColor,
                                  group.color
                                )}
                              >
                                {check.frequency}
                              </span>
                              {eqCount !== null && (
                                <span className="text-xs text-slate-400">
                                  {eqCount} unit{eqCount !== 1 ? "s" : ""}
                                  {isManager && eqCount === 0 ? " — tap to add" : ""}
                                </span>
                              )}
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
                          <div
                            className={cn(
                              "p-2 rounded-lg ml-3 transition-colors",
                              group.bgColor,
                              "group-hover:opacity-80"
                            )}
                          >
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
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 hidden md:table-cell">
                      Details
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600 hidden lg:table-cell">
                      By
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-600">Date</th>
                    {isManager && <th className="py-3 px-4"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((record) => {
                    const cfg = getCheckConfig(record.checkType);
                    const grp = getGroupConfig(record.checkType);
                    const Icon = grp?.icon || ClipboardCheck;
                    return (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4 flex-shrink-0", grp?.color || "text-slate-400")} />
                            <span className="font-medium text-slate-800">{cfg?.label || record.checkType}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-500 hidden md:table-cell max-w-xs truncate">
                          {renderDataSummary(record)}
                          {record.notes && (
                            <span className="text-slate-400 ml-1">· {record.notes}</span>
                          )}
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
              {activeConfig &&
                (() => {
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

          <div className="mt-2">
            {/* Equipment temperature checks (fridge / freezer / hot holding) */}
            {activeModal && EQUIP_TEMP_TYPES.includes(activeModal) && activeConfig && (
              <EquipmentTempModal
                config={activeConfig}
                equipment={activeEquipment}
                isManager={isManager}
                onSaveAll={(entries) => handleSaveEquipmentTemps(activeModal!, entries)}
                onAddEquipment={(name) =>
                  handleAddEquipment(name, activeConfig.equipType as string)
                }
                onDeleteEquipment={handleDeleteEquipment}
                saving={saving}
              />
            )}

            {/* Cooking Temperature */}
            {activeModal === "cooking_temp" && (
              <CookingTempForm
                onSubmit={(data, status, notes) =>
                  handleSave(activeModal, data, status, notes)
                }
                loading={saving}
              />
            )}

            {/* Cooling Record */}
            {activeModal === "cooling" && (
              <CoolingForm
                onSubmit={(data, status, notes) =>
                  handleSave(activeModal, data, status, notes)
                }
                loading={saving}
              />
            )}

            {/* Delivery */}
            {activeModal === "delivery" && (
              <DeliveryForm
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}

            {/* Cleaning checklists */}
            {activeModal === "cleaning_daily" && (
              <ChecklistForm
                items={DAILY_CLEANING_ITEMS}
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}
            {activeModal === "cleaning_weekly" && (
              <ChecklistForm
                items={WEEKLY_CLEANING_ITEMS}
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}
            {activeModal === "cleaning_deep" && (
              <ChecklistForm
                items={DEEP_CLEAN_ITEMS}
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}
            {activeModal === "opening_checks" && (
              <ChecklistForm
                items={OPENING_ITEMS}
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}
            {activeModal === "closing_checks" && (
              <ChecklistForm
                items={CLOSING_ITEMS}
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}

            {/* Incidents */}
            {activeModal === "pest_control" && (
              <PestForm
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}
            {activeModal === "corrective_action" && (
              <CorrectiveForm
                onSubmit={(data, status, notes) => handleSave(activeModal, data, status, notes)}
                loading={saving}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
