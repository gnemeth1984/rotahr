"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SignalSummary } from "./lead-signal-chips";

export type IntelligenceSummary = {
  date:string;timezone:string;newLeads:number;analysed:number;emailDrafts:number;phoneFirst:number;
  hot:number;recent:number;ready:number;draftsReady:number;
  top10:{id:string;name:string;fitScore:number|null;priorityScore:number;bestContactMethod:string|null;leadScore?:number;grade?:string;signalSummary?:SignalSummary|null}[];
  grades?:Record<string,number>;triggerLeads?:number;sources?:{source:string;lastRunAt:string|null;lastStatus:string;details:unknown}[];
  runs:{id:string;status:string;startedAt:string;discovered:number;analysed:number;drafts:number;queries:number;modelCalls:number;errors:unknown}[];
  config:{enabled:boolean;enabledVarPresent?:boolean;searchConfigured:boolean;aiConfigured:boolean;cronConfigured:boolean;schedule:string;analysisLimit:number};
};
export function LeadIntelligenceSummary() {
  const [data,setData]=useState<IntelligenceSummary|null>(null);
  const [error,setError]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/admin/lead-intelligence/summary",{signal:controller.signal})
      .then(async r=>{const d=await r.json();if(!r.ok) throw new Error(d.error||"Summary unavailable");setData(d);})
      .catch(e=>{if(e.name!=="AbortError") setError(e.message);});
    return ()=>controller.abort();
  },[]);
  if(error) return <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Lead Intelligence: {error}</div>;
  if(!data) return null;
  return <section aria-label="Today's lead summary" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-semibold text-slate-900">Today&apos;s Lead Summary</h2>
      <Link href="/admin?tab=lead-intelligence" className="text-sm font-medium text-emerald-700 underline">Open Lead Intelligence</Link>
    </div>
    <p className="mt-1 text-xs text-slate-500">{data.date} · UTC · {data.config.enabled?"Daily job enabled in configuration":"Daily job disabled"} · Drafts only, no contact automation</p>
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["New leads",data.newLeads],["Leads analysed",data.analysed],["Email drafts",data.emailDrafts],["Phone-first opportunities",data.phoneFirst]].map(([label,value])=><div key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-semibold text-slate-900">{value}</p></div>)}
    </div>
    {data.top10.length>0 && <div className="mt-3 flex flex-wrap gap-2"><span className="text-xs font-medium text-slate-600">Top prospects:</span>{data.top10.slice(0,3).map(l=><Link key={l.id} href={`/admin/lead-intelligence/${l.id}`} className="text-xs text-emerald-800 underline">{l.name} · {l.grade?`${l.grade} ${l.leadScore}`:(l.priorityScore??0).toFixed(1)}</Link>)}</div>}
  </section>;
}