"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Loader2, Trash2, Users, LayoutGrid, Maximize2, Wine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DayReservation {
  id: string;
  tableId: string;
  customerName: string;
  partySize: number;
  time: string;
  status: string;
  duration: number;
}

type TableShape = "square" | "circle" | "rect" | "counter";

interface FloorTable {
  id: string;
  name: string;
  capacity: number;
  location: string | null;
  posX: number;
  posY: number;
  width: number;
  height: number;
  shape: TableShape;
  dayReservations: DayReservation[];
}

interface Props {
  date: string;
  isManager: boolean;
  onOpenBooking: (reservationId: string) => void;
  onNewBookingForTable: (tableId: string, tableName: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  seated: "bg-blue-500 border-blue-600",
  confirmed: "bg-emerald-500 border-emerald-600",
  pending: "bg-amber-400 border-amber-500",
};

// Default size per shape when creating a new table
const SHAPE_DEFAULTS: Record<TableShape, { width: number; height: number }> = {
  square: { width: 90, height: 90 },
  circle: { width: 90, height: 90 },
  rect: { width: 160, height: 80 },
  counter: { width: 260, height: 50 },
};

const SIZE_PRESETS = [
  { label: "S", width: 70, height: 70 },
  { label: "M", width: 100, height: 100 },
  { label: "L", width: 140, height: 140 },
];

function currentTableStatus(res: DayReservation[]): { color: string; label: string; res: DayReservation | null } {
  if (res.length === 0) return { color: "bg-white border-slate-300", label: "Free", res: null };
  const seated = res.find((r) => r.status === "seated");
  if (seated) return { color: STATUS_COLOR.seated, label: `Seated · ${seated.customerName}`, res: seated };
  const next = res[0];
  return {
    color: STATUS_COLOR[next.status] ?? "bg-slate-300 border-slate-400",
    label: `${next.time} · ${next.customerName}`,
    res: next,
  };
}

export function FloorPlanView({ date, isManager, onOpenBooking, onNewBookingForTable }: Props) {
  const [tables, setTables] = useState<FloorTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add/edit table dialog
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<FloorTable | null>(null);
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");
  const [tableShape, setTableShape] = useState<TableShape>("square");
  const [tableWidth, setTableWidth] = useState(90);
  const [tableHeight, setTableHeight] = useState(90);
  const [savingTable, setSavingTable] = useState(false);

  // Drag / resize state
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ id: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [, forceRerender] = useState(0);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tables/list?date=${date}`);
      const data = await res.json();
      setTables(data.tables ?? []);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  function openAddTable() {
    setEditingTable(null);
    setTableName("");
    setTableCapacity("4");
    setTableShape("square");
    setTableWidth(SHAPE_DEFAULTS.square.width);
    setTableHeight(SHAPE_DEFAULTS.square.height);
    setTableDialogOpen(true);
  }

  function openEditTable(t: FloorTable) {
    setEditingTable(t);
    setTableName(t.name);
    setTableCapacity(String(t.capacity));
    setTableShape(t.shape);
    setTableWidth(t.width);
    setTableHeight(t.height);
    setTableDialogOpen(true);
  }

  function handleShapeChange(shape: TableShape) {
    setTableShape(shape);
    // Only auto-apply the shape's default size for brand-new tables —
    // don't clobber a size someone already customised while editing.
    if (!editingTable) {
      setTableWidth(SHAPE_DEFAULTS[shape].width);
      setTableHeight(SHAPE_DEFAULTS[shape].height);
    }
  }

  async function saveTable() {
    if (!tableName.trim()) return;
    setSavingTable(true);
    try {
      const payload = {
        name: tableName.trim(),
        capacity: parseInt(tableCapacity) || 1,
        shape: tableShape,
        width: tableWidth,
        height: tableHeight,
      };
      if (editingTable) {
        await fetch(`/api/tables/${editingTable.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/tables/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setTableDialogOpen(false);
      await fetchTables();
    } finally {
      setSavingTable(false);
    }
  }

  async function deleteTable() {
    if (!editingTable) return;
    if (!confirm(`Delete ${editingTable.name}? This can't be undone.`)) return;
    setSavingTable(true);
    try {
      await fetch(`/api/tables/${editingTable.id}`, { method: "DELETE" });
      setTableDialogOpen(false);
      await fetchTables();
    } finally {
      setSavingTable(false);
    }
  }

