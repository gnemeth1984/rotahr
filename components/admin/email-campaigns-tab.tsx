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

// Every template is a Resend broadcast: personalisation and the unsubscribe
// link must use Resend's own placeholders, {{{contact.first_name|there}}} and
// {{{RESEND_UNSUBSCRIBE_URL}}}. The old "[First Name]" / "{{unsubscribe}}"
// tokens went out literally. Facts (prices, trial length, URLs) must match
// lib/marketing/plans.ts and lib/seo/product-facts.ts.
const BTN = "background:#FF6B35;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;font-weight:600";
const WRAP = "font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:32px 24px;color:#1a1a1a";
const FOOT = `<p style="font-size:12px;color:#888"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a> · Rotahr · Ireland</p>`;

const EMAIL_SEQUENCES = [
  {
    id: 1,
    label: "Email 1 — Cold Intro",
    subject: "Your rota is costing you more than you think",
    previewText: "Most managers spend 4+ hours a week on scheduling. There's a fix.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>If you're still building your rota in Excel — or worse, WhatsApp — you already know the drill.</p>
<p>Someone calls in sick Sunday morning. You spend 45 minutes scrambling to find cover. Half your staff don't confirm shifts until the night before. And somehow, every week, it's the same chaos.</p>
<p>It doesn't have to be that way.</p>
<p><strong>Rotahr</strong> is built specifically for hospitality teams. Rota planning, clock-in, HACCP records, bookings, stock and bookkeeping — all in one place. Your managers save hours every week. Your staff always know where they stand.</p>
<ul>
<li>Drag-and-drop rota builder — publish in minutes, not hours</li>
<li>Instant shift notifications to staff (app + email)</li>
<li>Time-off requests handled in the app — no more DMs</li>
<li>Clock in/out with an on-site geofence</li>
<li>New: a Manager Copilot morning brief — missed HACCP checks, dishes hit by supplier price rises, covers vs staffing and likely no-shows on one page</li>
<li>Manager dashboard: costs, hours, P&amp;L at a glance</li>
</ul>
<p>From €49 a month, flat — never per employee. No contracts, no setup fees, first 3 months free.</p>
<p><a href="https://rotahr.com/try" style="${BTN}">See the live demo →</a></p>
<p>Takes 5 minutes to look around. No signup needed for the demo.</p>
<p>— The Rotahr Team</p>
<p style="font-size:12px;color:#888">You're receiving this because you manage a hospitality venue. <a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a> · Rotahr · Ireland</p>
</div>`,
  },
  {
    id: 2,
    label: "Email 2 — Real Cost (Day 3)",
    subject: "How much is bad scheduling actually costing you?",
    previewText: "It's not just the time. It's the money walking out the door.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>Bad scheduling has a price. Most owners never add it up.</p>
<p>Here's a rough breakdown for a 15-person team:</p>
<ul>
<li><strong>4 hrs/week</strong> building the rota manually = ~€3,000/year of manager time</li>
<li><strong>1 no-show per week</strong> = lost covers, stressed staff, angry customers</li>
<li><strong>Overtime errors</strong> from manual tracking = payroll overpays you'll never catch</li>
<li><strong>A supplier price rise nobody noticed</strong> = a best-seller quietly losing margin for months</li>
</ul>
<p>Those add up quickly, and they leak out quietly.</p>
<p>Rotahr starts at €49 a month, VAT included — a flat fee, never per employee. Its new Manager Copilot flags the no-show risks, the short-staffed hours and the dishes a price rise has hurt before service, not at month end.</p>
<p>You do the maths: <a href="https://rotahr.com/roi-calculator">rotahr.com/roi-calculator</a></p>
<p><a href="https://rotahr.com/pricing" style="${BTN}">See pricing →</a></p>
<p>The first 3 months are on us. No card needed to start.</p>
<p>— The Rotahr Team</p>
${FOOT}
</div>`,
  },
  {
    id: 3,
    label: "Email 3 — A Sunday in Rotahr (Day 7)",
    subject: "What Sunday evening looks like with the rota already done",
    previewText: "Publish in 20 minutes, swaps sorted in the app, Monday brief waiting.",
    // Was a quoted testimonial from a named Dublin manager. There is no such
    // customer on record, so it is now a walkthrough of the demo venue instead.
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>Here's how the week starts at The Anchor &amp; Tap, the demo gastropub you can open on our site with no signup.</p>
<ul>
<li><strong>Sunday:</strong> next week's rota is copied from this week, tweaked and published. Every staff member gets it on their phone.</li>
<li><strong>Monday morning:</strong> a swap request comes in through the app and the manager approves it in one tap — no WhatsApp thread.</li>
<li><strong>10am:</strong> the Manager Copilot has the day on one page: two fridge checks nobody logged yesterday, ribeye up 14% from the supplier and three dishes losing GP, and a lunch peak that's short on the floor.</li>
</ul>
<p><strong>What changes for your team:</strong></p>
<ul>
<li>Staff stop texting you for shift info</li>
<li>Time-off requests go through the app, not your personal phone</li>
<li>You see costs, hours and coverage gaps before they become problems</li>
</ul>
<p><a href="https://rotahr.com/try" style="${BTN}">Open the demo venue →</a></p>
<p>— The Rotahr Team</p>
${FOOT}
</div>`,
  },
  {
    id: 4,
    label: "Email 4 — AI Bookkeeping (Day 14)",
    subject: "Your receipts are piling up. Let AI sort them.",
    previewText: "Snap a photo. Rotahr reads it and logs the expense automatically.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>Most hospitality managers are running their bookkeeping the same way they ran their rota in 2015 — badly.</p>
<p>Rotahr has a built-in expense tracker with AI receipt reading.</p>
<ol>
<li><strong>Snap a photo</strong> of any receipt or delivery note</li>
<li><strong>AI reads it automatically</strong> — vendor, amount, VAT, category — all pre-filled</li>
<li><strong>You confirm or edit</strong>, then save</li>
<li><strong>Dashboard updates instantly</strong> — category totals, monthly spend, P&amp;L, VAT summary</li>
</ol>
<p>New: every supplier price that changes on the way in is now recorded, so the Manager Copilot can tell you which dishes lost margin — and what menu price would hold your target GP.</p>
<p>At the end of the month you have a clean expense report ready for your accountant. Not a box of crumpled receipts.</p>
<p><a href="https://rotahr.com/features/bookkeeping-receipts" style="${BTN}">See how it works →</a></p>
<p>— The Rotahr Team</p>
${FOOT}
</div>`,
  },
  {
    id: 5,
    label: "Email 5 — Objections (Day 21)",
    subject: `"We're too small for software like this"`,
    previewText: "If you have more than 3 staff, you're not too small.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>We hear this a lot.</p>
<p><em>"We're only a small team."<br/>"We don't have time to set something new up."<br/>"Excel works fine for now."</em></p>
<p>Here's the thing — Rotahr is built for exactly that team. The 8-person café. The 15-person bar. The hotel with rotating shift patterns and seasonal staff. And because pricing is flat, hiring for the summer doesn't change your bill.</p>
<p>Getting started:</p>
<ol>
<li>Add your venue and staff (or we do it with you on a call)</li>
<li>Build your first rota</li>
<li>Staff get an email invite, set their own password and download the app — done</li>
</ol>
<p>And if Excel is "working fine" — ask yourself: how many hours did you spend on it last week?</p>
<p><a href="https://rotahr.com/pricing" style="${BTN}">Start your 3 months free →</a></p>
<p>Still not sure? Reply to this email. I'll answer any question directly.</p>
<p>— Gabor, Rotahr</p>
${FOOT}
</div>`,
  },
  {
    id: 6,
    label: "Email 6 — Last Call (Day 30)",
    subject: "Last one from me — then I'll leave you alone",
    previewText: "3 months free. Still on the table.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>This is the last email in this sequence.</p>
<p>If Rotahr isn't for you, no hard feelings — unsubscribe below and I won't bother you again.</p>
<p>But if any of this has been nagging at you — the Sunday rota, the WhatsApp chaos, the receipts in a drawer — the free months are still there.</p>
<p><strong>What you get:</strong></p>
<ul>
<li>Full access for 3 months, no card required</li>
<li>Rota builder, staff app, HACCP records, bookings, expense tracker and the Manager Copilot daily brief</li>
<li>Support from a real person if you get stuck</li>
</ul>
<p><strong>What it costs to try:</strong> Nothing. After that, from €49 a month, flat.</p>
<p><a href="https://rotahr.com/pricing" style="${BTN}">Start your 3 months free →</a></p>
<p>If you do sign up and want help getting set up, just reply to this email.</p>
<p>— Gabor, Rotahr</p>
${FOOT}
</div>`,
  },
  {
    id: 7,
    label: "What's new — Manager Copilot (prospects)",
    subject: "New in Rotahr: a 10am brief that tells you what needs doing",
    previewText: "Missed checks, margin hits, short-staffed hours and no-show risks on one page.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>Everything a manager needs to know before lunch service is usually in five different places: the fridge check nobody logged, the supplier invoice that put ribeye up 14%, the prep that keeps going in the bin, the table of eight that didn't show last time.</p>
<p>We've just shipped the <strong>Manager Copilot</strong>: one page each morning that reads all of it for you.</p>
<ul>
<li><strong>Compliance Monitor</strong> — missed or failed HACCP checks, expiring certificates on rostered staff, short rest between shifts</li>
<li><strong>Margin Guard</strong> — dishes hit by a supplier price rise, with the menu price that would hold your target GP (70% by default)</li>
<li><strong>Stock Waste Advisor</strong> — what's being binned, and why</li>
<li><strong>Booking Forecast</strong> — covers for the next 7 days against who's on the rota at the peak hour</li>
<li><strong>No-show Guard</strong> — risky bookings, the reason, and a confirmation message drafted for you to copy</li>
</ul>
<p>It suggests; it never sends, publishes or changes anything on its own. And guest and staff names, emails and phone numbers are stripped before anything reaches the AI.</p>
<p>Included on every plan — Starter €49, Pro €89, Enterprise €215 a month, flat, never per employee. First 3 months free.</p>
<p><a href="https://rotahr.com/features/manager-copilot" style="${BTN}">See how the Copilot works →</a></p>
<p>Or open the demo venue and try it yourself: <a href="https://rotahr.com/try">rotahr.com/try</a></p>
<p>— Gabor, Rotahr</p>
${FOOT}
</div>`,
  },
  {
    id: 8,
    label: "What's new — Manager Copilot (customers)",
    subject: "New in your Rotahr account: Manager Copilot",
    previewText: "Already switched on for admins and managers. Here's where to find it.",
    html: `<div style="${WRAP}">
<p>Hi {{{contact.first_name|there}}},</p>
<p>Your account has a new page: <strong>Manager Copilot</strong>, in the sidebar under Daily. It's included on your plan at no extra cost.</p>
<p>Open it before service and you get today's five priorities, a Tonight panel (covers, busiest hour, allergy tables, occasions) and five read-only checks: Compliance Monitor, Margin Guard, Stock Waste Advisor, Booking Forecast and No-show Guard. Every line links to the screen where you fix it. There's also an Ask box — try "which dishes lost margin?".</p>
<p><strong>Good to know:</strong></p>
<ul>
<li>It never sends, publishes or changes anything itself — you decide.</li>
<li>Admins and managers see it by default. To give a head chef access, tick the Manager Copilot permission on their employee profile. To switch it off, go to Settings → Features.</li>
<li>Margin Guard uses a 70% target GP until you change it on the Copilot page.</li>
<li>Names, emails and phone numbers are stripped before anything reaches the AI.</li>
</ul>
<p><strong>Also new:</strong> supplier price history on every stock item, revenue and labour % per venue (assign your POS to a venue in Settings → POS), staff invites by email, and staff now see only their own contact details in the directory.</p>
<p><a href="https://rotahr.com/copilot" style="${BTN}">Open the Copilot →</a></p>
<p>Full list of changes: <a href="https://rotahr.com/whats-new">rotahr.com/whats-new</a>. Reply to this email if anything looks off — it comes straight to me.</p>
<p>— Gabor, Rotahr</p>
${FOOT}
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

/**
 * Mirror of isUnroutableAddress() in lib/email/send.ts, for labelling rows the
 * client already holds. The server stays the authority on what actually sends -
 * this only decides what to grey out or hide.
 */
function isDemoAddress(email: string): boolean {
  const addr = (email || "").trim().toLowerCase();
  const domain = addr.split("@")[1];
  if (!domain) return true;
  const reserved = ["demo", "test", "example", "invalid", "localhost", "local", "internal"];
  const tld = domain.split(".").pop() ?? "";
  if (reserved.includes(tld)) return true;
  return ["example.com", "example.org", "example.net"].includes(domain);
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
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<string | null>(null);

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

  // Addresses on a demo or reserved domain can never receive mail. A broadcast
  // goes to the whole audience in one call, so one of these bounces on every
  // campaign until it is removed from the audience itself.
  const demoContacts = contacts.filter((c) => isDemoAddress(c.email));

  const purgeDemo = async () => {
    setPurging(true);
    setPurgeMsg(null);
    try {
      const r = await fetch(`/api/admin/email/contacts?audienceId=${segmentId}&purge=demo`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (d.error) { setPurgeMsg(d.error); return; }
      setPurgeMsg(`Removed ${d.removed} address${d.removed === 1 ? "" : "es"} that could never be delivered.`);
      await load();
    } catch {
      setPurgeMsg("Could not clean the audience \— try again.");
    } finally {
      setPurging(false);
    }
  };

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
        <div className="flex items-center gap-2">
          {demoContacts.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
              onClick={purgeDemo}
              disabled={purging}
            >
              {purging ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
              Remove {demoContacts.length} demo
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => setAdding(!adding)}>
            <UserPlus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      {purgeMsg && (
        <p className="px-3 py-2 text-xs text-slate-600 bg-amber-50 border-b border-amber-100">{purgeMsg}</p>
      )}

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
                <tr key={c.id} className={isDemoAddress(c.email) ? "bg-red-50/60" : "hover:bg-slate-50"}>
                  <td className="px-3 py-2 text-slate-700">
                    {c.email}
                    {isDemoAddress(c.email) && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-medium">
                        can&apos;t be delivered
                      </span>
                    )}
                  </td>
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
  /** Set by /api/admin/email/sent: every recipient is on a demo or reserved
   *  domain, so the row is dead history rather than a live delivery problem. */
  demo?: boolean;
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
  /**
   * Demo-domain rows are hidden by default.
   *
   * The seed gives every fake staff member an address on a made-up domain
   * (.demo is not a real TLD), so the daily shift-reminder cron used to mail
   * them and every one hard-bounced. Those sends are blocked at source now, but
   * Resend keeps the history forever, and the bounced rows sat mixed in with
   * real outreach - making the campaign screen read as "everything bounced"
   * when nothing real had. They are hidden rather than deleted because the
   * history is still evidence of what the domain has sent.
   */
  const [showDemo, setShowDemo] = useState(false);

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

  // Demo rows are excluded from the stats: a bounce rate that counts addresses
  // which can never be delivered to tells you nothing about real deliverability.
  const realEmails = emails.filter((e) => !e.demo);
  const demoEmails = emails.filter((e) => e.demo);
  const visible = showDemo ? emails : realEmails;

  // Stats summary
  const counts = realEmails.reduce<Record<string, number>>((acc, e) => {
    acc[e.last_event] = (acc[e.last_event] ?? 0) + 1;
    return acc;
  }, {});

  const total     = realEmails.length;
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
        <div className="flex items-center gap-2">
          {demoEmails.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1 text-slate-500"
              onClick={() => setShowDemo((v) => !v)}
            >
              <Ban className="h-3 w-3" />
              {showDemo ? "Hide" : "Show"} {demoEmails.length} demo
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => load(limit)}>
            <RefreshCw className="h-3 w-3" /> Refresh
          </Button>
        </div>
      </div>

      {demoEmails.length > 0 && (
        <p className="px-4 py-2 text-xs text-slate-600 bg-amber-50 border-b border-amber-100">
          {demoEmails.length} of the last {emails.length} are old sends to demo staff addresses
          (@rotahr.demo and similar). Those bounce because the domain is not real. They are
          blocked before sending now and are left out of the numbers below.
        </p>
      )}

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
      ) : visible.length === 0 ? (
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
                {visible.map((e) => (
                  <tr key={e.id} className={e.demo ? "bg-slate-50/80 text-slate-400" : "hover:bg-slate-50 transition-colors"}>
                    <td className="px-4 py-2.5 text-slate-700">
                      {Array.isArray(e.to) ? e.to.join(", ") : e.to}
                      {e.demo && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-medium">
                          demo address
                        </span>
                      )}
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
            <p className="text-xs text-slate-400">
              Showing last {visible.length} emails
              {demoEmails.length > 0 && !showDemo ? ` (${demoEmails.length} demo hidden)` : ""}
            </p>
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
