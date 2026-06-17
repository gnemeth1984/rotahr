// @ts-nocheck
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Users, CalendarCheck, AlertTriangle, CheckCircle2, Brain, ChevronDown, ChevronUp } from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface IntakeResult {
  parsed: {
    customerName: string | null;
    partySize: number | null;
    date: string | null;
    time: string | null;
    occasion: string | null;
    dietary: string | null;
    notes: string | null;
  };
  tableAssignment: {
    tableId: string | null;
    tableName: string | null;
    tableCapacity: number | null;
    assigned: boolean;
    reason: string;
  };
  staffing: {
    shiftsOnDate: number;
    barStaff: number;
    floorStaff: number;
    kitchenStaff: number;
    adequate: boolean;
    warnings: string[];
  };
  kitchenNotes: string;
  upsellSuggestions: string;
  managerSummary: string;
  warnings: string[];
  canCreate: boolean;
}

interface IntakeResponse {
  intake: IntakeResult;
  reservation: any | null;
  autoCreated: boolean;
}

interface StaffingRecommendation {
  hour: number;
  expectedCovers: number;
  kitchenRequired: number;
  floorRequired: number;
  barWarning: boolean;
  kitchenOnShift: number;
  floorOnShift: number;
  barOnShift: number;
  kitchenShortfall: number;
  floorShortfall: number;
  issues: string[];
}

interface ForecastResult {
  date: string;
  recommendations: StaffingRecommendation[];
  summary: string;
}

// ─── Booking Intake Panel ─────────────────────────────────────────────────────