  // ── Drag to reposition (manager edit mode only) ──────────────────────────
  function handlePointerDown(e: React.PointerEvent, t: FloorTable) {
    if (!editMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    dragRef.current = {
      id: t.id,
      offsetX: e.clientX - canvasRect.left - t.posX,
      offsetY: e.clientY - canvasRect.top - t.posY,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (resizeRef.current) {
      const { id, startX, startY, startW, startH } = resizeRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newW = Math.max(40, Math.min(400, startW + dx));
      const newH = Math.max(40, Math.min(400, startH + dy));
      setTables((prev) => prev.map((t) => (t.id === id ? { ...t, width: newW, height: newH } : t)));
      forceRerender((n) => n + 1);
      return;
    }
    if (!dragRef.current || !editMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const { id, offsetX, offsetY } = dragRef.current;
    const newX = Math.max(0, e.clientX - canvasRect.left - offsetX);
    const newY = Math.max(0, e.clientY - canvasRect.top - offsetY);
    setTables((prev) => prev.map((t) => (t.id === id ? { ...t, posX: newX, posY: newY } : t)));
    forceRerender((n) => n + 1);
  }

  async function handlePointerUp() {
    if (resizeRef.current) {
      const { id } = resizeRef.current;
      const t = tables.find((x) => x.id === id);
      resizeRef.current = null;
      if (t) {
        await fetch(`/api/tables/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ width: t.width, height: t.height }),
        });
      }
      return;
    }
    if (!dragRef.current) return;
    const { id } = dragRef.current;
    const t = tables.find((x) => x.id === id);
    dragRef.current = null;
    if (t) {
      await fetch(`/api/tables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posX: t.posX, posY: t.posY }),
      });
    }
  }

  function handleResizeStart(e: React.PointerEvent, t: FloorTable) {
    e.stopPropagation();
    resizeRef.current = { id: t.id, startX: e.clientX, startY: e.clientY, startW: t.width, startH: t.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleTableClick(t: FloorTable) {
    if (editMode) return; // clicks in edit mode are for dragging/resizing, not opening
    const status = currentTableStatus(t.dayReservations);
    if (status.res) {
      onOpenBooking(status.res.id);
    } else {
      onNewBookingForTable(t.id, t.name);
    }
  }

  const canvasHeight = Math.max(420, ...tables.map((t) => t.posY + t.height + 40));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-white border border-slate-300" /> Free</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Upcoming</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Confirmed</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Seated</span>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={editMode ? "default" : "outline"}
              onClick={() => setEditMode((v) => !v)}
              className="gap-1.5 h-8 px-3 text-xs"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {editMode ? "Done arranging" : "Arrange tables"}
            </Button>
            <Button size="sm" onClick={openAddTable} className="gap-1.5 h-8 px-3 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Add table
            </Button>
          </div>
        )}
      </div>

      {/* Canvas */}
      {tables.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 px-4">
          <LayoutGrid className="h-12 w-12 text-slate-200" />
          <p className="text-slate-400 font-medium">No tables set up yet</p>
          {isManager && (
            <Button size="sm" variant="outline" onClick={openAddTable} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add your first table
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-4 pb-6">
          <div
            ref={canvasRef}
            className="relative bg-slate-50 border border-slate-200 rounded-2xl min-w-[600px]"
            style={{ height: canvasHeight }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            {tables.map((t) => {
              const status = currentTableStatus(t.dayReservations);
              const isCircle = t.shape === "circle";
              const isCounter = t.shape === "counter";
              return (
                <div
                  key={t.id}
                  onPointerDown={(e) => handlePointerDown(e, t)}
                  onClick={() => !editMode && handleTableClick(t)}
                  onDoubleClick={() => editMode && openEditTable(t)}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 shadow-sm transition-shadow select-none",
                    status.color,
                    isCircle ? "rounded-full" : isCounter ? "rounded-md" : "rounded-xl",
                    isCounter && "border-dashed",
                    editMode ? "cursor-grab active:cursor-grabbing ring-2 ring-violet-300" : "cursor-pointer hover:shadow-md",
                    status.res && !editMode ? "text-white" : "text-slate-700"
                  )}
                  style={{ left: t.posX, top: t.posY, width: t.width, height: t.height, touchAction: "none" }}
                  title={status.label}
                >
                  {isCounter && <Wine className="h-3 w-3 opacity-60 mb-0.5" />}
                  <span className="font-bold text-sm leading-tight px-1 text-center truncate max-w-full">{t.name}</span>
                  <span className="text-[10px] opacity-80 flex items-center gap-0.5">
                    <Users className="h-2.5 w-2.5" /> {t.capacity}
                  </span>
                  {status.res && (
                    <span className="text-[9px] opacity-90 mt-0.5 px-1 truncate max-w-full">
                      {status.res.time}
                    </span>
                  )}
                  {/* Resize handle — edit mode only */}
                  {editMode && (
                    <div
                      onPointerDown={(e) => handleResizeStart(e, t)}
                      className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-violet-600 border-2 border-white shadow cursor-nwse-resize flex items-center justify-center"
                      title="Drag to resize"
                    >
                      <Maximize2 className="h-2 w-2 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {isManager && editMode && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Drag tables to match your real floor plan · drag the violet handle to resize · double-click to edit or delete
            </p>
          )}
        </div>
      )}

      {/* Add/Edit table dialog */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Edit Table" : "Add Table"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Table name</Label>
              <Input value={tableName} onChange={(e) => setTableName(e.target.value)} placeholder="e.g. T1, Window 2, Bar Counter" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Capacity</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={tableCapacity}
                onChange={(e) => setTableCapacity(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Shape / type</Label>
              <Select value={tableShape} onValueChange={(v) => handleShapeChange(v as TableShape)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="square">Square table</SelectItem>
                  <SelectItem value="circle">Round table</SelectItem>
                  <SelectItem value="rect">Rectangular table</SelectItem>
                  <SelectItem value="counter">Bar / Counter seating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Size</Label>
              <div className="flex items-center gap-2 mt-1">
                {SIZE_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setTableWidth(p.width); setTableHeight(tableShape === "counter" || tableShape === "rect" ? Math.round(p.height * 0.6) : p.height); }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                      tableWidth === p.width
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-slate-500 border-slate-200 hover:border-violet-300"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[10px] text-slate-400">Width (px)</Label>
                  <Input
                    type="number"
                    min={30}
                    max={500}
                    value={tableWidth}
                    onChange={(e) => setTableWidth(parseInt(e.target.value) || 90)}
                    className="mt-0.5 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-slate-400">Height (px)</Label>
                  <Input
                    type="number"
                    min={30}
                    max={500}
                    value={tableHeight}
                    onChange={(e) => setTableHeight(parseInt(e.target.value) || 90)}
                    className="mt-0.5 h-8 text-sm"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Tip: you can also drag the resize handle directly on the floor plan.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingTable && (
              <Button variant="destructive" size="sm" onClick={deleteTable} disabled={savingTable} className="mr-auto gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setTableDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={saveTable} disabled={savingTable || !tableName.trim()}>
              {savingTable && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editingTable ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
