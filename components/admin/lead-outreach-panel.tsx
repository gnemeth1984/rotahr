"use client";

import { useEffect, useMemo, useState } from "react";
import { demoUrl, tutorialsUrl, withLinks, type LeadEmailKind } from "@/lib/lead-intelligence/outreach-links";

type SendConfig = { configured: boolean; from: string; dailyLimit: number; sentToday: number };
export type OutreachLead = {
  id: string; name: string; status: string; phone: string | null; contactedAt: string | null;
  generalEmail: string | null; managerEmail: string | null; reservationsEmail: string | null; contactForm: string | null;
};
export type OutreachDrafts = {
  emailSubject: string | null; emailBody: string | null; followupSubject: string | null; followupBody: string | null; phoneOpener: string | null;
};

const CLOSED = ["suppressed", "not_interested", "converted"];
const OTHER = "__other__";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" onClick={() => { void navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }} className="rounded-lg border bg-white px-3 py-1.5 text-xs">{done ? "Copied" : "Copy"}</button>;
}

function recipients(lead: OutreachLead) {
  const out: { value: string; label: string }[] = [];
  for (const [key, label] of [["managerEmail", "Manager"], ["generalEmail", "General"], ["reservationsEmail", "Reservations"]] as const) {
    const v = lead[key]?.trim();
    if (v && !out.some((o) => o.value.toLowerCase() === v.toLowerCase())) out.push({ value: v, label: `${label}: ${v}` });
  }
  return out;
}

function EmailDraft({ lead, kind, title, subject, body, config, blocked, onSent }: {
  lead: OutreachLead; kind: LeadEmailKind; title: string; subject: string; body: string;
  config: SendConfig | null; blocked: string; onSent: (msg: string) => Promise<void>;
}) {
  const options = useMemo(() => recipients(lead), [lead]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [choice, setChoice] = useState(options[0]?.value ?? OTHER);
  const [other, setOther] = useState("");
  const [subj, setSubj] = useState(subject);
  const [text, setText] = useState(() => withLinks(body, kind));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsForce, setNeedsForce] = useState(false);
  const to = (choice === OTHER ? other : choice).trim();
  const validTo = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(to);

  const reset = () => { setOpen(false); setStep("edit"); setError(""); setNeedsForce(false); };
  const send = async (force = false) => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/lead-intelligence/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, kind, to, subject: subj, body: text, force }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.code === "already_contacted") setNeedsForce(true);
        throw new Error(d.error || "Send failed");
      }
      reset();
      await onSent(`${title} sent to ${d.to} at ${new Date(d.sentAt).toLocaleTimeString()} (${d.sentToday}/${d.dailyLimit} outreach emails today). Lead marked contacted.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Send failed"); }
    finally { setBusy(false); }
  };

  const reason = blocked || (!config ? "Checking email setup…" : !config.configured ? "Email sending is not configured (BREVO_API_KEY missing in Vercel)." : config.sentToday >= config.dailyLimit ? `Today's limit of ${config.dailyLimit} outreach emails is used up.` : "");

  return <div className="mt-4 border-t pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="flex gap-2">
        <CopyButton text={`Subject: ${subject}\n\n${withLinks(body, kind)}`} />
        {!open && <button type="button" disabled={!!reason} title={reason || undefined} onClick={() => setOpen(true)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Send now</button>}
      </div>
    </div>
    {reason && !open && <p className="mt-1 text-xs text-amber-700">{reason}</p>}
    {!open && <>
      <p className="mt-1 text-sm">Subject: {subject}</p>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-700">{withLinks(body, kind)}</pre>
    </>}
    {open && <div className="mt-3 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      {step === "edit" && <>
        <label className="block text-xs text-slate-600">To
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2 text-sm">
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value={OTHER}>Type another address…</option>
          </select>
        </label>
        {choice === OTHER && <input type="email" value={other} onChange={(e) => setOther(e.target.value)} placeholder="name@business.ie" className="block w-full rounded-lg border bg-white p-2 text-sm" />}
        {options.length === 0 && <p className="text-xs text-slate-500">No published email address was found for this venue.{lead.contactForm ? <> Their contact form: <a href={lead.contactForm} target="_blank" rel="noopener noreferrer nofollow" className="text-emerald-700 underline">open</a></> : null}</p>}
        <label className="block text-xs text-slate-600">Subject
          <input value={subj} maxLength={200} onChange={(e) => setSubj(e.target.value)} className="mt-1 block w-full rounded-lg border bg-white p-2 text-sm" />
        </label>
        <label className="block text-xs text-slate-600">Message
          <textarea value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} className="mt-1 block min-h-56 w-full rounded-lg border bg-white p-3 text-sm leading-relaxed" />
        </label>
        <p className="text-xs text-slate-500">Every email includes the live demo (<a href={demoUrl(kind)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">rotahr.com/try</a>) and the tutorials (<a href={tutorialsUrl(kind)} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline">rotahr.com/tutorials</a>). If you delete them they are added back before sending. An unsubscribe link is added at the bottom.</p>
        <div className="flex gap-2">
          <button type="button" disabled={!validTo || !subj.trim() || text.trim().length < 20} onClick={() => setStep("confirm")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Review and send</button>
          <button type="button" onClick={reset} className="rounded-lg border bg-white px-3 py-2 text-sm">Cancel</button>
        </div>
        {!validTo && choice === OTHER && other && <p className="text-xs text-red-700">Enter a valid email address.</p>}
      </>}
      {step === "confirm" && <>
        <p className="text-sm">Send this email to <strong className="break-all">{to}</strong> from <strong>{config?.from}</strong> right now? It cannot be recalled.</p>
        <p className="text-sm">Subject: {subj}</p>
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-3 font-sans text-sm leading-relaxed text-slate-700">{withLinks(text, kind)}</pre>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {needsForce
            ? <button type="button" disabled={busy} onClick={() => void send(true)} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Sending…" : "Send anyway"}</button>
            : <button type="button" disabled={busy} onClick={() => void send(false)} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Sending…" : "Send now"}</button>}
          <button type="button" disabled={busy} onClick={() => { setStep("edit"); setError(""); setNeedsForce(false); }} className="rounded-lg border bg-white px-3 py-2 text-sm">Back to edit</button>
        </div>
      </>}
    </div>}
  </div>;
}

function PhoneDraft({ lead, opener, onLogged }: { lead: OutreachLead; opener: string; onLogged: (msg: string) => Promise<void> }) {
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const log = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/admin/lead-intelligence/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "call", leadId: lead.id, outcome }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not log the call");
      setOutcome("");
      await onLogged("Call logged in Notes. Lead marked contacted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not log the call"); }
    finally { setBusy(false); }
  };
  const tel = lead.phone?.replace(/[^\d+]/g, "");
  return <div className="mt-4 border-t pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="text-sm font-semibold">Phone call opener</h4>
      <div className="flex gap-2">
        {opener && <CopyButton text={opener} />}
        {tel ? <a href={`tel:${tel}`} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white">Call {lead.phone}</a> : <span className="text-xs text-slate-500">No published phone number</span>}
      </div>
    </div>
    <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-700">{opener}</pre>
    <p className="mt-2 text-xs text-slate-500">On the call, offer to email the demo link ({demoUrl("cold").split("?")[0]}) and the tutorials ({tutorialsUrl("cold").split("?")[0]}), then use Send now above.</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <input value={outcome} maxLength={500} onChange={(e) => setOutcome(e.target.value)} placeholder="Call outcome, e.g. spoke to manager, send demo link" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" />
      <button type="button" disabled={busy} onClick={() => void log()} className="rounded-lg border bg-white px-3 py-2 text-sm disabled:opacity-50">{busy ? "Saving…" : "Log call"}</button>
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}

