"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Extraction, SourceDocument } from "@/lib/lead-intelligence/types";
import type { scoreLead } from "@/lib/lead-intelligence/scoring";
import { LEAD_STATUSES } from "@/lib/lead-intelligence/types";
import type { IntelligenceLeadRow } from "./lead-intelligence-tab";

type Analysis = {id:string;createdAt:string;modelVersion:string;facts:Extraction;scores:ReturnType<typeof scoreLead>;sources:SourceDocument[];reasoning:string[];emailSubject:string|null;emailBody:string|null;followupSubject:string|null;followupBody:string|null;phoneOpener:string|null};
type LeadDetail = IntelligenceLeadRow & {facebook:string|null;instagram:string|null;linkedin:string|null;contactForm:string|null;contactReason:string|null;analysedAt:string|null;notes:string|null;analyses:Analysis[]};

/** Only public http(s) URLs become links; anything else (internal refs, malformed values) renders as text. */
function SourceLink({href,className="break-all text-xs text-emerald-700 underline"}:{href:string;className?:string}) {
  let safe=false; try { safe=["http:","https:"].includes(new URL(href).protocol); } catch { safe=false; }
  return safe?<a href={href} target="_blank" rel="noopener noreferrer nofollow" className={className}>{href}</a>:<span className="break-all text-xs text-slate-500">{href}</span>;
}

