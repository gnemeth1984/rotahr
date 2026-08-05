"use client";

/**
 * Cold outreach control panel.
 *
 * Deliberately built so the destructive action is hard to reach by accident:
 * every batch starts as a dry run that lists the exact recipients and subject
 * lines, and only that reviewed list can then be sent. These are emails to
 * people who never asked for them — one careless click damages the sending
 * domain for every future campaign.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Send,
  Eye,
  MousePointerClick,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Users,
  Ban,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  total: number;
  new_count: number;
  contacted: number;
  followup1: number;
  followup2: number;
  followup3: number;
  replied: number;
  cold: number;
  unsubscribed: number;
  bounced: number;
  sentToday: number;
  dailyLimit: number;
  byCountry: { country: string; cnt: number }[];
  bySegment: { segment: string; cnt: number }[];
  totalSends: number;
  opened: number;
  clicked: number;
  failed: number;
  openRate: number;
  clickRate: number;
  suppressed: number;
  brevoConfigured: boolean;
  fromEmail: string;
  domainAuthenticated: boolean;
  domainMissingRecords: { host: string; type: string; value: string }[];
  domainError?: string;
}

interface Outcome {
  email: string;
  step: string;
  sent: boolean;
  subject?: string;
  reason?: string;
}

interface BatchResult {
  dryRun: boolean;
  sent: number;
  skipped: number;
  attempted: number;
  dailyLimit: number;
  sentToday: number;
  reason?: string;
  outcomes: Outcome[];
}

interface SendRow {
  id: string;
  email: string;
  segment: string | null;
  step: string;
  subject: string;
  sent_at: string;
  opened: boolean;
  clicked: boolean;
  failedReason: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STEP_LABEL: Record<string, string> = {
  new: "1 · Intro",
  contacted: "2 · Follow-up",
  followup_1: "3 · Follow-up",
  followup_2: "4 · Follow-up",
  followup_3: "5 · Final",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "slate" | "emerald" | "amber" | "red";
}) {
  const toneClass = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OutreachTab() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sends, setSends] = useState<SendRow[]>([]);

  const [country, setCountry] = useState("all");
  const [segment, setSegment] = useState("all");
  const [limit, setLimit] = useState(10);

  const [preview, setPreview] = useState<BatchResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([
        fetch("/api/outreach/stats").then((r) => r.json()),
        fetch("/api/outreach/sends?limit=50").then((r) => r.json()),
      ]);
      if (!s.error) setStats(s);
      if (Array.isArray(h.sends)) setSends(h.sends);
    } catch {
      setError("Could not load outreach stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBatch(confirm: boolean) {
    setError(null);
    if (confirm) setSending(true);
    else {
      setPreviewing(true);
      setResult(null);
    }

    try {
      const res = await fetch("/api/outreach/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, segment, limit, confirm }),
      });
      const data = (await res.json()) as BatchResult & { error?: string };
      if (data.error) {
        setError(data.error);
        return;
      }
      if (confirm) {
        setResult(data);
        setPreview(null);
        void load();
      } else {
        setPreview(data);
      }
    } catch {
      setError("Request failed");
    } finally {
      setPreviewing(false);
      setSending(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch("/api/outreach/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      setTestMsg(
        data.sent
          ? `Sent to ${data.email} — "${data.subject}"`
          : `Not sent: ${data.reason || data.error || "unknown error"}`
      );
    } catch {
      setTestMsg("Request failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-16 justify-center text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading outreach…
      </div>
    );
  }

  const capReached = stats ? stats.sentToday >= stats.dailyLimit : false;
  const domainBad = Boolean(stats?.brevoConfigured && !stats.domainAuthenticated);
  const canSend = Boolean(stats?.brevoConfigured) && !capReached && !domainBad;

  return (
    <div className="space-y-5">
      {/* Blocking warning: nothing can send without the key */}
      {stats && !stats.brevoConfigured && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Brevo is not configured</p>
            <p className="mt-0.5 text-amber-700">
              Add <code className="rounded bg-amber-100 px-1">BREVO_API_KEY</code> to the Vercel
              environment. Previews work without it; nothing can actually send.
            </p>
          </div>
        </div>
      )}

      {/* Unauthenticated sending domain — the batch is blocked until this is fixed */}
      {domainBad && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {stats?.domainError
              ? `Could not verify ${stats?.fromEmail?.split("@")[1]} at Brevo`
              : `${stats?.fromEmail?.split("@")[1]} is not authenticated at Brevo`}
          </p>
          <p className="mt-1 text-red-700">
            {stats?.domainError ??
              `Brevo accepts these sends and returns success, but the mail goes out unsigned
               and lands in spam. Sending would also damage the reputation of the domain that
               sends every customer their booking confirmations, so real batches are blocked
               until the DNS records below are live.`}
          </p>
          {!!stats?.domainMissingRecords?.length && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-red-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-red-100/60 uppercase tracking-wide text-red-700">
                  <tr>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Host</th>
                    <th className="px-3 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.domainMissingRecords.map((r) => (
                    <tr key={`${r.type}-${r.host}`} className="border-t border-red-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{r.type}</td>
                      <td className="px-3 py-2 font-mono text-slate-700">{r.host}</td>
                      <td className="px-3 py-2 font-mono break-all text-slate-600">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-red-700">
            Add these at your DNS provider, then hit Verify in Brevo. Previews and single test
            sends still work in the meantime.
          </p>
        </div>
      )}

      {/* Lead funnel */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total leads"
          value={stats?.total ?? "—"}
          sub={`${stats?.new_count ?? 0} never contacted`}
        />
        <StatCard
          label="Sent today"
          value={`${stats?.sentToday ?? 0} / ${stats?.dailyLimit ?? 0}`}
          sub={capReached ? "Daily cap reached" : "Cap resets at midnight Dublin"}
          tone={capReached ? "amber" : "slate"}
        />
        <StatCard
          label="Open rate"
          value={`${stats?.openRate ?? 0}%`}
          sub={`${stats?.opened ?? 0} of ${stats?.totalSends ?? 0} sends`}
          tone="emerald"
        />
        <StatCard
          label="Click rate"
          value={`${stats?.clickRate ?? 0}%`}
          sub={`${stats?.clicked ?? 0} clicks`}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="In sequence" value={
          (stats?.contacted ?? 0) +
          (stats?.followup1 ?? 0) +
          (stats?.followup2 ?? 0) +
          (stats?.followup3 ?? 0)
        } sub="Awaiting next step" />
        <StatCard label="Replied" value={stats?.replied ?? 0} tone="emerald" />
        <StatCard label="Bounced" value={stats?.bounced ?? 0} tone="red" sub={`${stats?.failed ?? 0} failed sends`} />
        <StatCard label="Unsubscribed" value={stats?.suppressed ?? 0} sub="Suppression list" />
      </div>

      {/* Batch runner */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <Send className="h-4 w-4 text-emerald-600" /> Run a batch
          </h3>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Country</span>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPreview(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All countries</option>
              {stats?.byCountry.map((c) => (
                <option key={c.country} value={c.country}>
                  {c.country.toUpperCase()} ({c.cnt})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Segment</span>
            <select
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value);
                setPreview(null);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">All segments</option>
              {stats?.bySegment.map((s) => (
                <option key={s.segment} value={s.segment}>
                  {s.segment} ({s.cnt})
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">How many</span>
            <Input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPreview(null);
              }}
            />
          </label>

          <div className="flex items-end">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => void runBatch(false)}
              disabled={previewing}
            >
              {previewing ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Eye className="mr-1.5 h-4 w-4" />
              )}
              Preview
            </Button>
          </div>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
            <XCircle className="h-4 w-4" /> {error}
          </p>
        )}

        {/* Dry-run preview — the only route to a real send */}
        {preview && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">
              {preview.outcomes.length
                ? `${preview.outcomes.length} lead${preview.outcomes.length === 1 ? "" : "s"} would be emailed`
                : "Nothing to send"}
              {preview.reason && !preview.outcomes.length && (
                <span className="font-normal text-slate-500"> — {preview.reason}</span>
              )}
            </p>

            {preview.outcomes.length > 0 && (
              <>
                <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Recipient</th>
                        <th className="px-3 py-2">Step</th>
                        <th className="px-3 py-2">Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.outcomes.map((o) => (
                        <tr key={o.email} className="border-t border-slate-100">
                          <td className="px-3 py-2">
                            {o.email}
                            {o.reason?.startsWith("would skip") && (
                              <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                                <Ban className="h-3 w-3" /> skip
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                            {STEP_LABEL[o.step] ?? o.step}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{o.subject}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => void runBatch(true)}
                    disabled={sending || !canSend}
                  >
                    {sending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" />
                    )}
                    Send these {preview.outcomes.length} for real
                  </Button>
                  <Button variant="ghost" onClick={() => setPreview(null)}>
                    Cancel
                  </Button>
                  {capReached && (
                    <span className="text-xs text-amber-700">Daily cap reached — try tomorrow.</span>
                  )}
                  {domainBad && !capReached && (
                    <span className="text-xs text-red-700">
                      Blocked until the sending domain is authenticated.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="flex items-center gap-1.5 font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" /> Sent {result.sent} of {result.attempted}
              {result.skipped > 0 && ` · ${result.skipped} skipped`}
            </p>
            {result.reason && <p className="mt-1 text-emerald-700">{result.reason}</p>}
            {result.outcomes.some((o) => !o.sent) && (
              <ul className="mt-2 space-y-0.5 text-emerald-900/80">
                {result.outcomes
                  .filter((o) => !o.sent)
                  .map((o) => (
                    <li key={o.email}>
                      {o.email} — {o.reason}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Single test send */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
          <Mail className="h-4 w-4 text-emerald-600" /> Test send
        </h3>
        <p className="mb-3 text-sm text-slate-500">
          Sends the intro email to one address you name. Never touches the lead list and is not
          recorded as outreach.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            onClick={() => void sendTest()}
            disabled={testing || !testTo.includes("@")}
          >
            {testing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Send test
          </Button>
        </div>
        {testMsg && <p className="mt-2 text-sm text-slate-600">{testMsg}</p>}
      </div>

      {/* Send history */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Users className="h-4 w-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">Recent sends</h3>
          <span className="text-xs text-slate-500">({stats?.totalSends ?? 0} total)</span>
        </div>

        {sends.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            Nothing sent yet. Preview a batch above to see who is next in line.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Recipient</th>
                  <th className="px-4 py-2">Step</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Sent</th>
                  <th className="px-4 py-2">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {sends.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{s.email}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                      {STEP_LABEL[s.step] ?? s.step}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2 text-slate-600">{s.subject}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                      {fmtDateTime(s.sent_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      {s.failedReason ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          <XCircle className="h-3 w-3" /> failed
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              s.opened ? "text-emerald-700" : "text-slate-400"
                            }`}
                          >
                            <Eye className="h-3 w-3" /> {s.opened ? "opened" : "—"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 ${
                              s.clicked ? "text-emerald-700" : "text-slate-400"
                            }`}
                          >
                            <MousePointerClick className="h-3 w-3" /> {s.clicked ? "clicked" : "—"}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
