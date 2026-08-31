"use client";

/**
 * Marketing campaigns tab.
 *
 * The important thing this screen has to make obvious: building a campaign
 * queues drafts, it does not send. A human ticks the messages and presses send.
 * Automations run nightly and only ever add to the review queue.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Mail,
  MessageSquare,
  Play,
  Send,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Pencil,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SegmentDef {
  key: string;
  label: string;
  description: string;
  needsTag?: boolean;
}

interface Campaign {
  id: string;
  name: string;
  segment: string;
  segmentTag: string | null;
  channel: string;
  subject: string | null;
  message: string;
  scheduleAt: string | null;
  status: string;
  automationRule: string | null;
  active: boolean;
  lastRunAt: string | null;
  createdAt: string;
  sendCounts: Record<string, number>;
  _count: { sends: number };
}

interface SendRow {
  id: string;
  campaignId: string;
  channel: string;
  toAddress: string | null;
  subject: string | null;
  body: string;
  status: string;
  skipReason: string | null;
  sentAt: string | null;
  errorMessage: string | null;
  customer: { id: string; name: string; loyaltyTier: string; totalSpend: number } | null;
  campaign: { id: string; name: string; channel: string };
}

interface PreviewResult {
  matched: number;
  contactable: number;
  bySkipReason: Record<string, number>;
  sample: { id: string; name: string; to: string | null; reason: string | null }[];
  rendered: { subject: string; body: string; guest: string | null } | null;
  mergeFields: { token: string; label: string }[];
  smsReady: boolean;
  smsNote: string | null;
}

const AUTOMATION_LABELS: Record<string, string> = {
  no_visit_30: "Nightly: guests who have gone quiet",
  birthday: "Nightly: birthdays",
  high_spender: "Nightly: high spenders",
  tier_upgrade: "Nightly: tier upgrades",
};

const SKIP_LABELS: Record<string, string> = {
  no_consent: "no marketing consent",
  no_address: "no email or phone on file",
  anonymised: "guest anonymised",
  duplicate: "already queued or parked",
};

const EMPTY_FORM = {
  id: "",
  name: "",
  segment: "no_visit_30",
  segmentTag: "",
  channel: "email",
  subject: "",
  message: "",
  automationRule: "",
  active: true,
};

export default function CrmCampaignsTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [segments, setSegments] = useState<SegmentDef[]>([]);
  const [automationRules, setAutomationRules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [savingForm, setSavingForm] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const [queueFor, setQueueFor] = useState<Campaign | null>(null);
  const [sends, setSends] = useState<SendRow[]>([]);
  const [sendCounts, setSendCounts] = useState<Record<string, number>>({});
  const [queueLoading, setQueueLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [openBody, setOpenBody] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/campaigns");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not load campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
      setSegments(data.segments ?? []);
      setAutomationRules(data.automationRules ?? []);
    } catch (err: any) {
      setError(err?.message || "Could not load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM });
    setPreview(null);
    setEditorOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setForm({
      id: c.id,
      name: c.name,
      segment: c.segment,
      segmentTag: c.segmentTag ?? "",
      channel: c.channel,
      subject: c.subject ?? "",
      message: c.message,
      automationRule: c.automationRule ?? "",
      active: c.active,
    });
    setPreview(null);
    setEditorOpen(true);
  };

  const runPreview = async () => {
    setPreviewing(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: form.segment,
          channel: form.channel,
          segmentTag: form.segmentTag || null,
          message: form.message,
          subject: form.subject,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Preview failed");
      setPreview(data);
    } catch (err: any) {
      setError(err?.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const saveCampaign = async () => {
    setSavingForm(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        segment: form.segment,
        segmentTag: form.segmentTag.trim() || null,
        channel: form.channel,
        subject: form.subject.trim() || null,
        message: form.message,
        automationRule: form.automationRule || null,
        active: form.active,
      };
      const res = await fetch(form.id ? `/api/crm/campaigns?id=${form.id}` : "/api/crm/campaigns", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Check the name, segment and message"
        );
      setEditorOpen(false);
      setNotice(form.id ? "Campaign updated." : "Campaign created. Nothing has been sent.");
      load();
    } catch (err: any) {
      setError(err?.message || "Could not save campaign");
    } finally {
      setSavingForm(false);
    }
  };

  const deleteCampaign = async (c: Campaign) => {
    if (!confirm(`Delete "${c.name}"? Sent history is kept.`)) return;
    setBusy(c.id);
    try {
      const res = await fetch(`/api/crm/campaigns?id=${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete");
      setNotice(data.message || "Campaign removed.");
      load();
    } catch (err: any) {
      setError(err?.message || "Could not delete");
    } finally {
      setBusy(null);
    }
  };

  const buildDrafts = async (c: Campaign) => {
    setBusy(c.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/crm/campaigns/run?id=${c.id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not build drafts");
      setNotice(data.message);
      await load();
      openQueue({ ...c, status: "review" });
    } catch (err: any) {
      setError(err?.message || "Could not build drafts");
    } finally {
      setBusy(null);
    }
  };

  const loadQueue = useCallback(async (campaignId: string) => {
    setQueueLoading(true);
    try {
      const res = await fetch(`/api/crm/campaigns/sends?campaignId=${campaignId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load queue");
      setSends(data.sends ?? []);
      setSendCounts(data.counts ?? {});
    } catch (err: any) {
      setError(err?.message || "Could not load queue");
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const openQueue = (c: Campaign) => {
    setQueueFor(c);
    setOpenBody(null);
    loadQueue(c.id);
  };

  const queueAction = async (
    action: "approve" | "unapprove" | "skip" | "delete",
    ids?: string[]
  ) => {
    if (!queueFor) return;
    setBusy("queue");
    setError(null);
    try {
      const res = await fetch("/api/crm/campaigns/sends", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          ids ? { campaignId: queueFor.id, action, ids } : { campaignId: queueFor.id, action, all: true }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Action failed");
      await loadQueue(queueFor.id);
      load();
    } catch (err: any) {
      setError(err?.message || "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const sendApproved = async () => {
    if (!queueFor) return;
    const approved = sendCounts.approved ?? 0;
    if (!confirm(`Send ${approved} message(s) now? This reaches real guests.`)) return;
    setBusy("send");
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/crm/campaigns/sends?campaignId=${queueFor.id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Send failed");
      setNotice(data.message);
      await loadQueue(queueFor.id);
      load();
    } catch (err: any) {
      setError(err?.message || "Send failed");
    } finally {
      setBusy(null);
    }
  };

  const segmentDef = segments.find((s) => s.key === form.segment);
  const insertToken = (token: string) => setForm((f) => ({ ...f, message: f.message + token }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 space-y-3">
      <div className="flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
        <p className="text-[11px] leading-snug text-indigo-900">
          Campaigns and nightly automations only queue drafts. Nothing leaves the building until you
          tick the messages and press send. Guests without marketing consent are skipped with a
          reason, never quietly dropped.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          <p className="text-xs text-emerald-800">{notice}</p>
        </div>
      )}

      <Button onClick={openNew} className="h-9 w-full text-xs">
        <Plus className="mr-1.5 h-3.5 w-3.5" /> New campaign
      </Button>

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <Mail className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          <p className="text-xs font-medium text-slate-700">No campaigns yet</p>
          <p className="mt-1 text-[11px] text-slate-500">
            Start with the guests who have gone quiet, or a birthday note.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const queued = (c.sendCounts.draft ?? 0) + (c.sendCounts.approved ?? 0);
            return (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {c.channel === "sms" ? (
                        <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      ) : (
                        <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                      )}
                      <span className="truncate text-sm font-semibold text-slate-900">{c.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge variant="outline" className="text-[9px]">
                        {segments.find((s) => s.key === c.segment)?.label ?? c.segment}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px]",
                          c.status === "sent" && "border-emerald-300 text-emerald-700",
                          c.status === "review" && "border-amber-300 text-amber-700"
                        )}
                      >
                        {c.status}
                      </Badge>
                      {c.automationRule && (
                        <Badge variant="outline" className="border-indigo-300 text-[9px] text-indigo-700">
                          {c.active ? "automation on" : "automation off"}
                        </Badge>
                      )}
                    </div>
                    {c.automationRule && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {AUTOMATION_LABELS[c.automationRule] ?? c.automationRule}
                        {c.lastRunAt
                          ? ` · last built ${new Date(c.lastRunAt).toLocaleDateString()}`
                          : " · not run yet"}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500"
                      aria-label="Edit campaign"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCampaign(c)}
                      disabled={busy === c.id}
                      className="rounded-lg border border-slate-200 p-1.5 text-red-500"
                      aria-label="Delete campaign"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span>{queued} awaiting review</span>
                  <span>·</span>
                  <span>{c.sendCounts.sent ?? 0} sent</span>
                  <span>·</span>
                  <span>{c.sendCounts.skipped ?? 0} skipped</span>
                </div>

                <div className="mt-2 flex gap-2">
                  <Button
                    onClick={() => buildDrafts(c)}
                    disabled={busy === c.id}
                    variant="outline"
                    className="h-8 flex-1 text-[11px]"
                  >
                    {busy === c.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="mr-1 h-3 w-3" />
                    )}
                    Build drafts
                  </Button>
                  <Button
                    onClick={() => openQueue(c)}
                    variant="outline"
                    className="h-8 flex-1 text-[11px]"
                  >
                    <Eye className="mr-1 h-3 w-3" /> Review ({queued})
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {form.id ? "Edit campaign" : "New campaign"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wide text-slate-500">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="We miss you"
                className="mt-1 h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">Who</Label>
                <Select
                  value={form.segment}
                  onValueChange={(v) => setForm({ ...form, segment: v })}
                >
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((s) => (
                      <SelectItem key={s.key} value={s.key} className="text-xs">
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">Channel</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email" className="text-xs">
                      Email
                    </SelectItem>
                    <SelectItem value="sms" className="text-xs">
                      SMS
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {segmentDef?.description && (
              <p className="text-[10px] text-slate-500">{segmentDef.description}</p>
            )}

            {segmentDef?.needsTag && (
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">Tag</Label>
                <Input
                  value={form.segmentTag}
                  onChange={(e) => setForm({ ...form, segmentTag: e.target.value })}
                  placeholder="VIP"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            )}

            {form.channel === "email" && (
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="It has been a while, {{first_name}}"
                  className="mt-1 h-9 text-sm"
                />
              </div>
            )}

            <div>
              <Label className="text-[10px] uppercase tracking-wide text-slate-500">Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={6}
                placeholder={"Hi {{first_name}},\n\nWe have not seen you at {{venue}} since {{last_visit}}."}
                className="mt-1 text-xs"
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(preview?.mergeFields ?? [
                  { token: "{{first_name}}", label: "First name" },
                  { token: "{{name}}", label: "Full name" },
                  { token: "{{venue}}", label: "Venue" },
                  { token: "{{tier}}", label: "Tier" },
                  { token: "{{points}}", label: "Points" },
                  { token: "{{visits}}", label: "Visits" },
                  { token: "{{total_spend}}", label: "Lifetime spend" },
                  { token: "{{last_visit}}", label: "Last visit" },
                  { token: "{{favourite}}", label: "Favourite dish" },
                ]).map((f) => (
                  <button
                    key={f.token}
                    type="button"
                    onClick={() => insertToken(f.token)}
                    title={f.label}
                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] text-slate-600"
                  >
                    {f.token}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] uppercase tracking-wide text-slate-500">
                  Run nightly as an automation
                </Label>
                <Switch
                  checked={Boolean(form.automationRule)}
                  onCheckedChange={(v) =>
                    setForm({ ...form, automationRule: v ? automationRules[0] ?? "no_visit_30" : "" })
                  }
                />
              </div>
              {form.automationRule && (
                <>
                  <Select
                    value={form.automationRule}
                    onValueChange={(v) => setForm({ ...form, automationRule: v })}
                  >
                    <SelectTrigger className="mt-2 h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {automationRules.map((r) => (
                        <SelectItem key={r} value={r} className="text-xs">
                          {AUTOMATION_LABELS[r] ?? r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
                    The nightly run adds drafts to the review queue. It never sends. One automation per
                    rule.
                  </p>
                </>
              )}
            </div>

            <Button
              onClick={runPreview}
              disabled={previewing}
              variant="outline"
              className="h-9 w-full text-xs"
            >
              {previewing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="mr-1.5 h-3.5 w-3.5" />
              )}
              Preview who matches
            </Button>

            {preview && (
              <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-900">{preview.matched} match</span>
                  <span className="text-slate-400">|</span>
                  <span className="font-semibold text-emerald-700">
                    {preview.contactable} contactable
                  </span>
                </div>
                {Object.keys(preview.bySkipReason).length > 0 && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Skipped:{" "}
                    {Object.entries(preview.bySkipReason)
                      .map(([k, v]) => `${v} ${SKIP_LABELS[k] ?? k}`)
                      .join(", ")}
                  </p>
                )}
                {preview.smsNote && (
                  <p className="mt-1.5 rounded-lg bg-amber-50 p-2 text-[10px] leading-snug text-amber-900">
                    {preview.smsNote}
                  </p>
                )}
                {preview.rendered && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400">
                      As {preview.rendered.guest ?? "a sample guest"} would see it
                    </p>
                    {preview.rendered.subject && (
                      <p className="mt-1 text-[11px] font-semibold text-slate-900">
                        {preview.rendered.subject}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-[11px] text-slate-700">
                      {preview.rendered.body}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} className="h-9 text-xs">
              Cancel
            </Button>
            <Button
              onClick={saveCampaign}
              disabled={savingForm || !form.name.trim() || !form.message.trim()}
              className="h-9 text-xs"
            >
              {savingForm && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {form.id ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review queue */}
      <Dialog open={Boolean(queueFor)} onOpenChange={(o) => !o && setQueueFor(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">Review queue: {queueFor?.name}</DialogTitle>
          </DialogHeader>

          {queueLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {(["draft", "approved", "sent", "skipped"] as const).map((s) => (
                  <div key={s} className="rounded-xl bg-slate-50 p-2">
                    <div className="text-sm font-bold text-slate-900">{sendCounts[s] ?? 0}</div>
                    <div className="text-[9px] text-slate-500">{s}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => queueAction("approve")}
                  disabled={busy === "queue" || !(sendCounts.draft ?? 0)}
                  variant="outline"
                  className="h-8 flex-1 text-[11px]"
                >
                  <Check className="mr-1 h-3 w-3" /> Approve all
                </Button>
                <Button
                  onClick={sendApproved}
                  disabled={busy === "send" || !(sendCounts.approved ?? 0)}
                  className="h-8 flex-1 text-[11px]"
                >
                  {busy === "send" ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  Send {sendCounts.approved ?? 0}
                </Button>
              </div>

              {sends.length === 0 ? (
                <p className="py-4 text-center text-[11px] text-slate-500">
                  Nothing queued. Press "Build drafts" to fill this list.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {sends.map((s) => (
                    <div key={s.id} className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900">
                          {s.customer?.name ?? "Guest"}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex-shrink-0 text-[9px]",
                            s.status === "sent" && "border-emerald-300 text-emerald-700",
                            s.status === "approved" && "border-indigo-300 text-indigo-700",
                            s.status === "skipped" && "border-slate-300 text-slate-500",
                            s.status === "failed" && "border-red-300 text-red-700"
                          )}
                        >
                          {s.status}
                        </Badge>
                        {s.status === "draft" && (
                          <button
                            onClick={() => queueAction("approve", [s.id])}
                            className="rounded-lg border border-slate-200 p-1 text-emerald-600"
                            aria-label="Approve"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                        {s.status === "approved" && (
                          <button
                            onClick={() => queueAction("unapprove", [s.id])}
                            className="rounded-lg border border-slate-200 p-1 text-slate-500"
                            aria-label="Unapprove"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <button
                        onClick={() => setOpenBody(openBody === s.id ? null : s.id)}
                        className="mt-0.5 block w-full truncate text-left text-[10px] text-slate-500"
                      >
                        {s.toAddress ?? SKIP_LABELS[s.skipReason ?? ""] ?? "no address"}
                        {s.subject ? ` · ${s.subject}` : ""}
                      </button>
                      {openBody === s.id && (
                        <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[10px] text-slate-700">
                          {s.body}
                        </p>
                      )}
                      {s.errorMessage && (
                        <p className="mt-0.5 text-[10px] text-red-600">{s.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
