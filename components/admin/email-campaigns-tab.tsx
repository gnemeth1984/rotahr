"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail,
  Plus,
  Send,
  Trash2,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  UserPlus,
  X,
  Inbox,
  MousePointerClick,
  AlertCircle,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  name: string;
  created_at: string;
}

interface BroadcastRow {
  id: string;
  name: string;
  audience_id: string | null;
  segment_id: string | null;
  status: "draft" | "sent" | "queued";
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
}

interface Contact {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  unsubscribed: boolean;
  created_at: string;
}

// ─── Pre-written email sequences ──────────────────────────────────────────

const EMAIL_SEQUENCES = [
  {
    id: 1,
    label: "Email 1 — Cold Intro",
    subject: "Your rota is costing you more than you think",
    previewText: "Most managers spend 4+ hours a week on scheduling. There's a fix.",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<p>Hi [First Name],</p>
<p>If you're still building your rota in Excel — or worse, WhatsApp — you already know the drill.</p>
<p>Someone calls in sick Sunday morning. You spend 45 minutes scrambling to find cover. Half your staff don't confirm shifts until the night before. And somehow, every week, it's the same chaos.</p>
<p>It doesn't have to be that way.</p>
<p><strong>Rotahr</strong> is built specifically for hospitality teams. Rota planning, staff scheduling, time-off requests, and team messaging — all in one place. Your managers save hours every week. Your staff always know where they stand.</p>
<ul>
<li>Drag-and-drop rota builder — publish in minutes, not hours</li>
<li>Instant shift notifications to staff (app + email)</li>
<li>Time-off requests handled in the app — no more DMs</li>
<li>Clock in/out tracking per shift</li>
<li>Bookings assistant that flags when you need more cover</li>
<li>Manager dashboard: costs, hours, P&amp;L at a glance</li>
</ul>
<p>No contracts. No setup fees. First month free.</p>
<p><a href="https://rotahr.vercel.app" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Start your free trial →</a></p>
<p>Takes 5 minutes to set up. Your next rota will take half the time.</p>
<p>— The Rotahr Team</p>
<p style="font-size:12px;color:#888">You're receiving this because you manage a hospitality venue in Ireland. <a href="{{unsubscribe}}">Unsubscribe</a></p>
</div>`,
  },
  {
    id: 2,
    label: "Email 2 — Real Cost (Day 3)",
    subject: "How much is bad scheduling actually costing you?",
    previewText: "It's not just the time. It's the money walking out the door.",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<p>Hi [First Name],</p>
<p>Bad scheduling has a price. Most owners never add it up.</p>
<p>Here's a rough breakdown for a 15-person team:</p>
<ul>
<li><strong>4 hrs/week</strong> building the rota manually = ~€3,000/year of manager time</li>
<li><strong>1 no-show per week</strong> = lost covers, stressed staff, angry customers</li>
<li><strong>Overtime errors</strong> from manual tracking = payroll overpays you'll never catch</li>
<li><strong>High turnover</strong> from poor communication = €2,000–€5,000 per staff replacement</li>
</ul>
<p>That's easily <strong>€10,000+ a year</strong> bleeding out quietly.</p>
<p>Rotahr costs €79/month.</p>
<p>You do the maths.</p>
<p><a href="https://rotahr.vercel.app" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">See how it works →</a></p>
<p>First month is on us. No card needed to start.</p>
<p>— The Rotahr Team</p>
<p style="font-size:12px;color:#888"><a href="{{unsubscribe}}">Unsubscribe</a></p>
</div>`,
  },
  {
    id: 3,
    label: "Email 3 — Social Proof (Day 7)",
    subject: '"I got 6 hours back this week"',
    previewText: "What a Dublin bar manager said after switching to Rotahr.",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<p>Hi [First Name],</p>
<p>Sarah runs a 22-person team across a bar and kitchen in Dublin.</p>
<p>Before Rotahr, she spent Sunday evenings building the rota. Then Monday chasing confirmations. Then Tuesday dealing with cover requests in a WhatsApp group with 22 people in it.</p>
<p>After switching to Rotahr:</p>
<blockquote style="border-left:3px solid #10b981;padding-left:16px;margin:16px 0;font-style:italic">"I published the rota in 20 minutes. Staff got notified instantly. One person requested a swap through the app, it was sorted in an hour. I got my Sunday evening back."</blockquote>
<p><strong>What changes for your team:</strong></p>
<ul>
<li>Staff stop texting you for shift info</li>
<li>Time-off requests go through the app, not your personal phone</li>
<li>You see costs, hours and coverage gaps before they become problems</li>
</ul>
<p><a href="https://rotahr.vercel.app" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Start free — no card required →</a></p>
<p>— The Rotahr Team</p>
<p style="font-size:12px;color:#888"><a href="{{unsubscribe}}">Unsubscribe</a></p>
</div>`,
  },
  {
    id: 4,
    label: "Email 4 — AI Bookkeeping (Day 14)",
    subject: "Your receipts are piling up. Let AI sort them.",
    previewText: "Snap a photo. Rotahr reads it and logs the expense automatically.",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<p>Hi [First Name],</p>
<p>Most hospitality managers are running their bookkeeping the same way they ran their rota in 2015 — badly.</p>
<p>Rotahr has a built-in expense tracker with AI receipt reading.</p>
<ol>
<li><strong>Snap a photo</strong> of any receipt</li>
<li><strong>AI reads it automatically</strong> — vendor, amount, VAT, category — all pre-filled</li>
<li><strong>You confirm or edit</strong>, then save</li>
<li><strong>Dashboard updates instantly</strong> — category totals, monthly spend, P&amp;L, VAT summary</li>
</ol>
<p>At the end of the month you have a clean expense report ready for your accountant. Not a box of crumpled receipts.</p>
<p><a href="https://rotahr.vercel.app" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Try it free →</a></p>
<p>— The Rotahr Team</p>
<p style="font-size:12px;color:#888"><a href="{{unsubscribe}}">Unsubscribe</a></p>
</div>`,
  },
  {
    id: 5,
    label: "Email 5 — Objections (Day 21)",
    subject: '"We\'re too small for software like this"',
    previewText: "If you have more than 3 staff, you're not too small.",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<p>Hi [First Name],</p>
<p>We hear this a lot.</p>
<p><em>"We're only a small team."<br/>"We don't have time to set something new up."<br/>"Excel works fine for now."</em></p>
<p>Here's the thing — Rotahr is built for exactly that team. The 8-person cafe. The 15-person bar. The hotel with rotating shift patterns and seasonal staff.</p>
<p>Setup takes under 10 minutes:</p>
<ol>
<li>Add your venue and staff</li>
<li>Import or build your first rota</li>
<li>Staff get invited by text or email — they download the app, done</li>
</ol>
<p>And if Excel is "working fine" — ask yourself: how many hours did you spend on it last week?</p>
<p><a href="https://rotahr.vercel.app" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Start free, set up in 10 minutes →</a></p>
<p>Still not sure? Reply to this email. I'll answer any question directly.</p>
<p>— Gabor, Rotahr</p>
<p style="font-size:12px;color:#888"><a href="{{unsubscribe}}">Unsubscribe</a></p>
</div>`,
  },
  {
    id: 6,
    label: "Email 6 — Last Call (Day 30)",
    subject: "Last one from me — then I'll leave you alone",
    previewText: "One month free. Still on the table.",
    html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a">
<p>Hi [First Name],</p>
<p>This is the last email in this sequence.</p>
<p>If Rotahr isn't for you, no hard feelings — unsubscribe below and I won't bother you again.</p>
<p>But if any of this has been nagging at you — the Sunday rota, the WhatsApp chaos, the receipts in a drawer — the free trial is still there.</p>
<p><strong>What you get:</strong></p>
<ul>
<li>Full access for 30 days, no card required</li>
<li>Rota builder, staff app, expense tracker, bookings assistant, dashboard</li>
<li>Support from a real person if you get stuck</li>
</ul>
<p><strong>What it costs to try:</strong> Nothing.</p>
<p><a href="https://rotahr.vercel.app" style="background:#10b981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600">Start your free trial →</a></p>
<p>If you do sign up and want help getting set up, just reply to this email.</p>
<p>— Gabor, Rotahr</p>
<p style="font-size:12px;color:#888"><a href="{{unsubscribe}}">Unsubscribe</a> · Rotahr · Dublin, Ireland</p>
</div>`,
  },
];

