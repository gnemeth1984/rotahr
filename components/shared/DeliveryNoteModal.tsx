"use client";

import { useState, useRef, useCallback } from "react";
import {
  X, Upload, Loader2, CheckCircle2, AlertCircle, ChevronRight,
  ChevronLeft, Truck, BookMarked, Package, FlaskConical, Thermometer,
  FileText, Edit2, Check, ToggleLeft, ToggleRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  existingItemId: string | null;
  existingName: string | null;
  priceChanged: boolean;
}

interface ScanResult {
  url: string | null;
  vendor: string | null;
  invoiceDate: string | null;
  invoiceTotal: number | null;
  suggestions: LineItem[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

const STEPS = ["upload", "review", "options", "done"] as const;
type Step = typeof STEPS[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  label,
  icon: Icon,
  color = "text-emerald-600",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: React.ElementType;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 transition-all",
        checked
          ? "border-emerald-500 bg-emerald-50"
          : "border-slate-200 bg-white hover:border-slate-300"
      )}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", checked ? color : "text-slate-400")} />
      <span className={cn("font-medium text-sm flex-1 text-left", checked ? "text-slate-800" : "text-slate-500")}>
        {label}
      </span>
      {checked
        ? <ToggleRight className="h-5 w-5 text-emerald-500" />
        : <ToggleLeft className="h-5 w-5 text-slate-300" />
      }
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DeliveryNoteModal({ open, onClose, onApplied }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scan results
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<LineItem[]>([]);
  const [vendor, setVendor] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceTotal, setInvoiceTotal] = useState("");

  // Options
  const [applyBookkeeping, setApplyBookkeeping] = useState(true);
  const [applyStock, setApplyStock] = useState(true);
  const [applyHaccp, setApplyHaccp] = useState(true);
  const [deliveryTemp, setDeliveryTemp] = useState("");
  const [haccpStatus, setHaccpStatus] = useState<"pass" | "fail">("pass");
  const [haccpNotes, setHaccpNotes] = useState("");

