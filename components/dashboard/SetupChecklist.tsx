"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Users, Calendar, Send, Upload, X, Loader2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Step {
  key: "staff" | "rota" | "invite";
  done: boolean;
  doneAt: string | null;
}

interface Progress {
  businessId: string;
  staffCount: number;
  shiftCount: number;
  publishedShiftCount: number;
  invitedCount: number;
  joinedCount: number;
  awaitingInvite: number;
  steps: Step[];
  completed: number;
  allDone: boolean;
}

interface Pending {
  id: string;
  name: string;
  email: string;
}

const dismissKey = (businessId: string) => `rotahr_setup_hidden_${businessId}`;

/**
 * First-run setup checklist on the dashboard: add staff → publish a rota →
 * invite the team. Computed server-side from real data (GET /api/activation),
 * so it is right for accounts that set things up before it existed and it
 * disappears on its own once all three are done.
 */
export function SetupChecklist() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [hidden, setHidden] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteNote, setInviteNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmInvite, setConfirmInvite] = useState(false);
  // Set once the checklist has been seen incomplete in this visit, so finishing
  // the last step shows a "done" card instead of the box just vanishing.
  const [seenIncomplete, setSeenIncomplete] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/activation");
      if (!res.ok) return;
      const j = await res.json();
      setProgress(j.progress);
      if (!j.progress.allDone) setSeenIncomplete(true);
      setPending(j.awaitingInvite ?? []);
      try {
        setHidden(localStorage.getItem(dismissKey(j.progress.businessId)) === "1");
      } catch {
        /* private mode */
      }
    } catch {
      /* never break the dashboard */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!progress || hidden) return null;
  if (progress.allDone) {
    if (!seenIncomplete) return null;
    return (
      <Card className="border-emerald-200 bg-emerald-50/60" data-testid="setup-done">
        <CardContent className="p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">Your first week is set up</p>
            <p className="text-xs text-slate-600 mt-0.5">
              {inviteNote?.text ? `${inviteNote.text} ` : ""}Staff will see their shifts as soon as they log in.
            </p>
          </div>
          <button onClick={() => setHidden(true)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </CardContent>
      </Card>
    );
  }

  const step = (k: Step["key"]) => progress.steps.find((s) => s.key === k)!;
  const pct = Math.round((progress.completed / progress.steps.length) * 100);
  const drafts = progress.shiftCount - progress.publishedShiftCount;

  async function inviteAll() {
    setInviting(true);
    setInviteNote(null);
    let sent = 0;
    const failed: string[] = [];
    for (const p of pending) {
      try {
        const r = await fetch(`/api/employee/${p.id}/invite`, { method: "POST" });
        if (r.ok) sent++;
        else failed.push(p.name);
      } catch {
        failed.push(p.name);
      }
    }
    setInviting(false);
    setConfirmInvite(false);
    setInviteNote(
      failed.length
        ? { ok: false, text: `${sent} invited. Couldn't invite: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}` }
        : { ok: true, text: `${sent} invite${sent === 1 ? "" : "s"} sent. Each link expires in 7 days.` },
    );
    load();
  }

  function hide() {
    try {
      localStorage.setItem(dismissKey(progress!.businessId), "1");
    } catch {
      /* ignore */
    }
    setHidden(true);
  }

  const rows: {
    key: Step["key"];
    icon: React.ElementType;
    title: string;
    body: string;
    action: React.ReactNode;
  }[] = [
    {
      key: "staff",
      icon: Users,
      title: "Add your staff",
      body: step("staff").done
        ? `${progress.staffCount} on the team.`
        : "Names and emails are enough to start. Got a spreadsheet? Import it in one go.",
      action: step("staff").done ? null : (
        <div className="flex flex-wrap gap-2">
          <Link href="/employees">
            <Button size="sm" className="gap-1.5" data-testid="cta-add-staff">
              <Users className="h-3.5 w-3.5" /> Add staff
            </Button>
          </Link>
          <Link href="/employees?import=1">
            <Button size="sm" variant="outline" className="gap-1.5" data-testid="cta-import">
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
          </Link>
        </div>
      ),
    },
    {
      key: "rota",
      icon: Calendar,
      title: "Publish your first rota",
      body: step("rota").done
        ? `${progress.publishedShiftCount} shift${progress.publishedShiftCount === 1 ? "" : "s"} published.`
        : drafts > 0
          ? `You have ${drafts} draft shift${drafts === 1 ? "" : "s"}. Publish them so your team can see the week.`
          : "Drag shifts onto the week, then hit Publish. Staff only see published shifts.",
      action: step("rota").done ? null : (
        <Link href="/rota">
          <Button size="sm" variant={step("staff").done ? "default" : "outline"} className="gap-1.5" data-testid="cta-rota">
            <Calendar className="h-3.5 w-3.5" /> {drafts > 0 ? "Review and publish" : "Open the rota"}
          </Button>
        </Link>
      ),
    },
    {
      key: "invite",
      icon: Send,
      title: "Invite your team",
      body: step("invite").done
        ? `${progress.invitedCount} invited, ${progress.joinedCount} logged in.`
        : pending.length > 0
          ? `${pending.length} ${pending.length === 1 ? "person hasn't" : "people haven't"} got a login yet. They'll see their shifts, swap and request time off from their phone.`
          : "Once staff are added, invite them so they get their shifts on their phone.",
      action:
        step("invite").done || pending.length === 0 ? null : confirmInvite ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-600">
              Email {pending.length} invite{pending.length === 1 ? "" : "s"} now?
            </span>
            <Button size="sm" onClick={inviteAll} disabled={inviting} className="gap-1.5" data-testid="cta-invite-confirm">
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmInvite(false)} disabled={inviting}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={step("rota").done ? "default" : "outline"}
              className="gap-1.5"
              onClick={() => setConfirmInvite(true)}
              data-testid="cta-invite"
            >
              <Send className="h-3.5 w-3.5" /> Invite {pending.length === 1 ? pending[0].name.split(" ")[0] : `all ${pending.length}`}
            </Button>
            <Link href="/employees">
              <Button size="sm" variant="ghost" className="gap-1 text-xs">
                Choose who <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        ),
    },
  ];

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white" data-testid="setup-checklist">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-semibold text-slate-900">Get your first week running</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {progress.completed} of {progress.steps.length} done · about 10 minutes
            </p>
          </div>
          <button
            onClick={hide}
            className="text-slate-400 hover:text-slate-600 p-1 -m-1 shrink-0"
            aria-label="Hide setup checklist"
            data-testid="checklist-hide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-1.5 bg-emerald-100 rounded-full mt-3 overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%` }} />
        </div>

        <ol className="mt-4 space-y-3">
          {rows.map((r, i) => {
            const done = step(r.key).done;
            return (
              <li
                key={r.key}
                className={`flex gap-3 rounded-lg p-3 ${done ? "bg-white/50" : "bg-white border border-slate-200"}`}
                data-testid={`step-${r.key}`}
                data-done={done ? "1" : "0"}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${done ? "text-slate-500 line-through decoration-slate-300" : "text-slate-900"}`}>
                    {i + 1}. {r.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{r.body}</p>
                  {r.action && <div className="mt-2">{r.action}</div>}
                </div>
              </li>
            );
          })}
        </ol>

        {inviteNote && (
          <p
            className={`text-xs mt-3 rounded-md px-3 py-2 ${inviteNote.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
            data-testid="invite-note"
          >
            {inviteNote.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
