"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MousePointerClick } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Data {
  days: number;
  total: number;
  split: { inlineFeature: number; endFeature: number; endRegister: number };
  features: { slug: string; name: string; count: number }[];
  posts: { slug: string; total: number; register: number; feature: string; featureName: string }[];
}

/** Clicks on the one-feature promo shown in each blog article. */
export function BlogFeatureClicksCard() {
  const [data, setData] = useState<Data | null>(null);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/blog-feature-clicks?days=${d}`);
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

  const max = data ? Math.max(1, ...data.features.map((f) => f.count)) : 1;

  return (
    <Card data-testid="blog-feature-clicks-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-slate-500" /> Blog feature promo clicks
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="ml-auto text-xs font-normal rounded border border-slate-200 px-1.5 py-1 text-slate-600"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </CardTitle>
        <p className="text-xs text-slate-500">
          Each article promotes one feature, mid-article and at the end. Counts clicks only (no
          cookies, bots filtered); sign-ups still show in the funnel above.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {data && (
          <>
            <p className="text-sm text-slate-700" data-testid="blog-feature-clicks-summary">
              <span className="font-semibold">{data.total}</span> click{data.total === 1 ? "" : "s"} in
              the last {data.days} days · mid-article {data.split.inlineFeature} · end-card feature link{" "}
              {data.split.endFeature} · end-card “Try it free” {data.split.endRegister}
            </p>
            {data.features.length === 0 ? (
              <p className="text-xs text-slate-400">No clicks yet.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {data.features.map((f) => (
                    <div key={f.slug} className="flex items-center gap-2 text-xs" data-testid={`bfc-feature-${f.slug}`}>
                      <span className="w-48 shrink-0 text-slate-600">{f.name}</span>
                      <div className="flex-1 h-2 rounded bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${(f.count / max) * 100}%` }} />
                      </div>
                      <span className="w-8 text-right font-semibold text-slate-700">{f.count}</span>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 border-b">
                        <th className="py-1.5 pr-3 font-medium">Article</th>
                        <th className="py-1.5 pr-3 font-medium">Feature</th>
                        <th className="py-1.5 pr-3 font-medium text-right">Clicks</th>
                        <th className="py-1.5 font-medium text-right">Try it free</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.posts.map((p) => (
                        <tr key={p.slug} className="border-b last:border-0" data-testid="bfc-post-row">
                          <td className="py-1.5 pr-3">
                            <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="text-slate-700 hover:underline break-all">
                              {p.slug}
                            </a>
                          </td>
                          <td className="py-1.5 pr-3 whitespace-nowrap text-slate-500">{p.featureName}</td>
                          <td className="py-1.5 pr-3 text-right font-semibold text-slate-700">{p.total}</td>
                          <td className="py-1.5 text-right text-slate-600">{p.register}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
