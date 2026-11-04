"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Plus, PhoneCall, Mail, TrendingUp, ShieldCheck } from "lucide-react";
import type { IntelligenceSummary } from "./lead-intelligence-summary";

export type IntelligenceLeadRow = {
  id:string;name:string;website:string|null;country:string;county:string;city:string;address:string;category:string;
  fitScore:number|null;intentScore:number;intentStatus:string;complexityScore:number|null;reachabilityScore:number;
  priorityScore:number;classification:string;ownerName:string|null;decisionMaker:string|null;phone:string|null;
  generalEmail:string|null;managerEmail:string|null;reservationsEmail:string|null;status:string;
  bestContactMethod:string|null;contactedAt:string|null;lastError:string|null;
};
type ListData = {leads:IntelligenceLeadRow[];total:number;page:number;pages:number;counties:string[];config:IntelligenceSummary["config"]};
async function request(url:string,options?:RequestInit) {
  // options.signal lets superseded filter requests be cancelled so stale results never overwrite newer ones.
  const response=await fetch(url,options);const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Request failed");return data;
}

export function IntelligenceTable({leads}:{leads:IntelligenceLeadRow[]}) {
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full whitespace-nowrap text-xs"><caption className="sr-only">Hospitality prospects ranked by priority score</caption>
      <thead className="bg-slate-50 text-left text-slate-500"><tr>{["Business","Fit /100","Intent /100","Complexity /10","Reach /100","Priority /100","Class","Owner / Manager","Phone","Email","Status"].map(h=><th key={h} scope="col" className="px-3 py-3 font-medium">{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{leads.map(l=><tr key={l.id} className="hover:bg-slate-50">
        <td className="px-3 py-3"><Link href={`/admin/lead-intelligence/${l.id}`} className="font-semibold text-emerald-700 underline">{l.name}</Link><p className="mt-1 text-slate-500">{l.city} · {l.country.toUpperCase()}</p>{l.lastError&&<p className="mt-1 text-amber-700">Needs review</p>}</td>
        <td className="px-3 py-3 font-semibold">{l.fitScore??"Unknown"}</td>
        <td className="px-3 py-3">{l.intentStatus==="unknown"?<span className="text-slate-500">Unknown (0 observed)</span>:<>{l.intentScore}<p className="text-slate-500">{l.intentStatus}</p></>}</td>
        <td className="px-3 py-3">{l.complexityScore??"—"}</td><td className="px-3 py-3">{l.reachabilityScore}</td>
        <td className="px-3 py-3 font-semibold text-emerald-700">{l.priorityScore.toFixed(1)}</td><td className="px-3 py-3">{l.classification}</td>
        <td className="max-w-48 truncate px-3 py-3" title={l.decisionMaker??""}>{l.ownerName??l.decisionMaker??"Unknown"}</td>
        <td className="px-3 py-3">{l.phone??"—"}</td><td className="px-3 py-3">{l.managerEmail??l.generalEmail??l.reservationsEmail??"—"}</td>
        <td className="px-3 py-3">{l.status.replace(/_/g," ")}</td>
      </tr>)}</tbody>
    </table>
    {!leads.length&&<p className="p-8 text-center text-sm text-slate-500">No prospects match these filters. Add a business or run configured discovery.</p>}
  </div>;
}

export function LeadIntelligenceTab() {
  const [data,setData]=useState<ListData|null>(null);const [summary,setSummary]=useState<IntelligenceSummary|null>(null);
  const [error,setError]=useState("");const [message,setMessage]=useState("");const [loading,setLoading]=useState(true);const [running,setRunning]=useState(false);
  const [filters,setFilters]=useState({q:"",country:"",county:"",classification:"",fit:"",intent:"",priority:"",intentStatus:"",contacted:"",view:""});
  const [page,setPage]=useState(1);const [adding,setAdding]=useState(false);
  const [newLead,setNewLead]=useState({name:"",website:"",sourceUrl:"",country:"ie",city:"",county:"",category:"hospitality"});
  const load=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError("");
    try {const params=new URLSearchParams({page:String(page),...Object.fromEntries(Object.entries(filters).filter(([,v])=>v!==""))});const [list,s]=await Promise.all([request(`/api/admin/lead-intelligence?${params}`,{signal}),request("/api/admin/lead-intelligence/summary",{signal})]);if(signal?.aborted) return;setData(list);setSummary(s);}
    catch(e){if(e instanceof Error&&e.name==="AbortError") return;setError(e instanceof Error?e.message:"Failed to load");}finally{if(!signal?.aborted) setLoading(false);}
  },[filters,page]);
  useEffect(()=>{
    // Debounce typing in text/number filters; abort superseded requests.
    const controller=new AbortController();
    const timer=setTimeout(()=>{void load(controller.signal);},250);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[load]);
  const change=(key:keyof typeof filters,value:string)=>{setFilters(f=>({...f,[key]:value}));setPage(1);};
  const run=async()=>{
    setRunning(true);setError("");setMessage("");
    try {const result=await request("/api/admin/lead-intelligence/run",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});setMessage(result.skipped?result.reason:`Run ${result.run.status}: ${result.run.discovered} discovered, ${result.run.analysed} analysed. See run history for issues.`);await load();}
    catch(e){setError(e instanceof Error?e.message:"Run failed");}finally{setRunning(false);}
  };
  const add=async(e:React.FormEvent)=>{
    e.preventDefault();setError("");
    try {await request("/api/admin/lead-intelligence",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...newLead,website:newLead.website||null,sourceUrl:newLead.sourceUrl||undefined})});setAdding(false);setMessage("Business saved for qualification. No contact initiated.");await load();}
    catch(e){setError(e instanceof Error?e.message:"Save failed");}
  };
  const configured=data?.config.enabled&&data.config.searchConfigured&&data.config.aiConfigured;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold text-slate-900">Lead Intelligence</h2><p className="mt-1 text-sm text-slate-500">Hospitality fit first. Evidence-backed intent. Drafts only.</p></div><div className="flex gap-2"><button onClick={()=>setAdding(v=>!v)} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><Plus className="h-4 w-4"/>Add business</button><button onClick={run} disabled={!configured||running} className="flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white disabled:opacity-40">{running?<Loader2 className="h-4 w-4 animate-spin"/>:<RefreshCw className="h-4 w-4"/>}{running?"Preparing prospects…":"Run now"}</button></div></header>
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><ShieldCheck className="mr-1 inline h-4 w-4"/>No automatic emails, calls or messages. {data?.config.schedule??"06:00 UTC daily"}. {data&&!configured&&`Run now is off: ${[!data.config.enabled&&(data.config.enabledVarPresent===false?"LEAD_INTELLIGENCE_ENABLED is not set in this deployment":"LEAD_INTELLIGENCE_ENABLED is set but not \"true\""),!data.config.searchConfigured&&"SERPER_API_KEY is missing",!data.config.aiConfigured&&"OPENAI_API_KEY is missing"].filter(Boolean).join("; ")}. Fix it in Vercel (Production) and redeploy.`} Runs are capped at 10 search queries and 6 AI calls.</div>
    {error&&<div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message&&<div role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
    {adding&&<form onSubmit={add} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2"><h3 className="font-semibold sm:col-span-2">Add a business for analysis</h3>{(["name","website","sourceUrl","city","county"] as const).map(key=><label key={key} className="text-xs text-slate-600">{key==="sourceUrl"?"Public source URL (required if no website)":key}<input required={key==="name"||key==="city"} value={newLead[key]} onChange={e=>setNewLead(v=>({...v,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type={key==="website"||key==="sourceUrl"?"url":"text"}/></label>)}<label className="text-xs text-slate-600">Country<select value={newLead.country} onChange={e=>setNewLead(v=>({...v,country:e.target.value}))} className="mt-1 w-full rounded-lg border p-2"><option value="ie">Ireland</option><option value="uk">United Kingdom</option></select></label><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white sm:col-span-2">Save — do not contact</button></form>}
    {summary&&<><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{label:"Hot Prospects",value:summary.hot,view:"hot",icon:TrendingUp},{label:"Recently Qualified",value:summary.recent,view:"recent",icon:ShieldCheck},{label:"Ready To Contact",value:summary.ready,view:"ready",icon:PhoneCall},{label:"Email Drafts Ready",value:summary.draftsReady,view:"drafts",icon:Mail}].map(c=><button key={c.view} onClick={()=>change("view",filters.view===c.view?"":c.view)} className={`rounded-xl border bg-white p-4 text-left ${filters.view===c.view?"border-emerald-500":"border-slate-200"}`}><c.icon className="mb-2 h-4 w-4 text-emerald-700"/><p className="text-xs text-slate-500">{c.label}</p><p className="text-2xl font-bold text-slate-900">{c.value}</p></button>)}</div>
    <section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-semibold text-slate-900">Today&apos;s Lead Summary · {summary.date} UTC</h3><p className="mt-1 text-sm text-slate-600">{summary.newLeads} new leads · {summary.analysed} analysed · {summary.emailDrafts} email drafts generated (cold + follow-up) · {summary.phoneFirst} phone-first opportunities</p><h4 className="mt-3 text-xs font-semibold uppercase text-slate-500">Top 10 prospects</h4><ol className="mt-2 grid gap-2 sm:grid-cols-2">{summary.top10.map((l,i)=><li key={l.id} className="text-sm"><Link href={`/admin/lead-intelligence/${l.id}`} className="text-emerald-700 underline">{i+1}. {l.name}</Link><span className="ml-2 text-xs text-slate-500">Priority {l.priorityScore.toFixed(1)} · {l.bestContactMethod??"contact unknown"}</span></li>)}</ol>{!summary.top10.length&&<p className="mt-2 text-sm text-slate-500">No qualified prospects yet.</p>}</section></>}
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-5">
      <label className="text-xs text-slate-500">Business / town<input value={filters.q} onChange={e=>change("q",e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>
      <label className="text-xs text-slate-500">Country<select value={filters.country} onChange={e=>change("country",e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">All</option><option value="ie">Ireland</option><option value="uk">United Kingdom</option></select></label>
      <label className="text-xs text-slate-500">County<select value={filters.county} onChange={e=>change("county",e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">All</option>{data?.counties.map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="text-xs text-slate-500">Classification<select value={filters.classification} onChange={e=>change("classification",e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">All</option>{["A+","A","B","C","UNQUALIFIED"].map(c=><option key={c}>{c}</option>)}</select></label>
      <label className="text-xs text-slate-500">Contacted<select value={filters.contacted} onChange={e=>change("contacted",e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">All</option><option value="no">Not contacted</option><option value="yes">Contacted</option></select></label>
      {(["fit","intent","priority"] as const).map(k=><label key={k} className="text-xs capitalize text-slate-500">Minimum {k}<input type="number" min="0" max="100" value={filters[k]} onChange={e=>change(k,e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"/></label>)}
      <label className="text-xs text-slate-500">Buying intent status<select value={filters.intentStatus} onChange={e=>change("intentStatus",e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm"><option value="">All</option>{["unknown","Cold","Warm","Interested","Hot"].map(v=><option key={v} value={v}>{v==="unknown"?"Unknown — not Cold":v}</option>)}</select></label>
      <button onClick={()=>{setFilters({q:"",country:"",county:"",classification:"",fit:"",intent:"",priority:"",intentStatus:"",contacted:"",view:""});setPage(1);}} className="self-end rounded-lg border p-2 text-sm">Clear filters</button>
    </div>
    {loading?<p className="p-8 text-center text-sm text-slate-500">Loading prospects…</p>:data&&<IntelligenceTable leads={data.leads}/>}
    {data&&<div className="flex items-center justify-between text-sm text-slate-500"><span>{data.total} prospects · Page {page} of {Math.max(1,data.pages)}</span><div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Previous</button><button disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">Next</button></div></div>}
    {summary&&<section className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-semibold">Recent run history</h3>{!summary.runs.length&&<p className="mt-2 text-sm text-slate-500">No runs recorded. A configured cron entry is not proof of execution.</p>}{summary.runs.map(r=><details key={r.id} className="mt-2 border-t py-2 text-xs text-slate-600"><summary className="cursor-pointer">{new Date(r.startedAt).toLocaleString()} · {r.status} · {r.discovered} new · {r.analysed} analysed · {r.drafts} draft sets · {r.queries} searches · {r.modelCalls} AI calls</summary><pre className="mt-2 whitespace-pre-wrap break-words">{JSON.stringify(r.errors,null,2)}</pre></details>)}</section>}
  </div>;
}