function BookingIntakePanel() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntakeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  async function handleSubmit(autoCreate = false) {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/booking-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, autoCreate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const intake = result?.intake;

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <CardTitle className="text-base">AI Booking Intake</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Paste or type a booking request — AI will parse and pre-fill all details
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={`e.g. "Table for 6 on Friday 20th at 7:30pm, birthday party, one vegan, name is Walsh"`}
          className="min-h-[90px] resize-none text-sm"
        />
        <div className="flex gap-2">
          <Button
            onClick={() => handleSubmit(false)}
            disabled={loading || !message.trim()}
            variant="outline"
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            Parse Only
          </Button>
          <Button
            onClick={() => handleSubmit(true)}
            disabled={loading || !message.trim()}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Parse &amp; Create Booking
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && intake && (
          <div className="space-y-3 mt-2">
            {/* Status banner */}
            {result.autoCreated ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Booking created successfully for <strong>{intake.parsed.customerName ?? "guest"}</strong>
              </div>
            ) : (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
                Parsed — review below and click <strong>Parse &amp; Create Booking</strong> to confirm.
              </div>
            )}

            {/* Parsed fields grid */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Customer" value={intake.parsed.customerName} />
              <Field label="Party size" value={intake.parsed.partySize?.toString()} />
              <Field label="Date" value={intake.parsed.date} />
              <Field label="Time" value={intake.parsed.time ? new Date(intake.parsed.time).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false }) : null} />
              <Field label="Occasion" value={intake.parsed.occasion} />
              <Field label="Dietary" value={intake.parsed.dietary} />
              {intake.parsed.notes && (
                <div className="col-span-2">
                  <Field label="Notes" value={intake.parsed.notes} />
                </div>
              )}
            </div>

            {/* Table assignment */}
            <div className={cn(
              "rounded-lg border p-3 text-sm flex items-start gap-2",
              intake.tableAssignment.assigned
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}>
              <CalendarCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span><strong>Table:</strong> {intake.tableAssignment.reason}</span>
            </div>

            {/* Staffing */}
            <div className={cn(
              "rounded-lg border p-3 text-sm",
              intake.staffing.adequate
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            )}>
              <div className="flex items-center gap-2 font-medium mb-1">
                <Users className="h-4 w-4" />
                Staffing — {intake.staffing.shiftsOnDate} shift{intake.staffing.shiftsOnDate !== 1 ? "s" : ""} on this date
              </div>
              <div className="flex gap-3 text-xs mb-2">
                <span>Kitchen: <strong>{intake.staffing.kitchenStaff}</strong></span>
                <span>Floor: <strong>{intake.staffing.floorStaff}</strong></span>
                <span>Bar: <strong>{intake.staffing.barStaff}</strong></span>
              </div>
              {intake.staffing.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  {w}
                </div>
              ))}
            </div>

            {/* Kitchen notes */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs font-medium text-slate-500 mb-1">Kitchen Notes</p>
              <p className="text-slate-700">{intake.kitchenNotes}</p>
            </div>

            {/* Upsells */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <p className="text-xs font-medium text-slate-500 mb-1">Upsell Suggestions</p>
              <p className="text-slate-700">{intake.upsellSuggestions}</p>
            </div>

            {/* Warnings */}
            {intake.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-800 mb-1">Warnings</p>
                {intake.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {/* Manager summary toggle */}
            <button
              onClick={() => setShowSummary((v) => !v)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
            >
              {showSummary ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showSummary ? "Hide" : "Show"} manager summary
            </button>
            {showSummary && (
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-3 whitespace-pre-wrap font-mono text-slate-600">
                {intake.managerSummary}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <p className={cn("font-medium", value ? "text-slate-900" : "text-slate-400 italic")}>
        {value ?? "Not detected"}
      </p>
    </div>
  );
}

// ─── Staffing Forecast Panel ──────────────────────────────────────────────────

function StaffingForecastPanel() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setForecast(null);
    try {
      const res = await fetch(`/api/ai/staffing-forecast?date=${date}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setForecast(data.forecast);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const hasIssues = forecast?.recommendations.some((r) => r.issues.length > 0);

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">AI Staffing Forecast</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Compare reservations vs scheduled staff for any date
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44 text-sm"
          />
          <Button onClick={handleFetch} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate Forecast
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {forecast && (
          <div className="space-y-3">
            {/* Summary */}
            <div className={cn(
              "rounded-lg border p-3 text-sm flex items-start gap-2",
              hasIssues
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-green-200 bg-green-50 text-green-800"
            )}>
              {hasIssues
                ? <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                : <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
              }
              {forecast.summary}
            </div>

            {/* Hourly breakdown */}
            {forecast.recommendations.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No reservations found for this date — nothing to forecast.</p>
            ) : (
              <div className="space-y-2">
                {forecast.recommendations.map((rec) => (
                  <div
                    key={rec.hour}
                    className={cn(
                      "rounded-lg border p-3 text-sm",
                      rec.issues.length > 0
                        ? "border-amber-200 bg-amber-50"
                        : "border-green-200 bg-green-50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800">
                        {String(rec.hour).padStart(2, "0")}:00
                      </span>
                      <Badge variant={rec.issues.length > 0 ? "warning" : "success"} className="text-xs">
                        {rec.expectedCovers} covers
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-slate-600 mb-2">
                      <StaffCell label="Kitchen" onShift={rec.kitchenOnShift} required={rec.kitchenRequired} shortfall={rec.kitchenShortfall} />
                      <StaffCell label="Floor" onShift={rec.floorOnShift} required={rec.floorRequired} shortfall={rec.floorShortfall} />
                      <StaffCell label="Bar" onShift={rec.barOnShift} required={1} shortfall={rec.barWarning ? 1 : 0} />
                    </div>
                    {rec.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 mt-1">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        {issue}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StaffCell({
  label,
  onShift,
  required,
  shortfall,
}: {
  label: string;
  onShift: number;
  required: number;
  shortfall: number;
}) {
  return (
    <div className={cn(
      "rounded px-2 py-1 text-center",
      shortfall > 0 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
    )}>
      <div className="font-medium">{label}</div>
      <div>{onShift} / {required}</div>
      {shortfall > 0 && <div className="text-[10px]">-{shortfall}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIPage() {
  const { data: session } = useSession();
  const isManager =
    session?.user?.role === Role.MANAGER ||
    session?.user?.role === Role.ADMIN;

  if (!isManager) {
    return (
      <div className="p-8 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Brain className="h-6 w-6 text-slate-400" />
        </div>
        <p className="text-slate-600">AI tools are available to managers only.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Brain className="h-6 w-6 text-violet-600" />
          AI Assistant
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Rule-based AI tools for booking intake and staffing analysis
        </p>
      </div>

      <BookingIntakePanel />
      <StaffingForecastPanel />
    </div>
  );
}