export function LeadOutreachPanel({ lead, drafts, onChanged }: { lead: OutreachLead; drafts: OutreachDrafts; onChanged: (msg: string) => Promise<void> }) {
  const [config, setConfig] = useState<SendConfig | null>(null);
  const refreshConfig = async () => {
    const r = await fetch("/api/admin/lead-intelligence/send");
    const d = await r.json().catch(() => null);
    setConfig(r.ok && d ? d : { configured: false, from: "", dailyLimit: 0, sentToday: 0 });
  };
  useEffect(() => { void refreshConfig().catch(() => setConfig({ configured: false, from: "", dailyLimit: 0, sentToday: 0 })); }, []);
  const blocked = CLOSED.includes(lead.status) ? `This lead is marked ${lead.status.replace(/_/g, " ")}. Change the status to contact them.` : "";
  const after = async (msg: string) => { await refreshConfig().catch(() => undefined); await onChanged(msg); };

  return <section className="rounded-xl border bg-white p-4">
    <h3 className="font-semibold">Outreach</h3>
    <p className="mt-1 text-xs text-slate-500">
      Review and edit before sending. Nothing is sent until you press Send now and confirm.
      {config?.configured && <> Sends from {config.from}. {config.sentToday}/{config.dailyLimit} outreach emails sent today (limit shared with the automated outreach).</>}
      {" "}Unsubscribed addresses are blocked, and every send or call is written to Notes.
    </p>
    {!drafts.emailBody && <p className="mt-3 text-sm text-slate-500">No drafts: hospitality fit was not established from the evidence, so no outreach copy was written.</p>}
    {drafts.emailBody && <>
      <EmailDraft lead={lead} kind="cold" title="Cold email" subject={drafts.emailSubject ?? ""} body={drafts.emailBody} config={config} blocked={blocked} onSent={after} />
      {drafts.followupBody && <EmailDraft lead={lead} kind="followup" title="Short follow-up" subject={drafts.followupSubject ?? ""} body={drafts.followupBody} config={config} blocked={blocked} onSent={after} />}
      <PhoneDraft lead={lead} opener={drafts.phoneOpener ?? ""} onLogged={after} />
    </>}
  </section>;
}
