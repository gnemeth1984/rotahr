"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquareQuote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Item {
  id: string;
  email: string;
  reason: string;
  reasonLabel: string;
  comment: string | null;
  createdAt: string;
  source: "account" | "template" | "other";
}

interface Data {
  days: number;
  total: number;
  unsubscribes: number | null;
  reasons: { id: string; label: string; count: number }[];
  recent: Item[];
}

const SOURCE_LABEL: Record<Item["source"], string> = {
  account: "Rotahr account",
  template: "Template download",
  other: "Outreach / other",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
}

/** Why people unsubscribed — answers from the optional question on /unsubscribe. */
export function UnsubscribeFeedbackCard() {
  const [data, setData] = useState<Data | null>(null);
  const [days, setDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/unsubscribe-feedback?days=${d}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [load, days]);

  const max = data ? Math.max(1, ...data.reasons.map((r) => r.count)) : 1;

  return (
    <Card data-testid="unsub-feedback-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquareQuote className="h-4 w-4 text-slate-500" /> Why people unsubscribe
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="ml-auto text-xs font-normal rounded border border-slate-200 px-1.5 py-1 text-slate-600"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </select>
        </CardTitle>
        <p className="text-xs text-slate-500">
          Optional question shown after someone unsubscribes on /unsubscribe. Gmail/Outlook one-click
          unsubscribes never see it, so this is a sample, not everyone.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && (
          <>
            <p className="text-sm text-slate-700" data-testid="unsub-feedback-summary">
              <span className="font-semibold">{data.total}</span> answer{data.total === 1 ? "" : "s"}
              {data.unsubscribes !== null && (
                <>
                  {" "}
                  from <span className="font-semibold">{data.unsubscribes}</span> unsubscribe
                  {data.unsubscribes === 1 ? "" : "s"}
                </>
              )}{" "}
              in the last {data.days} days.
            </p>
            <div className="space-y-1.5">
              {data.reasons.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs" data-testid={`unsub-count-${r.id}`}>
                  <span className="w-56 shrink-0 text-slate-600">{r.label}</span>
                  <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                    <div className="h-full bg-orange-400" style={{ width: `${(r.count / max) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right font-semibold text-slate-700">{r.count}</span>
                </div>
              ))}
            </div>
            {data.recent.length === 0 ? (
              <p className="text-xs text-slate-400">No answers yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-400 border-b">
                      <th className="py-1.5 pr-3 font-medium">When</th>
                      <th className="py-1.5 pr-3 font-medium">Email</th>
                      <th className="py-1.5 pr-3 font-medium">From</th>
                      <th className="py-1.5 pr-3 font-medium">Reason</th>
                      <th className="py-1.5 font-medium">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((i) => (
                      <tr key={i.id} className="border-b last:border-0 align-top" data-testid="unsub-feedback-row">
                        <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{fmt(i.createdAt)}</td>
                        <td className="py-1.5 pr-3 break-all text-slate-700">{i.email}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{SOURCE_LABEL[i.source]}</td>
                        <td className="py-1.5 pr-3 whitespace-nowrap text-slate-700">{i.reasonLabel}</td>
                        <td className="py-1.5 text-slate-600">{i.comment ?? <span className="text-slate-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