  // Applied results
  const [results, setResults] = useState<any>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setScanning(false);
    setApplying(false);
    setError(null);
    setScan(null);
    setItems([]);
    setVendor("");
    setInvoiceDate("");
    setInvoiceTotal("");
    setApplyBookkeeping(true);
    setApplyStock(true);
    setApplyHaccp(true);
    setDeliveryTemp("");
    setHaccpStatus("pass");
    setHaccpNotes("");
    setResults(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  // ── Step 1: Scan ────────────────────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setError(null);
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/stock/scan-receipt", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setScan(data);
      setItems(data.suggestions ?? []);
      setVendor(data.vendor ?? "");
      setInvoiceDate(data.invoiceDate ?? new Date().toISOString().slice(0, 10));
      setInvoiceTotal(data.invoiceTotal != null ? String(data.invoiceTotal) : "");
      setStep("review");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  // ── Step 3: Apply ───────────────────────────────────────────────────────────
  const handleApply = async () => {
    setError(null);
    setApplying(true);
    try {
      const res = await fetch("/api/delivery-note/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendor || null,
          invoiceDate: invoiceDate || null,
          invoiceTotal: invoiceTotal ? parseFloat(invoiceTotal) : null,
          receiptUrl: scan?.url ?? null,
          items: items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            unit: i.unit,
            unitPrice: i.unitPrice,
            existingItemId: i.existingItemId,
          })),
          applyBookkeeping,
          applyStock,
          applyHaccp,
          deliveryTemp: deliveryTemp ? parseFloat(deliveryTemp) : null,
          haccpStatus,
          haccpNotes: haccpNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Apply failed");
      setResults(data.results);
      setStep("done");
      onApplied?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  // ── Item row edits ──────────────────────────────────────────────────────────
  const updateItem = (i: number, field: keyof LineItem, value: any) => {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-emerald-600" />
            <h2 className="font-bold text-slate-900">Scan Delivery Note / Invoice</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-100 flex-shrink-0">
          {[
            { key: "upload", label: "Upload" },
            { key: "review", label: "Review" },
            { key: "options", label: "Apply To" },
            { key: "done", label: "Done" },
          ].map((s, i, arr) => (
            <div key={s.key} className="flex items-center gap-1 flex-1">
              <div className={cn(
                "h-1.5 rounded-full flex-1 transition-colors",
                STEPS.indexOf(step) >= STEPS.indexOf(s.key as Step)
                  ? "bg-emerald-500" : "bg-slate-200"
              )} />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

          {/* ── STEP: upload ── */}
          {step === "upload" && (
            <div className="space-y-4">
              <p className="text-slate-500 text-sm">
                Take a photo or upload a delivery note / supplier invoice. AI will extract all line items, prices and totals in seconds.
              </p>

              <button
                onClick={() => fileRef.current?.click()}
                disabled={scanning}
                className="w-full border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-10 flex flex-col items-center gap-3 transition-colors group"
              >
                {scanning
                  ? <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                  : <Upload className="h-8 w-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                }
                <span className="text-sm text-slate-500 group-hover:text-slate-700">
                  {scanning ? "Scanning with AI…" : "Tap to upload or take photo"}
                </span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: review ── */}
          {step === "review" && (
            <div className="space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Supplier / Vendor</Label>
                  <Input value={vendor} onChange={e => setVendor(e.target.value)} className="mt-1" placeholder="e.g. Fresh Foods Ltd" />
                </div>
                <div>
                  <Label className="text-xs">Invoice Date</Label>
                  <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Invoice Total (€)</Label>
                  <Input type="number" step="0.01" value={invoiceTotal} onChange={e => setInvoiceTotal(e.target.value)} className="mt-1" placeholder="e.g. 345.60" />
                </div>
              </div>

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Line Items ({items.length})</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setItems(prev => [...prev, { name: "", quantity: 1, unit: "unit", unitPrice: null, existingItemId: null, existingName: null, priceChanged: false }])}>
                    + Add row
                  </Button>
                </div>

                {items.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">No items extracted. Add manually or re-upload.</p>
                )}

                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={item.name}
                          onChange={e => updateItem(i, "name", e.target.value)}
                          placeholder="Item name"
                          className="flex-1 h-8 text-sm"
                        />
                        <button onClick={() => removeItem(i)} className="p-1 text-slate-400 hover:text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-[10px] text-slate-400">Qty</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 0)}
                            className="h-7 text-sm mt-0.5"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-400">Unit</Label>
                          <select
                            value={item.unit}
                            onChange={e => updateItem(i, "unit", e.target.value)}
                            className="h-7 text-sm mt-0.5 w-full rounded-md border border-input bg-background px-2"
                          >
                            {["unit","kg","g","litre","ml","case","box","bottle","pack","pcs","portion"].map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-[10px] text-slate-400">Unit Price (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice ?? ""}
                            onChange={e => updateItem(i, "unitPrice", e.target.value ? parseFloat(e.target.value) : null)}
                            className="h-7 text-sm mt-0.5"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {item.existingName && (
                        <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                          <Check className="h-3 w-3" /> Matched to existing: <strong>{item.existingName}</strong>
                          {item.priceChanged && <span className="text-amber-600 ml-1">(price changed)</span>}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: options ── */}
          {step === "options" && (
            <div className="space-y-4">
              <p className="text-slate-500 text-sm">Choose where to apply this delivery note:</p>

              <div className="space-y-2">
                <Toggle
                  checked={applyBookkeeping}
                  onChange={setApplyBookkeeping}
                  label="Bookkeeping — create expense record"
                  icon={BookMarked}
                  color="text-violet-600"
                />
                <Toggle
                  checked={applyStock}
                  onChange={setApplyStock}
                  label="Stock — update inventory & prices"
                  icon={Package}
                  color="text-blue-600"
                />
                <Toggle
                  checked={applyHaccp}
                  onChange={setApplyHaccp}
                  label="HACCP — log delivery check"
                  icon={FlaskConical}
                  color="text-amber-600"
                />
              </div>

              {applyHaccp && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                    <Thermometer className="h-4 w-4" /> HACCP Delivery Details
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Delivery Temp (°C)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={deliveryTemp}
                        onChange={e => setDeliveryTemp(e.target.value)}
                        className="mt-1 h-8"
                        placeholder="e.g. 4"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <select
                        value={haccpStatus}
                        onChange={e => setHaccpStatus(e.target.value as "pass" | "fail")}
                        className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      >
                        <option value="pass">✅ Pass</option>
                        <option value="fail">❌ Fail</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Input
                      value={haccpNotes}
                      onChange={e => setHaccpNotes(e.target.value)}
                      className="mt-1 h-8 text-sm"
                      placeholder="e.g. Items checked, packaging intact"
                    />
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 flex items-start gap-1.5">
                <FileText className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                Recipe costs update automatically — stock price changes flow through to recipe GP% instantly.
              </p>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
              )}
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
              <div>
                <p className="font-bold text-slate-900 text-lg">Delivery note applied!</p>
                <p className="text-slate-500 text-sm mt-1">All selected systems have been updated.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 text-sm text-left max-w-xs mx-auto">
                {results?.expense && (
                  <div className="flex items-center gap-2 text-violet-700 bg-violet-50 px-3 py-2 rounded-lg">
                    <BookMarked className="h-4 w-4" /> Expense record created
                  </div>
                )}
                {results?.stock && (
                  <div className="flex items-center gap-2 text-blue-700 bg-blue-50 px-3 py-2 rounded-lg">
                    <Package className="h-4 w-4" /> {results.stock.itemsUpdated} stock item{results.stock.itemsUpdated !== 1 ? "s" : ""} updated
                  </div>
                )}
                {results?.haccp && (
                  <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                    <FlaskConical className="h-4 w-4" /> HACCP delivery record logged
                  </div>
                )}
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  <FlaskConical className="h-4 w-4" /> Recipe GP% auto-updated via stock prices
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 flex-shrink-0">
          {step === "done" ? (
            <Button onClick={handleClose} className="w-full bg-emerald-600 hover:bg-emerald-700">
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  if (step === "review") setStep("upload");
                  else if (step === "options") setStep("review");
                }}
                disabled={step === "upload" || scanning}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>

              {step === "upload" && (
                <Button onClick={() => fileRef.current?.click()} disabled={scanning} className="bg-emerald-600 hover:bg-emerald-700">
                  {scanning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scanning…</> : <><Upload className="h-4 w-4 mr-2" /> Upload Image</>}
                </Button>
              )}
              {step === "review" && (
                <Button onClick={() => setStep("options")} disabled={items.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === "options" && (
                <Button
                  onClick={handleApply}
                  disabled={applying || (!applyBookkeeping && !applyStock && !applyHaccp)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {applying ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Applying…</> : "Apply to all systems"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