export function AnalysisContent({analysis}:{analysis:Analysis}) {
  const facts=analysis.facts;
  return <div className="space-y-5">
    <p className="text-xs text-slate-500">{analysis.modelVersion} · {new Date(analysis.createdAt).toLocaleString()} · Evidence-backed AI extraction, deterministic scoring and fact-grounded drafts</p>
    <section className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Reasoning and AI notes</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-600">{analysis.reasoning.map((r,i)=><li key={i}>{r}</li>)}{facts.notes.map((r,i)=><li key={`note-${i}`}>{r}</li>)}</ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["locationsEstimate","staffEstimate"] as const).map(k=><div key={k} className="text-sm"><span className="font-medium">{k==="staffEstimate"?"Staff estimate":"Location estimate"}: </span>{facts[k]?`${facts[k]!.value} (${facts[k]!.confidence})`:"Unknown"}</div>)}</div>
    </section>
    <section className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Buying signals and operational evidence</h3><p className="mt-1 text-xs text-slate-500">Unknown signals are not negative evidence. Source publication does not prove deliverability or purchase intent.</p><div className="mt-3 space-y-3">{Object.entries(facts.signals).filter(([,v])=>v).map(([key,s])=>s&&<div key={key} className="border-t pt-3 text-sm"><p className="font-medium">{key} · {s.value?"present":"stated as not offered"} · {s.confidence}</p><blockquote className="mt-1 text-slate-600">“{s.quote}”</blockquote><p className="mt-1"><SourceLink href={s.sourceUrl}/></p><p className="text-xs text-slate-500">Event date: {s.eventDate??"unknown"}</p></div>)}</div></section>
    <section className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Published contact evidence</h3><div className="mt-3 space-y-3">{Object.entries(facts.contacts).map(([key,c])=>c&&<div key={key} className="border-t pt-2 text-sm"><p className="font-medium">{key}: <span className="break-all font-normal">{c.value}</span></p><p className="mt-1 text-slate-600">“{c.quote}”</p><SourceLink href={c.sourceUrl}/></div>)}</div></section>
    <section className="rounded-xl border bg-white p-4"><h3 className="font-semibold">Outreach drafts — not sent</h3><p className="mt-1 text-xs text-slate-500">Review before using. Both emails are limited to 120 words. No send button or provider integration.</p>{!analysis.emailBody&&<p className="mt-3 text-sm text-slate-500">No drafts: hospitality fit was not established from the evidence, so no outreach copy was written.</p>}{analysis.emailBody&&[{title:"Cold email",subject:analysis.emailSubject,body:analysis.emailBody},{title:"Short follow-up",subject:analysis.followupSubject,body:analysis.followupBody},{title:"Phone call opener",subject:"",body:analysis.phoneOpener??""}].map(d=><div key={d.title} className="mt-4 border-t pt-3"><h4 className="text-sm font-semibold">{d.title}</h4>{d.subject&&<p className="mt-1 text-sm">Subject: {d.subject}</p>}<pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-700">{d.body}</pre></div>)}</section>
    <details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Score breakdowns</summary><pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify({fit:analysis.scores.fitBreakdown,intent:analysis.scores.intentBreakdown,complexity:analysis.scores.complexityBreakdown,reachability:analysis.scores.reachabilityBreakdown},null,2)}</pre></details>
    <details className="rounded-xl border bg-white p-4 text-sm"><summary className="cursor-pointer font-semibold">Source snapshots ({analysis.sources.length})</summary>{analysis.sources.map((s,i)=><div key={i} className="mt-3 border-t pt-3"><SourceLink href={s.url} className="break-all text-emerald-700 underline"/><p className="text-xs text-slate-500">{s.kind} · Retrieved {s.fetchedAt}</p><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs">{s.text}</pre></div>)}</details>
  </div>;
}

export function LeadIntelligenceDetail({id}:{id:string}) {
  const {data:session,status}=useSession();
  const [lead,setLead]=useState<LeadDetail|null>(null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [notes,setNotes]=useState("");
  const load=async(signal?:AbortSignal)=>{const r=await fetch(`/api/admin/lead-intelligence?id=${encodeURIComponent(id)}`,{signal});const d=await r.json();if(!r.ok) throw new Error(d.error||"Lead unavailable");setLead(d.lead);setNotes(d.lead.notes??"");};
  useEffect(()=>{
    if(status!=="authenticated"||!session?.user?.isPlatformAdmin) return;
    const controller=new AbortController();
    load(controller.signal).catch(e=>{if(e.name!=="AbortError") setError(e.message);});
    return ()=>controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id,status,session?.user?.isPlatformAdmin]);
  const update=async(body:{status?:string;notes?:string})=>{
    setBusy(true);setError("");try{const r=await fetch("/api/admin/lead-intelligence",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...body})});const d=await r.json();if(!r.ok) throw new Error(d.error);await load();setMessage("Saved. No prospect contacted.");}catch(e){setError(e instanceof Error?e.message:"Save failed");}finally{setBusy(false);}
  };
  const reanalyse=async()=>{
    setBusy(true);setError("");try{const r=await fetch("/api/admin/lead-intelligence/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({leadId:id})});const d=await r.json();if(!r.ok) throw new Error(d.error);setMessage(d.skipped?d.reason:`Analysis run ${d.run.status}.`);await load();}catch(e){setError(e instanceof Error?e.message:"Analysis failed");}finally{setBusy(false);}
  };
  if(status==="loading") return <p className="p-6 text-sm">Checking access…</p>;
  if(!session?.user?.isPlatformAdmin) return <p role="alert" className="p-6 text-sm text-red-700">Platform admin access required.</p>;
  return <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6"><Link href="/admin?tab=lead-intelligence" className="text-sm text-emerald-700 underline">Back to Lead Intelligence</Link>{error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message&&<p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{!lead&&!error&&<p>Loading prospect…</p>}{lead&&<>
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1><p className="mt-1 text-sm text-slate-500">{lead.address||lead.city} · {lead.country.toUpperCase()} · {lead.classification}</p>{lead.website&&<SourceLink href={lead.website} className="break-all text-sm text-emerald-700 underline"/>}</div><button disabled={busy} onClick={reanalyse} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50">{busy?"Working…":"Reanalyse (uses configured API budget)"}</button></header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{[["Rotahr Fit",lead.fitScore===null?"Unknown":`${lead.fitScore}/100`],["Buying Intent",lead.intentStatus==="unknown"?"Unknown":`${lead.intentScore}/100 · ${lead.intentStatus}`],["Complexity",lead.complexityScore===null?"Unknown":`${lead.complexityScore}/10`],["Reachability",`${lead.reachabilityScore}/100`],["Priority",`${lead.priorityScore.toFixed(1)}/100`]].map(([label,value])=><div key={label} className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Contact recommendation</h2><p className="mt-2 text-sm">Best method: <strong>{lead.bestContactMethod??"Unknown"}</strong> · Decision maker: {lead.decisionMaker??"Unknown"}</p><p className="mt-1 text-sm text-slate-600">{lead.contactReason}</p><p className="mt-2 text-xs text-slate-500">Decision-maker role and response likelihood are estimates unless explicit source evidence says otherwise. No email, message or call has been sent by this system.</p></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Human contact tracking</h2><label className="mt-2 block text-xs text-slate-500">Status<select disabled={busy} value={lead.status} onChange={e=>void update({status:e.target.value})} className="ml-2 rounded-lg border p-2 text-sm">{LEAD_STATUSES.map(s=><option key={s} value={s}>{s.replace(/_/g," ")}</option>)}</select></label><label className="mt-3 block text-xs text-slate-500">Notes<textarea value={notes} maxLength={5000} onChange={e=>setNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border p-3 text-sm"/></label><button disabled={busy} onClick={()=>void update({notes})} className="mt-2 rounded-lg bg-emerald-700 px-3 py-2 text-sm text-white">Save notes</button></section>
    {lead.lastError&&<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Last analysis issue: {lead.lastError}</p>}
    <h2 className="border-b pb-2 text-lg font-semibold text-emerald-800">AI Analysis</h2>{lead.analyses[0]?<AnalysisContent analysis={lead.analyses[0]}/>:<p className="rounded-xl border bg-white p-6 text-sm text-slate-500">Not analysed yet. Unknown scores are not a poor-fit verdict.</p>}
    {lead.analyses.length>1&&<p className="text-xs text-slate-500">{lead.analyses.length-1} earlier snapshots retained in the database.</p>}
  </>}</div>;
}