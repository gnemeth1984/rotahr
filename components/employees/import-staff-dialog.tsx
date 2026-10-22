"use client";

import { useRef, useState } from "react";
import { Upload, Download, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { STAFF_CSV_TEMPLATE } from "@/lib/activation/staff-csv";

type Status = "ready" | "exists" | "invalid" | "over_cap" | "created" | "failed";

interface ImportRow {
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  hourlyRate?: number;
  department?: string;
  status: Status;
  message: string;
}

interface ImportResult {
  dryRun: boolean;
  summary: Record<Status, number>;
  newDepartments: string[];
  fileErrors: string[];
  rows: ImportRow[];
}

const STATUS_LABEL: Record<Status, { text: string; cls: string }> = {
  ready: { text: "Ready", cls: "bg-emerald-50 text-emerald-700" },
  created: { text: "Added", cls: "bg-emerald-100 text-emerald-800" },
  exists: { text: "Skipped", cls: "bg-slate-100 text-slate-600" },
  invalid: { text: "Fix", cls: "bg-red-50 text-red-700" },
  over_cap: { text: "Over limit", cls: "bg-amber-50 text-amber-700" },
  failed: { text: "Failed", cls: "bg-red-50 text-red-700" },
};

export function ImportStaffDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setCsv("");
    setFileName(null);
    setError("");
    setResult(null);
  }

  async function submit(dryRun: boolean) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/employee/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv, dryRun }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Import failed");
        setResult(null);
        return;
      }
      setResult(j);
      if (!dryRun && j.summary?.created > 0) onImported();
    } catch {
      setError("Network error — nothing was imported.");
    } finally {
      setBusy(false);
    }
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  function downloadTemplate() {
    const blob = new Blob([STAFF_CSV_TEMPLATE], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rotahr-staff-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const done = result && !result.dryRun;
  const ready = result?.dryRun ? result.summary.ready : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-dialog">
        <DialogHeader>
          <DialogTitle>Import staff from a spreadsheet</DialogTitle>
          <DialogDescription>
            Upload a CSV or paste rows from Excel or Google Sheets. You&apos;ll see a preview before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {!done && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,.txt"
                className="hidden"
                data-testid="import-file"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> Choose CSV file
              </Button>
              <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Download template
              </Button>
              {fileName && <span className="text-xs text-slate-500 truncate max-w-[200px]">{fileName}</span>}
            </div>
            <Textarea
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setResult(null);
              }}
              placeholder={"First name,Last name,Email,Role,Hourly rate\nAoife,Byrne,aoife@yourvenue.ie,Server,13.50"}
              className="font-mono text-xs h-36"
              data-testid="import-text"
            />
            <p className="text-xs text-slate-500">
              Needs a name and an email per person. Phone, role, hourly rate and department are optional. Headers are
              matched loosely, so most payroll exports work as they are.
            </p>
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
              <strong>Data notice:</strong> names, contact details, role and pay are stored for HR and payroll purposes
              (GDPR Art.6(1)(b)&amp;(c)). Make sure your staff know their details are held in Rotahr — see the{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</a>.
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2" data-testid="import-error">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-3" data-testid="import-result">
            <div className="flex flex-wrap gap-2 text-xs">
              {(Object.keys(result.summary) as Status[])
                .filter((k) => result.summary[k] > 0)
                .map((k) => (
                  <span key={k} className={`px-2 py-1 rounded-full font-medium ${STATUS_LABEL[k].cls}`}>
                    {STATUS_LABEL[k].text}: {result.summary[k]}
                  </span>
                ))}
            </div>
            {result.fileErrors.map((e) => (
              <p key={e} className="text-xs text-amber-700 flex gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {e}
              </p>
            ))}
            {result.dryRun && result.newDepartments.length > 0 && (
              <p className="text-xs text-slate-600 flex gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /> New departments will be created:{" "}
                {result.newDepartments.join(", ")}
              </p>
            )}
            <div className="border rounded-lg overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium">Line</th>
                    <th className="text-left px-2 py-1.5 font-medium">Name</th>
                    <th className="text-left px-2 py-1.5 font-medium">Email</th>
                    <th className="text-left px-2 py-1.5 font-medium">Role</th>
                    <th className="text-left px-2 py-1.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r) => (
                    <tr key={r.line} className="border-t border-slate-100" data-testid="import-row">
                      <td className="px-2 py-1.5 text-slate-400">{r.line}</td>
                      <td className="px-2 py-1.5 text-slate-800 whitespace-nowrap">
                        {r.firstName} {r.lastName !== "." ? r.lastName : ""}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 break-all">{r.email}</td>
                      <td className="px-2 py-1.5 text-slate-600">{r.role}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_LABEL[r.status].cls}`}>
                          {STATUS_LABEL[r.status].text}
                        </span>
                        {r.message && <span className="block text-[11px] text-slate-500 mt-0.5">{r.message}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {done && (
              <p className="text-sm text-emerald-700 flex items-center gap-1.5" data-testid="import-done">
                <CheckCircle2 className="h-4 w-4" /> {result.summary.created} added. No invites have been sent — invite
                them from the setup checklist or the employee list when you&apos;re ready.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {done ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {result?.dryRun && ready > 0 ? (
                <Button onClick={() => submit(false)} disabled={busy} data-testid="import-confirm">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add {ready} {ready === 1 ? "person" : "people"}
                </Button>
              ) : (
                <Button onClick={() => submit(true)} disabled={busy || !csv.trim()} data-testid="import-preview">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Preview
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
