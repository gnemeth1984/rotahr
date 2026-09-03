"use client";

/**
 * Admin -> Founding tab.
 *
 * Three jobs: see how many of the 20 spots are gone, work the application
 * queue, and grant a spot to a real business.
 *
 * Granting needs a business that already exists, because a grant just flips
 * lsPlan to pro and pushes trialEndsAt out 3 months on that business, and sets
 * foundingMember so that when the term lapses they land in the free rota tier
 * instead of read-only (lib/billing/access.ts, mode "rota"). So the
 * flow is: applicant signs up normally, then you grant their business here.
 * Prospect pages (marketing pages for venues we don't run) are hidden from the
 * picker - they have no users, so granting one would do nothing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Award,
  Search,
  X,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";

interface ApplicationRow {
  id: string;
  venueName: string;
  contactName: string;
  email: string;
  phone: string | null;
  venueType: string | null;
  staffCount: number | null;
  currentTool: string | null;
  notes: string | null;
  status: string;
  adminNote: string | null;
  grantedBusinessId: string | null;
  createdAt: string;
}

interface MemberRow {
  id: string;
  name: string;
  foundingGrantedAt: string | null;
  trialEndsAt: string | null;
  lsPlan: string | null;
  lsStatus: string | null;
  createdAt: string;
  _count: { users: number; employees: number };
}

interface BusinessRow {
  id: string;
  name: string;
  users: number;
  employees: number;
  lsPlan: string;
  lsStatus: string;
  isProspect: boolean;
}

const STATUSES = ["new", "contacted", "granted", "declined", "withdrawn"];

const STATUS_STYLE: Record<string, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  granted: "bg-emerald-100 text-emerald-700",
  declined: "bg-slate-100 text-slate-500",
  withdrawn: "bg-slate-100 text-slate-500",
};

function fmtDate(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("en-IE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function FoundingTab() {
  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [total, setTotal] = useState(20);
  const [taken, setTaken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  // grant picker
  const [picking, setPicking] = useState<ApplicationRow | null | "blank">(null);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [bizLoading, setBizLoading] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/founding");
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not load.");
        return;
      }
      setApps(data.applications ?? []);
      setMembers(data.members ?? []);
      setTotal(data.total ?? 20);
      setTaken(data.taken ?? 0);
    } catch {
      setErr("Could not load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPicker = useCallback(
    async (app: ApplicationRow | "blank") => {
      setPicking(app);
      setQuery(app === "blank" ? "" : app.venueName);
      if (businesses.length > 0) return;
      setBizLoading(true);
      try {
        const res = await fetch("/api/admin/businesses");
        const data = await res.json();
        setBusinesses(
          (data.businesses ?? []).filter((b: BusinessRow) => !b.isProspect),
        );
      } finally {
        setBizLoading(false);
      }
    },
    [businesses.length],
  );

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/founding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Failed.");
        return;
      }
      setApps((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...data.application } : a)),
      );
    } finally {
      setBusy(null);
    }
  }

  async function grant(businessId: string) {
    const app = picking === "blank" ? null : picking;
    setBusy(businessId);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/founding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          applicationId: app?.id ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not grant that.");
        return;
      }
      setMsg(
        `${data.business?.name ?? "Business"} is a founding member. Pro is free until ${fmtDate(data.business?.trialEndsAt ?? null)}.`,
      );
      setPicking(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function revoke(businessId: string, name: string) {
    if (
      !window.confirm(
        `Remove ${name} from the founding programme?\n\nThis only clears the founding flag. Their plan and free-term date are left exactly as they are, so nothing changes today. It does mean that when their term lapses they drop to read-only like any other trial, instead of keeping the free rota tier.`,
      )
    )
      return;
    setBusy(businessId);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/founding", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Could not revoke.");
        return;
      }
      setMsg(data.note || "Done.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  const visible = useMemo(
    () => (filter === "all" ? apps : apps.filter((a) => a.status === filter)),
    [apps, filter],
  );

  const memberIds = useMemo(
    () => new Set(members.map((m) => m.id)),
    [members],
  );

  const pickList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? businesses.filter((b) => b.name.toLowerCase().includes(q))
      : businesses;
    return list.slice(0, 40);
  }, [businesses, query]);

  const remaining = Math.max(0, total - taken);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Founding members
          </h2>
          <p className="text-sm text-slate-500">
            {taken} of {total} spots granted &middot; {remaining} left &middot;
            Pro free for 3 months, then the free rota tier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openPicker("blank")}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Award className="h-4 w-4" />
            Grant a spot
          </button>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      {/* ── Spot counter bar ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Spots</span>
          <span className="text-slate-500">
            {taken}/{total}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, (taken / Math.max(1, total)) * 100)}%`,
              background: "linear-gradient(135deg, #F97316, #EC4899)",
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          The public /founding page reads this same number. If it hits {total}{" "}
          the page switches to a waiting list on its own.
        </p>
      </div>

      {/* ── Applications ── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Applications ({apps.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {["all", ...STATUSES].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-md px-2 py-1 text-xs capitalize ${
                  filter === s
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {s}
                {s !== "all" && (
                  <span className="ml-1 opacity-60">
                    {apps.filter((a) => a.status === s).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading
          </div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            {apps.length === 0
              ? "No applications yet. They arrive from the form on /founding and also email FOUNDING_NOTIFY_TO."
              : "Nothing with that status."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((a) => (
              <li key={a.id} className="px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {a.venueName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                          STATUS_STYLE[a.status] ?? "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {a.status}
                      </span>
                      {a.venueType && (
                        <span className="text-xs text-slate-500">
                          {a.venueType}
                        </span>
                      )}
                      {a.staffCount !== null && a.staffCount !== undefined && (
                        <span className="text-xs text-slate-500">
                          {a.staffCount} staff
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {a.contactName}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <a
                        href={`mailto:${a.email}`}
                        className="inline-flex items-center gap-1 hover:text-slate-800"
                      >
                        <Mail className="h-3 w-3" />
                        {a.email}
                      </a>
                      {a.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {a.phone}
                        </span>
                      )}
                      <span>{fmtDate(a.createdAt)}</span>
                    </div>
                    {a.currentTool && (
                      <p className="mt-2 text-xs text-slate-500">
                        Uses now: {a.currentTool}
                      </p>
                    )}
                    {a.notes && (
                      <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-slate-700">
                        &ldquo;{a.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={a.status}
                      disabled={busy === a.id}
                      onChange={(e) => patch(a.id, { status: e.target.value })}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs capitalize text-slate-700"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="capitalize">
                          {s}
                        </option>
                      ))}
                    </select>
                    {a.grantedBusinessId ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                        <Award className="h-3.5 w-3.5" /> Granted
                      </span>
                    ) : (
                      <button
                        onClick={() => openPicker(a)}
                        disabled={busy === a.id || remaining === 0}
                        className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                        title={
                          remaining === 0
                            ? "All spots are gone"
                            : "Grant this applicant a spot"
                        }
                      >
                        Grant
                      </button>
                    )}
                    {busy === a.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    )}
                  </div>
                </div>

                <input
                  defaultValue={a.adminNote ?? ""}
                  placeholder="Private note (call outcome, what they need)"
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (a.adminNote ?? "")) patch(a.id, { adminNote: v });
                  }}
                  className="mt-3 w-full rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-700 placeholder:text-slate-400"
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Current members ── */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            Founding members ({members.length})
          </h3>
        </div>
        {members.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            Nobody yet. Grant a spot to a business that has already signed up.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Business</th>
                  <th className="px-4 py-2">Granted</th>
                  <th className="px-4 py-2">Free until</th>
                  <th className="px-4 py-2">Plan</th>
                  <th className="px-4 py-2 text-right">Staff</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {m.name}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {fmtDate(m.foundingGrantedAt)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {fmtDate(m.trialEndsAt)}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {m.lsPlan ?? "none"}
                      {m.lsStatus && m.lsStatus !== "none" && (
                        <span className="ml-1 text-xs text-slate-400">
                          ({m.lsStatus})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {m._count?.employees ?? 0}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => revoke(m.id, m.name)}
                        disabled={busy === m.id}
                        className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-40"
                      >
                        {busy === m.id ? "..." : "Revoke"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-3 text-xs text-slate-500">
          Revoking only clears the founding flag. The plan and free-term date
          stay put, so no live venue changes today &mdash; but they lose the
          free rota tier when their term lapses.
        </p>
      </div>

      {/* ── Grant picker ── */}
      {picking !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-16">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Grant a founding spot
                </h3>
                <p className="text-xs text-slate-500">
                  {picking === "blank"
                    ? "Pick the business to put on Pro free for 3 months."
                    : `For ${picking.venueName} (${picking.email}). Pick their business.`}
                </p>
              </div>
              <button
                onClick={() => setPicking(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-4 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search businesses"
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
                  autoFocus
                />
              </div>

              {bizLoading ? (
                <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading
                  businesses
                </div>
              ) : (
                <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {pickList.length === 0 && (
                    <li className="py-6 text-sm text-slate-500">
                      No match. They need to sign up at /auth/signup first, then
                      grant here.
                    </li>
                  )}
                  {pickList.map((b) => {
                    const already = memberIds.has(b.id);
                    return (
                      <li
                        key={b.id}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {b.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {b.users} users &middot; {b.employees} staff &middot;{" "}
                            {b.lsPlan}
                          </p>
                        </div>
                        <button
                          onClick={() => grant(b.id)}
                          disabled={busy === b.id || already}
                          className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40"
                        >
                          {already
                            ? "Member"
                            : busy === b.id
                              ? "Granting"
                              : "Grant"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="mt-3 text-xs text-slate-500">
                Sets plan to Pro and pushes the trial end date out 3 months.
                After that they keep the free rota tier, not read-only. Nothing
                is charged and nothing touches Lemon Squeezy.
              </p>
              <a
                href="/founding"
                target="_blank"
                rel="noopener"
                className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
              >
                <ExternalLink className="h-3 w-3" /> Open the public page
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