// ─── Status badge ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "sent")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Sent
      </span>
    );
  if (status === "queued")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" /> Queued
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
      <FileText className="h-3 w-3" /> Draft
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Contacts Panel ────────────────────────────────────────────────────────

function ContactsPanel({ segmentId }: { segmentId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/email/contacts?audienceId=${segmentId}`);
      const d = await r.json();
      setContacts(d?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [segmentId]);

  useEffect(() => { load(); }, [load]);

  const addContact = async () => {
    if (!newEmail) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/email/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, firstName: newFirst, lastName: newLast, audienceId: segmentId }),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      setNewEmail(""); setNewFirst(""); setNewLast("");
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border border-slate-100 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Contacts ({contacts.length})
        </p>
        <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setAdding(!adding)}>
          <UserPlus className="h-3 w-3" /> Add
        </Button>
      </div>

      {adding && (
        <div className="px-3 py-3 bg-emerald-50 border-b border-emerald-100 flex flex-wrap gap-2 items-end">
          <div>
            <p className="text-xs text-slate-500 mb-1">Email *</p>
            <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" className="h-7 text-xs w-48" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">First Name</p>
            <Input value={newFirst} onChange={e => setNewFirst(e.target.value)} placeholder="Optional" className="h-7 text-xs w-28" />
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Last Name</p>
            <Input value={newLast} onChange={e => setNewLast(e.target.value)} placeholder="Optional" className="h-7 text-xs w-28" />
          </div>
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={addContact} disabled={saving || !newEmail}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>
            <X className="h-3 w-3" />
          </Button>
          {err && <p className="text-xs text-red-500 w-full">{err}</p>}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-center py-6 text-xs text-slate-400">No contacts yet — add some above</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-700">{c.email}</td>
                  <td className="px-3 py-2 text-slate-600">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</td>
                  <td className="px-3 py-2">
                    {c.unsubscribed
                      ? <span className="text-red-500">Unsubscribed</span>
                      : <span className="text-emerald-600">Active</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{fmtDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Create Broadcast Modal ────────────────────────────────────────────────

function CreateBroadcastModal({
  segments,
  onClose,
  onCreated,
}: {
  segments: Segment[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [audienceId, setAudienceId] = useState(segments[0]?.id ?? "");
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null);
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pickSeq = (id: number) => {
    const seq = EMAIL_SEQUENCES.find((s) => s.id === id);
    if (seq) {
      setSelectedSeq(id);
      setSubject(seq.subject);
      setPreviewText(seq.previewText);
      setHtml(seq.html);
      if (!name) setName(seq.label);
    }
  };

  const save = async () => {
    if (!name || !subject || !html || !audienceId) {
      setErr("Fill in name, subject, HTML and select an audience.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/email/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, previewText, html, audienceId }),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">New Broadcast</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Quick pick from sequence */}
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Load from email sequence</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {EMAIL_SEQUENCES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickSeq(s.id)}
                  className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    selectedSeq === s.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Audience *</label>
            {segments.length === 0 ? (
              <p className="text-xs text-amber-600">No audiences yet — create one first</p>
            ) : (
              <select
                value={audienceId}
                onChange={(e) => setAudienceId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Broadcast name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Email 1 — Cold Intro" className="text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Subject line *</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Preview text</label>
            <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Short preview shown in inbox" className="text-sm" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">HTML body *</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={8}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
              placeholder="<div>Your email HTML here...</div>"
            />
          </div>

          {err && <p className="text-sm text-red-500">{err}</p>}

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose} className="text-sm">Cancel</Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save as Draft"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Email Campaigns Tab ────────────────────────────────────────────

export function EmailCampaignsTab() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [broadcasts, setBroadcasts] = useState<BroadcastRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [creatingAudience, setCreatingAudience] = useState(false);
  const [newAudienceName, setNewAudienceName] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendConfirm, setSendConfirm] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [segRes, brdRes] = await Promise.all([
        fetch("/api/admin/email/segments"),
        fetch("/api/admin/email/broadcasts"),
      ]);
      const segData = await segRes.json();
      const brdData = await brdRes.json();
      setSegments(segData?.data ?? []);
      setBroadcasts(brdData?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAudience = async () => {
    if (!newAudienceName) return;
    try {
      const r = await fetch("/api/admin/email/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAudienceName }),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      setNewAudienceName("");
      setCreatingAudience(false);
      await load();
    } catch {
      setErr("Failed to create audience");
    }
  };

  const sendBroadcast = async (id: string) => {
    setSendingId(id);
    setSendConfirm(null);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/email/broadcasts/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      await load();
    } finally {
      setSendingId(null);
    }
  };

  const deleteBroadcast = async (id: string) => {
    setDeletingId(id);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/email/broadcasts/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const segmentName = (id: string | null) => {
    if (!id) return "—";
    return segments.find((s) => s.id === id)?.name ?? id.slice(0, 8) + "…";
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );

  return (
    <div className="space-y-6">
      {err && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          {err}
          <button onClick={() => setErr(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Audiences / Segments */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-slate-400" /> Audiences ({segments.length})
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={load}>
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCreatingAudience(!creatingAudience)}>
              <Plus className="h-3 w-3" /> New Audience
            </Button>
          </div>
        </div>

        {creatingAudience && (
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex gap-2 items-center">
            <Input
              value={newAudienceName}
              onChange={(e) => setNewAudienceName(e.target.value)}
              placeholder="e.g. Ireland Hospitality Prospects"
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => e.key === "Enter" && createAudience()}
            />
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={createAudience} disabled={!newAudienceName}>
              Create
            </Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setCreatingAudience(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {segments.length === 0 ? (
          <p className="text-center py-10 text-slate-400 text-sm">
            No audiences yet — create one to start adding contacts
          </p>
        ) : (
          <div className="divide-y divide-slate-50">
            {segments.map((seg) => (
              <div key={seg.id}>
                <button
                  onClick={() => setExpandedSegment(expandedSegment === seg.id ? null : seg.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-slate-700 text-sm">{seg.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">ID: {seg.id.slice(0, 16)}…</p>
                  </div>
                  {expandedSegment === seg.id
                    ? <ChevronUp className="h-4 w-4 text-slate-400" />
                    : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                {expandedSegment === seg.id && (
                  <div className="px-4 pb-4">
                    <ContactsPanel segmentId={seg.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Broadcasts */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-slate-400" /> Broadcasts ({broadcasts.length})
          </p>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="h-3 w-3" /> New Broadcast
          </Button>
        </div>

        {broadcasts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Mail className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">No broadcasts yet</p>
            <p className="text-xs mt-1">Create a broadcast to send to your audience</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Audience</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Sent At</th>
                  <th className="px-4 py-2.5 text-left">Created</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {broadcasts.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{b.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{b.id.slice(0, 12)}…</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {segmentName(b.audience_id ?? b.segment_id)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(b.sent_at)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{fmtDate(b.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {b.status === "draft" && (
                          sendConfirm === b.id ? (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                                onClick={() => sendBroadcast(b.id)}
                                disabled={sendingId === b.id}
                              >
                                {sendingId === b.id
                                  ? <Loader2 className="h-3 w-3 animate-spin" />
                                  : "Confirm Send"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 text-xs px-2"
                                onClick={() => setSendConfirm(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-xs gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                              onClick={() => setSendConfirm(b.id)}
                            >
                              <Send className="h-3 w-3" /> Send
                            </Button>
                          )
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                          onClick={() => deleteBroadcast(b.id)}
                          disabled={deletingId === b.id}
                        >
                          {deletingId === b.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sent emails log */}
      <SentEmailsSection />

      {showCreate && (
        <CreateBroadcastModal
          segments={segments}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}

// ─── Sent Emails Section ────────────────────────────────────────────────────

type EmailEvent =
  | "bounced" | "canceled" | "clicked" | "complained"
  | "delivered" | "delivery_delayed" | "failed" | "opened"
  | "queued" | "scheduled" | "sent" | "suppressed";

interface SentEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  last_event: EmailEvent;
}

function EventBadge({ event }: { event: EmailEvent }) {
  const map: Record<EmailEvent, { label: string; cls: string; icon: React.ReactNode }> = {
    opened:          { label: "Opened",   cls: "bg-emerald-100 text-emerald-700", icon: <Mail className="h-3 w-3" /> },
    clicked:         { label: "Clicked",  cls: "bg-blue-100 text-blue-700",       icon: <MousePointerClick className="h-3 w-3" /> },
    delivered:       { label: "Delivered",cls: "bg-slate-100 text-slate-600",     icon: <CheckCircle2 className="h-3 w-3" /> },
    sent:            { label: "Sent",     cls: "bg-slate-100 text-slate-600",     icon: <Send className="h-3 w-3" /> },
    queued:          { label: "Queued",   cls: "bg-amber-100 text-amber-700",     icon: <Clock className="h-3 w-3" /> },
    scheduled:       { label: "Scheduled",cls: "bg-amber-100 text-amber-700",     icon: <Clock className="h-3 w-3" /> },
    bounced:         { label: "Bounced",  cls: "bg-red-100 text-red-700",         icon: <AlertCircle className="h-3 w-3" /> },
    failed:          { label: "Failed",   cls: "bg-red-100 text-red-700",         icon: <AlertCircle className="h-3 w-3" /> },
    complained:      { label: "Spam",     cls: "bg-red-100 text-red-700",         icon: <AlertCircle className="h-3 w-3" /> },
    suppressed:      { label: "Suppressed",cls:"bg-red-100 text-red-700",         icon: <Ban className="h-3 w-3" /> },
    canceled:        { label: "Canceled", cls: "bg-slate-100 text-slate-500",     icon: <X className="h-3 w-3" /> },
    delivery_delayed:{ label: "Delayed",  cls: "bg-amber-100 text-amber-700",     icon: <Clock className="h-3 w-3" /> },
  };
  const { label, cls, icon } = map[event] ?? { label: event, cls: "bg-slate-100 text-slate-500", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {icon} {label}
    </span>
  );
}

function SentEmailsSection() {
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const load = useCallback(async (lim = limit) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/email/sent?limit=${lim}`);
      const d = await r.json();
      if (d.error) { setError(d.error); return; }
      setEmails(d?.data ?? []);
    } catch {
      setError("Failed to load sent emails");
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => { load(); }, [load]);

  // Stats summary
  const counts = emails.reduce<Record<string, number>>((acc, e) => {
    acc[e.last_event] = (acc[e.last_event] ?? 0) + 1;
    return acc;
  }, {});

  const total     = emails.length;
  const opened    = (counts.opened ?? 0) + (counts.clicked ?? 0);
  const delivered = counts.delivered ?? 0;
  const bounced   = (counts.bounced ?? 0) + (counts.failed ?? 0);
  const openRate  = total > 0 ? Math.round((opened / total) * 100) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <p className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
          <Inbox className="h-4 w-4 text-slate-400" /> Sent Emails ({total})
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => load(limit)}>
          <RefreshCw className="h-3 w-3" /> Refresh
        </Button>
      </div>

      {/* Summary stats */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 border-b border-slate-100">
          {[
            { label: "Total Sent", value: total, cls: "text-slate-900" },
            { label: "Opened / Clicked", value: `${opened} (${openRate}%)`, cls: "text-emerald-600" },
            { label: "Delivered", value: delivered, cls: "text-slate-700" },
            { label: "Bounced / Failed", value: bounced, cls: bounced > 0 ? "text-red-600" : "text-slate-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white px-4 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">{s.label}</p>
              <p className={`text-xl font-bold ${s.cls}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="text-center py-10 text-sm text-red-500">{error}</p>
      ) : emails.length === 0 ? (
        <p className="text-center py-10 text-slate-400 text-sm">No sent emails found</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left">To</th>
                  <th className="px-4 py-2.5 text-left">Subject</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Sent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {emails.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700">
                      {Array.isArray(e.to) ? e.to.join(", ") : e.to}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={e.subject}>
                      {e.subject}
                    </td>
                    <td className="px-4 py-2.5">
                      <EventBadge event={e.last_event} />
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                      {fmtDate(e.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">Showing last {emails.length} emails</p>
            {emails.length === limit && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => { const next = limit + 50; setLimit(next); load(next); }}
              >
                Load more
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
