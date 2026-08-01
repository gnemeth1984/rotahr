"use client";

// Admin-only: build a public venue page (rotahr.com/v/<slug>) for a venue that
// isn't a Rotahr customer yet. Paste a Google Maps / Facebook / website URL, AI
// drafts the details, Gabor reviews every field, then saves.
//
// Nothing here invents facts — see lib/ai/venue-extract.ts. Anything the source
// page didn't state comes back blank on purpose.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Sparkles,
  ExternalLink,
  Trash2,
  Globe,
  EyeOff,
  Eye,
  AlertTriangle,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Hours {
  day: number;
  closed: boolean;
  open: string;
  close: string;
}

interface VenueRow {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  noIndex: boolean;
  prospect: boolean;
  address: string | null;
  phone: string | null;
  userCount: number;
  indexable: boolean;
  createdAt: string;
}

interface Draft {
  name: string;
  slug: string;
  tagline: string;
  about: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  venueType: string;
  cuisine: string;
  geoLat: string;
  geoLng: string;
  openingHours: Hours[] | null;
}

const BLANK: Draft = {
  name: "",
  slug: "",
  tagline: "",
  about: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  facebook: "",
  instagram: "",
  venueType: "",
  cuisine: "",
  geoLat: "",
  geoLng: "",
  openingHours: null,
};

function emptyHours(): Hours[] {
  return Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: "12:00", close: "23:00" }));
}

