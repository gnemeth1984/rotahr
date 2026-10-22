"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActiveVenueId } from "@/components/shared/VenueSwitcher";
import { cn } from "@/lib/utils";
import {
  Loader2,
  RefreshCw,
  Gauge,
  ShieldCheck,
  TrendingDown,
  Trash2,
  CalendarDays,
  UserX,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Send,
  Utensils,
  ArrowRight,
} from "lucide-react";

type Severity = "high" | "medium" | "low";
type AgentKey = "compliance" | "margin" | "waste" | "bookings" | "noshow";
type Status = "ok" | "watch" | "act" | "unavailable";

interface Finding {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  href?: string;
  subjects?: { type: string; id?: string; label: string }[];
  draft?: { kind: string; label: string; text: string };
  agent?: AgentKey;
}

interface AgentResult {
  agent: AgentKey;
  label: string;
  status: Status;
  headline: string;
  businessWide?: boolean;
  findings: Finding[];
  metrics: Record<string, number | string | null>;
  table?: { columns: string[]; rows: (string | number | null)[][] };
  error?: string;
}

interface Brief {
  businessName: string;
  venueId: string | null;
  venueName: string | null;
  date: string;
  timezone: string;
  generatedAt: string;
  cached: boolean;
  summary: string;
  summarySource: "rules" | "llm";
  priorities: Finding[];
  tonight: {
    bookings: number;
    covers: number;
    firstSitting: string | null;
    lastSitting: string | null;
    busiestHour: string | null;
    allergyTables: number;
    dietaryTables: number;
    occasions: number;
    vips: number;
    items: Finding[];
  };
  agents: AgentResult[];
}

interface AskResult {
  answer: string;
  source: "rules" | "llm";
  agents: AgentKey[];
  findings: Finding[];
}

const AGENT_ICON: Record<AgentKey, typeof Gauge> = {
  compliance: ShieldCheck,
  margin: TrendingDown,
  waste: Trash2,
  bookings: CalendarDays,
  noshow: UserX,
};

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  act: { label: "Act today", cls: "bg-red-100 text-red-700 border-red-200" },
  watch: { label: "Watch", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  ok: { label: "All good", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  unavailable: { label: "Unavailable", cls: "bg-slate-100 text-slate-500 border-slate-200" },
};

const SEV_DOT: Record<Severity, string> = { high: "bg-red-500", medium: "bg-amber-500", low: "bg-slate-300" };

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {done ? "Copied" : "Copy"}
    </Button>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(f.subjects?.length || f.draft || f.detail);
  return (
    <li className="py-2" data-testid="finding">
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 flex-shrink-0 rounded-full", SEV_DOT[f.severity])} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="flex w-full items-start gap-1 text-left text-sm text-slate-800"
            onClick={() => expandable && setOpen((o) => !o)}
          >
            <span className="flex-1">{f.title}</span>
            {expandable &&
              (open ? <ChevronDown className="mt-0.5 h-4 w-4 text-slate-400" /> : <ChevronRight className="mt-0.5 h-4 w-4 text-slate-400" />)}
          </button>
          {open && (
            <div className="mt-2 space-y-2">
              {f.detail && <p className="text-xs text-slate-500">{f.detail}</p>}
              {f.subjects && f.subjects.length > 0 && (
                <ul className="space-y-0.5 text-xs text-slate-600">
                  {f.subjects.slice(0, 20).map((s, i) => (
                    <li key={(s.id ?? "") + i} className="truncate">
                      · {s.label}
                    </li>
                  ))}
                  {f.subjects.length > 20 && <li className="text-slate-400">…and {f.subjects.length - 20} more</li>}
                </ul>
              )}
              {f.draft && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">{f.draft.label}</span>
                    <CopyButton text={f.draft.text} />
                  </div>
                  <p className="whitespace-pre-wrap text-xs text-slate-700">{f.draft.text}</p>
                </div>
              )}
              {f.href && (
                <Link href={f.href} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline">
                  Open <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function AgentCard({ a, children }: { a: AgentResult; children?: React.ReactNode }) {
  const Icon = AGENT_ICON[a.agent] ?? Gauge;
  const st = STATUS_STYLE[a.status];
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? a.findings : a.findings.slice(0, 5);
  return (
    <Card data-testid={`agent-${a.agent}`} className="min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-slate-500" />
            {a.label}
          </CardTitle>
          <Badge variant="outline" className={st.cls}>
            {st.label}
          </Badge>
        </div>
        <p className="text-sm text-slate-600">{a.headline}</p>
        {a.businessWide && <p className="text-xs text-slate-400">Covers the whole business, not just this venue.</p>}
        {a.error && <p className="text-xs text-red-500">{a.error}</p>}
      </CardHeader>
      <CardContent className="pt-0">
        {shown.length > 0 && <ul className="divide-y divide-slate-100">{shown.map((f) => <FindingRow key={f.id} f={f} />)}</ul>}
        {a.findings.length > 5 && (
          <button type="button" className="mt-1 text-xs text-blue-600 hover:underline" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Show fewer" : `Show all ${a.findings.length}`}
          </button>
        )}
        {a.table && a.table.rows.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  {a.table.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap py-1 pr-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.table.rows.map((r, i) => (
                  <tr key={i} className="border-t border-slate-100 text-slate-700">
                    {r.map((c, j) => (
                      <td key={j} className="whitespace-nowrap py-1 pr-3">
                        {c ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

function TargetGp({ canEdit }: { canEdit: boolean }) {
  const [value, setValue] = useState<string>("");
  const [saved, setSaved] = useState<string>("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/copilot/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.targetGpPct != null) {
          setValue(String(d.targetGpPct));
          setSaved(String(d.targetGpPct));
        }
      })
      .catch(() => {});
  }, []);
  if (!saved) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
      <span>Target GP</span>
      <Input
        type="number"
        min={1}
        max={99}
        step={0.5}
        value={value}
        disabled={!canEdit}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-20 text-xs"
        aria-label="Target GP percent"
      />
      <span>%</span>
      {canEdit && value !== saved && (
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={async () => {
            setMsg(null);
            const r = await fetch("/api/copilot/settings", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ targetGpPct: Number(value) }),
            });
            const d = await r.json().catch(() => ({}));
            if (r.ok) {
              setSaved(String(d.targetGpPct));
              setMsg("Saved — refresh the brief to re-check margins.");
            } else setMsg(d.error ?? "Couldn't save");
          }}
        >
          Save
        </Button>
      )}
      {msg && <span className="text-slate-500">{msg}</span>}
    </div>
  );
}

export default function CopilotPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isManager = role === "ADMIN" || role === "MANAGER";

  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [venueId, setVenueId] = useState<string | null | undefined>(undefined);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [askError, setAskError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/venues")
      .then((r) => (r.ok ? r.json() : { venues: [] }))
      .then((d) => {
        const v = (d.venues ?? []) as { id: string; name: string }[];
        setVenues(v);
        const active = getActiveVenueId();
        setVenueId(v.length > 1 && active && v.some((x) => x.id === active) ? active : null);
      })
      .catch(() => setVenueId(null));
  }, []);

  const load = useCallback(
    async (refresh = false) => {
      if (venueId === undefined) return;
      setLoading(true);
      setError(null);
      const qs = new URLSearchParams();
      if (venueId) qs.set("venueId", venueId);
      if (refresh) qs.set("refresh", "1");
      try {
        const r = await fetch(`/api/copilot/brief?${qs}`);
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Couldn't load the brief");
        setBrief(d);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [venueId],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  async function submitAsk(e: React.FormEvent) {
    e.preventDefault();
    if (question.trim().length < 2) return;
    setAsking(true);
    setAskError(null);
    try {
      const r = await fetch("/api/copilot/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, venueId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Couldn't answer that");
      setAnswer(d);
    } catch (e) {
      setAskError((e as Error).message);
    } finally {
      setAsking(false);
    }
  }

  const byKey = (k: AgentKey) => brief?.agents.find((a) => a.agent === k);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Gauge className="h-5 w-5 text-blue-600" /> Manager Copilot
          </h1>
          <p className="text-sm text-slate-500">
            {brief
              ? `${new Date(brief.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · ${brief.venueName ?? "All venues"}`
              : "Your daily operations brief"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {venues.length > 1 && (
            <select
              aria-label="Venue"
              data-testid="venue-select"
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm"
              value={venueId ?? ""}
              onChange={(e) => {
                setVenueId(e.target.value || null);
                setAnswer(null);
              }}
            >
              <option value="">All venues</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading} className="gap-1">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        </div>
      </div>

      {error && <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>}

      {loading && !brief ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : brief ? (
        <>
          <Card data-testid="brief-summary">
            <CardContent className="space-y-3 p-5">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-800">{brief.summary}</p>
              <p className="text-xs text-slate-400">
                {brief.summarySource === "llm" ? "Worded by AI from the checks below · " : ""}
                Updated {new Date(brief.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                {brief.cached ? " (cached)" : ""} · Suggestions only — nothing is changed or sent automatically.
              </p>
            </CardContent>
          </Card>

          {brief.priorities.length > 0 && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-base">Today&apos;s priorities</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="divide-y divide-slate-100">
                  {brief.priorities.map((f) => (
                    <FindingRow key={`${f.agent}-${f.id}`} f={f} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card data-testid="tonight">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Utensils className="h-4 w-4 text-slate-500" /> Tonight
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["Covers", brief.tonight.covers],
                  ["Bookings", brief.tonight.bookings],
                  ["Busiest", brief.tonight.busiestHour ?? "—"],
                  ["Allergies", brief.tonight.allergyTables],
                  ["Occasions / VIPs", `${brief.tonight.occasions} / ${brief.tonight.vips}`],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-md bg-slate-50 p-2">
                    <div className="text-xs text-slate-500">{k}</div>
                    <div className="text-lg font-semibold text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
              {brief.tonight.items.length > 0 && (
                <ul className="mt-3 divide-y divide-slate-100">
                  {brief.tonight.items.map((f) => (
                    <FindingRow key={f.id} f={f} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <form onSubmit={submitAsk} className="flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={500}
                  placeholder="Ask: Are we short-staffed this weekend? Which dishes lost margin? Who might not show tonight?"
                  aria-label="Ask the Copilot"
                />
                <Button type="submit" disabled={asking || question.trim().length < 2} className="gap-1">
                  {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ask
                </Button>
              </form>
              {askError && <p className="mt-2 text-sm text-red-600">{askError}</p>}
              {answer && (
                <div className="mt-3 space-y-2" data-testid="ask-answer">
                  <p className="whitespace-pre-line text-sm text-slate-800">{answer.answer}</p>
                  {answer.findings.length > 0 && (
                    <ul className="divide-y divide-slate-100 border-t border-slate-100">
                      {answer.findings.map((f) => (
                        <FindingRow key={`${f.agent}-${f.id}`} f={f} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {(["compliance", "bookings", "noshow", "margin", "waste"] as AgentKey[]).map((k) => {
              const a = byKey(k);
              if (!a) return null;
              return (
                <AgentCard key={k} a={a}>
                  {k === "margin" && <TargetGp canEdit={isManager} />}
                </AgentCard>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