export default function VenuePages() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceUrl, setSourceUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [indexNow, setIndexNow] = useState(true);
  const [filter, setFilter] = useState<"all" | "prospect" | "customer">("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/blog-comments/venues");
    if (res.ok) setVenues((await res.json()).venues);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function extract() {
    const url = sourceUrl.trim();
    if (!url) return;
    setExtracting(true);
    setNotes([]);
    setSources([]);
    try {
      const res = await fetch("/api/blog-comments/venues/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't read that page");
        setDraft({ ...BLANK, website: url });
        return;
      }
      const v = data.venue;
      setDraft({
        name: v.name || "",
        slug: data.suggestedSlug || "",
        tagline: v.tagline || "",
        about: v.about || "",
        address: v.address || "",
        phone: v.phone || "",
        email: v.email || "",
        website: v.website || "",
        facebook: v.facebook || "",
        instagram: v.instagram || "",
        venueType: v.venueType || "",
        cuisine: v.cuisine || "",
        geoLat: v.geoLat != null ? String(v.geoLat) : "",
        geoLng: v.geoLng != null ? String(v.geoLng) : "",
        openingHours: v.openingHours?.length ? v.openingHours : null,
      });
      setNotes(v.notesForReview || []);
      setSources(v.sourcesUsed || []);
      toast.success("Details pulled in — check every field before saving");
    } catch {
      toast.error("Couldn't read that page");
    } finally {
      setExtracting(false);
    }
  }

  function setField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setHour(day: number, patch: Partial<Hours>) {
    setDraft((d) => {
      if (!d) return d;
      const hours = (d.openingHours ?? emptyHours()).map((h) => (h.day === day ? { ...h, ...patch } : h));
      return { ...d, openingHours: hours };
    });
  }

  async function save() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.slug.trim()) {
      toast.error("Name and page address are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/blog-comments/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          tagline: draft.tagline.trim() || null,
          about: draft.about.trim() || null,
          address: draft.address.trim() || null,
          phone: draft.phone.trim() || null,
          email: draft.email.trim() || null,
          website: draft.website.trim() || null,
          facebook: draft.facebook.trim() || null,
          instagram: draft.instagram.trim() || null,
          venueType: draft.venueType.trim() || null,
          cuisine: draft.cuisine.trim() || null,
          geoLat: draft.geoLat ? Number(draft.geoLat) : null,
          geoLng: draft.geoLng ? Number(draft.geoLng) : null,
          openingHours: draft.openingHours,
          noIndex: !indexNow,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Couldn't create that page");
        return;
      }
      toast.success(`Page live at /v/${data.slug}`);
      setDraft(null);
      setNotes([]);
      setSources([]);
      setSourceUrl("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, patch: { enabled?: boolean; noIndex?: boolean }) {
    const res = await fetch("/api/blog-comments/venues", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (res.ok) load();
    else toast.error("Couldn't update that page");
  }

  async function remove(v: VenueRow) {
    if (!confirm(`Delete the page for ${v.name}? This removes the venue record entirely.`)) return;
    const res = await fetch(`/api/blog-comments/venues?id=${v.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success("Page deleted");
      load();
    } else {
      toast.error(data.error || "Couldn't delete that page");
    }
  }

  const shown = venues.filter((v) =>
    filter === "all" ? true : filter === "prospect" ? v.prospect : !v.prospect
  );
  const liveCount = venues.filter((v) => v.enabled && !v.noIndex).length;

  return (
    <div className="mt-12 border-t border-slate-200 pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Store className="h-5 w-5" /> Venue pages
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Paste a Google Maps, Facebook or website URL and AI drafts a public page at
            rotahr.com/v/&lt;address&gt;. It only fills in what the source page actually says — check
            every field before you save, these go live under the venue&apos;s real name.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
            <div className="text-lg font-semibold">{venues.length}</div>
            <div className="text-slate-500">pages</div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center">
            <div className="text-lg font-semibold text-green-700">{liveCount}</div>
            <div className="text-slate-500">indexed</div>
          </div>
        </div>
      </div>

      {/* URL input */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Venue website, Facebook page or Google Maps link"
          className="max-w-xl flex-1 bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") extract();
          }}
        />
        <Button onClick={extract} disabled={extracting || !sourceUrl.trim()}>
          {extracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Pull details
        </Button>
        <Button
          variant="outline"
          className="border-slate-200 bg-white"
          onClick={() => {
            setDraft({ ...BLANK });
            setNotes([]);
            setSources([]);
          }}
        >
          Enter manually
        </Button>
      </div>

      {/* Review form */}
      {draft ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          {sources.length ? (
            <div className="mb-3 text-xs text-slate-500">
              Pulled from: {sources.join(", ")}
            </div>
          ) : null}

          {notes.length ? (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Check these before saving
              </div>
              <ul className="list-inside list-disc space-y-1">
                {notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Venue name" value={draft.name} onChange={(v) => setField("name", v)} />
            <Field
              label="Page address"
              prefix="rotahr.com/v/"
              value={draft.slug}
              onChange={(v) => setField("slug", v.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            />
            <Field label="Tagline" value={draft.tagline} onChange={(v) => setField("tagline", v)} />
            <Field label="Address" value={draft.address} onChange={(v) => setField("address", v)} />
            <Field label="Phone" value={draft.phone} onChange={(v) => setField("phone", v)} />
            <Field label="Email" value={draft.email} onChange={(v) => setField("email", v)} />
            <Field label="Website" value={draft.website} onChange={(v) => setField("website", v)} />
            <Field label="Facebook" value={draft.facebook} onChange={(v) => setField("facebook", v)} />
            <Field label="Instagram" value={draft.instagram} onChange={(v) => setField("instagram", v)} />
            <Field
              label="Venue type"
              placeholder="restaurant / cafe / bar / pub / hotel"
              value={draft.venueType}
              onChange={(v) => setField("venueType", v)}
            />
            <Field label="Cuisine" value={draft.cuisine} onChange={(v) => setField("cuisine", v)} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Latitude" value={draft.geoLat} onChange={(v) => setField("geoLat", v)} />
              <Field label="Longitude" value={draft.geoLng} onChange={(v) => setField("geoLng", v)} />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">About</label>
            <Textarea
              value={draft.about}
              onChange={(e) => setField("about", e.target.value)}
              rows={4}
              className="bg-white"
              placeholder="Only facts you can stand over — no invented menu, prices or claims."
            />
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Opening hours</label>
              {!draft.openingHours ? (
                <Button size="sm" variant="outline" onClick={() => setField("openingHours", emptyHours())}>
                  Add hours
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setField("openingHours", null)}>
                  Clear
                </Button>
              )}
            </div>
            {draft.openingHours ? (
              <div className="space-y-1.5">
                {draft.openingHours.map((h) => (
                  <div key={h.day} className="flex items-center gap-2 text-sm">
                    <span className="w-10 text-slate-500">{DAY_SHORT[h.day]}</span>
                    <label className="flex items-center gap-1 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={h.closed}
                        onChange={(e) => setHour(h.day, { closed: e.target.checked })}
                      />
                      closed
                    </label>
                    {!h.closed ? (
                      <>
                        <Input
                          type="time"
                          value={h.open}
                          onChange={(e) => setHour(h.day, { open: e.target.value })}
                          className="h-8 w-28 bg-white"
                        />
                        <span className="text-slate-400">to</span>
                        <Input
                          type="time"
                          value={h.close}
                          onChange={(e) => setHour(h.day, { close: e.target.value })}
                          className="h-8 w-28 bg-white"
                        />
                      </>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                No hours found. A page with no address and no hours stays out of Google.
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={indexNow} onChange={(e) => setIndexNow(e.target.checked)} />
              Let Google index this page straight away
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create page
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Existing pages */}
      <div className="mt-8">
        <div className="mb-3 flex gap-2 text-sm">
          {(["all", "prospect", "customer"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 ${
                filter === f ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {f === "all" ? "All" : f === "prospect" ? "Prospects" : "Customers"}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-400">No pages yet.</p>
        ) : (
          <div className="space-y-2">
            {shown.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{v.name}</span>
                    {v.prospect ? (
                      <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-700">
                        prospect
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        customer
                      </Badge>
                    )}
                    {!v.enabled ? (
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500">
                        off
                      </Badge>
                    ) : v.noIndex ? (
                      <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
                        hidden from Google
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                        indexed
                      </Badge>
                    )}
                    {!v.indexable ? (
                      <span className="text-xs text-slate-400">needs address or hours</span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    /v/{v.slug}
                    {v.address ? ` · ${v.address}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={`/v/${v.slug}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost" title="Open page">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    title={v.noIndex ? "Allow Google to index" : "Hide from Google"}
                    onClick={() => toggle(v.id, { noIndex: !v.noIndex })}
                  >
                    {v.noIndex ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title={v.enabled ? "Take page offline" : "Put page live"}
                    onClick={() => toggle(v.id, { enabled: !v.enabled })}
                  >
                    <Globe className={`h-4 w-4 ${v.enabled ? "text-green-600" : "text-slate-400"}`} />
                  </Button>
                  {v.prospect && v.userCount === 0 ? (
                    <Button size="sm" variant="ghost" title="Delete page" onClick={() => remove(v)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-1">
        {prefix ? <span className="text-xs text-slate-400">{prefix}</span> : null}
        <Input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="bg-white"
        />
      </div>
    </div>
  );
}
