// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  Building2, MapPin, Phone, Mail, Globe, Star, Plus, Edit2, Trash2,
  Loader2, ChevronDown, ChevronRight, Info, Utensils, Wine, Settings2,
  ClipboardList, CheckSquare, Square, X, Save, Coffee, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { UserRole as Role } from "@/types/roles";

type Venue = {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  geoLat?: number | null;
  geoLng?: number | null;
  geoRadius: number;
  timezone: string;
  isDefault: boolean;
  active: boolean;
  capacity?: number | null;
  venueType?: string | null;
  cuisine?: string | null;
  foodInfo?: string | null;
  drinksInfo?: string | null;
  equipment?: string | null;
  notes?: string | null;
  checklists?: Checklist[];
};

type ChecklistItem = { id: string; label: string; sortOrder: number };
type Checklist = { id: string; title: string; category: string; items: ChecklistItem[] };

const VENUE_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "bar", label: "Bar / Pub" },
  { value: "hotel", label: "Hotel" },
  { value: "cafe", label: "Café" },
  { value: "nightclub", label: "Nightclub" },
  { value: "other", label: "Other" },
];

const CHECKLIST_CATEGORIES = [
  { value: "opening", label: "Opening" },
  { value: "closing", label: "Closing" },
  { value: "cleaning", label: "Cleaning" },
  { value: "health-safety", label: "Health & Safety" },
  { value: "general", label: "General" },
];

const EMPTY_VENUE_FORM = {
  name: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  geoLat: "",
  geoLng: "",
  geoRadius: "200",
  timezone: "Europe/Dublin",
  isDefault: false,
  capacity: "",
  venueType: "",
  cuisine: "",
  foodInfo: "",
  drinksInfo: "",
  equipment: "",
  notes: "",
};

function DetailSection({
  icon: Icon,
  title,
  children,
  color = "slate",
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
  color?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <Icon className={`h-4 w-4 text-${color}-500 flex-shrink-0`} />
        <span className="font-semibold text-slate-800 text-sm flex-1">{title}</span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-4 py-4 bg-white">{children}</div>}
    </div>
  );
}

function ChecklistPanel({ venue, isManager, onUpdate }: { venue: Venue; isManager: boolean; onUpdate: () => void }) {
  const [checklists, setChecklists] = useState<Checklist[]>(venue.checklists ?? []);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("general");
  const [saving, setSaving] = useState(false);
  const [newItems, setNewItems] = useState<string[]>([""]);
  const [activeChecklist, setActiveChecklist] = useState<string | null>(null);
  const [addItemText, setAddItemText] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  useEffect(() => {
    setChecklists(venue.checklists ?? []);
  }, [venue.checklists]);

  async function loadChecklists() {
    const r = await fetch(`/api/venues/${venue.id}/checklists`);
    const d = r.ok ? await r.json() : {};
    setChecklists(d.checklists ?? []);
  }

  async function createChecklist() {
    if (!newTitle.trim()) return;
    setSaving(true);
    const items = newItems.filter((i) => i.trim());
    await fetch(`/api/venues/${venue.id}/checklists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle.trim(), category: newCategory, items }),
    });
    setSaving(false);
    setShowAdd(false);
    setNewTitle("");
    setNewItems([""]);
    loadChecklists();
  }

  async function deleteChecklist(id: string) {
    if (!confirm("Delete this checklist?")) return;
    await fetch(`/api/venues/${venue.id}/checklists/${id}`, { method: "DELETE" });
    loadChecklists();
  }

  async function addItemToChecklist(checklistId: string) {
    if (!addItemText.trim()) return;
    setAddingItem(true);
    await fetch(`/api/venues/${venue.id}/checklists/${checklistId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: addItemText.trim() }),
    });
    setAddItemText("");
    setAddingItem(false);
    loadChecklists();
  }

  async function deleteItem(checklistId: string, itemId: string) {
    await fetch(`/api/venues/${venue.id}/checklists/${checklistId}/items/${itemId}`, { method: "DELETE" });
    loadChecklists();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Custom checklists for this venue — opening, closing, cleaning, etc.</p>
        {isManager && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowAdd(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />New checklist
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-blue-900">New Checklist</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Morning Opening" className="h-8 text-sm" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHECKLIST_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Items</Label>
            {newItems.map((item, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={item}
                  onChange={(e) => setNewItems((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
                  placeholder={`Item ${i + 1}`}
                  className="h-8 text-sm"
                />
                <button onClick={() => setNewItems((p) => p.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setNewItems((p) => [...p, ""])}
              className="text-xs text-blue-600 hover:underline"
            >+ Add item</button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs" onClick={createChecklist} disabled={saving || !newTitle.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Create
            </Button>
          </div>
        </div>
      )}

      {checklists.length === 0 && !showAdd && (
        <div className="text-center py-8 text-slate-400">
          <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No checklists yet</p>
        </div>
      )}

      {checklists.map((cl) => (
        <div key={cl.id} className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm">{cl.title}</p>
              <Badge variant="outline" className="text-xs capitalize mt-0.5">{cl.category.replace("-", " ")}</Badge>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setActiveChecklist(activeChecklist === cl.id ? null : cl.id)}
                className="text-xs text-blue-500 hover:underline px-2 py-1"
              >
                {activeChecklist === cl.id ? "Done" : "Edit items"}
              </button>
              {isManager && (
                <button onClick={() => deleteChecklist(cl.id)} className="p-1 text-slate-400 hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="px-4 py-3 bg-white space-y-2">
            {cl.items.length === 0 && (
              <p className="text-xs text-slate-400">No items yet</p>
            )}
            {cl.items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <CheckSquare className="h-4 w-4 text-slate-300 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1">{item.label}</span>
                {activeChecklist === cl.id && isManager && (
                  <button onClick={() => deleteItem(cl.id, item.id)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {activeChecklist === cl.id && isManager && (
              <div className="flex gap-2 pt-1">
                <Input
                  value={addItemText}
                  onChange={(e) => setAddItemText(e.target.value)}
                  placeholder="New item…"
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => { if (e.key === "Enter") addItemToChecklist(cl.id); }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs"
                  onClick={() => addItemToChecklist(cl.id)}
                  disabled={addingItem || !addItemText.trim()}
                >
                  {addingItem ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function VenuesPage() {
  const { data: session } = useSession();
  const isManager = session?.user?.role === Role.MANAGER || session?.user?.role === Role.ADMIN;

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState(EMPTY_VENUE_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailForm, setDetailForm] = useState({ foodInfo: "", drinksInfo: "", equipment: "", notes: "" });
  const [savingDetails, setSavingDetails] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/venues?checklists=1");
    const d = r.ok ? await r.json() : {};
    const list: Venue[] = d.venues ?? [];
    setVenues(list);
    if (list.length > 0) {
      setSelected((prev) => {
        if (prev) return list.find((v) => v.id === prev.id) ?? list[0];
        return list[0];
      });
    }
    setLoading(false);
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_VENUE_FORM);
    setShowDialog(true);
  }

  function openEdit(venue: Venue) {
    setEditing(venue);
    setForm({
      name: venue.name,
      address: venue.address ?? "",
      phone: venue.phone ?? "",
      email: venue.email ?? "",
      website: venue.website ?? "",
      geoLat: venue.geoLat?.toString() ?? "",
      geoLng: venue.geoLng?.toString() ?? "",
      geoRadius: venue.geoRadius.toString(),
      timezone: venue.timezone,
      isDefault: venue.isDefault,
      capacity: venue.capacity?.toString() ?? "",
      venueType: venue.venueType ?? "",
      cuisine: venue.cuisine ?? "",
      foodInfo: venue.foodInfo ?? "",
      drinksInfo: venue.drinksInfo ?? "",
      equipment: venue.equipment ?? "",
      notes: venue.notes ?? "",
    });
    setShowDialog(true);
  }

  async function saveVenue() {
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      website: form.website || null,
      geoLat: form.geoLat ? parseFloat(form.geoLat) : null,
      geoLng: form.geoLng ? parseFloat(form.geoLng) : null,
      geoRadius: parseInt(form.geoRadius) || 200,
      timezone: form.timezone,
      isDefault: form.isDefault,
      capacity: form.capacity ? parseInt(form.capacity) : null,
      venueType: form.venueType || null,
      cuisine: form.cuisine || null,
      foodInfo: form.foodInfo || null,
      drinksInfo: form.drinksInfo || null,
      equipment: form.equipment || null,
      notes: form.notes || null,
    };
    try {
      if (editing) {
        await fetch(`/api/venues/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/venues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setShowDialog(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteVenue() {
    if (!deleteId) return;
    await fetch(`/api/venues/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    await load();
  }

  function startEditDetails(venue: Venue) {
    setDetailForm({
      foodInfo: venue.foodInfo ?? "",
      drinksInfo: venue.drinksInfo ?? "",
      equipment: venue.equipment ?? "",
      notes: venue.notes ?? "",
    });
    setEditingDetails(true);
  }

  async function saveDetails(venue: Venue) {
    setSavingDetails(true);
    await fetch(`/api/venues/${venue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detailForm),
    });
    setSavingDetails(false);
    setEditingDetails(false);
    await load();
  }

  const displayVenue = selected
    ? (venues.find((v) => v.id === selected.id) ?? selected)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-500" />
            Venues
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your locations, details, and custom checklists</p>
        </div>
        {isManager && (
          <Button onClick={openAdd} className="gap-2">
            <Plus className="h-4 w-4" />Add Venue
          </Button>
        )}
      </div>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-200" />
            <p className="font-medium text-slate-600">No venues yet</p>
            {isManager && <Button className="mt-4" onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Add your first venue</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* Left: venue list */}
          <div className="lg:col-span-1 space-y-2">
            {venues.map((venue) => (
              <button
                key={venue.id}
                onClick={() => { setSelected(venue); setEditingDetails(false); }}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all",
                  displayVenue?.id === venue.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                )}
              >
                <div className="flex items-start gap-2">
                  <Building2 className={cn("h-4 w-4 mt-0.5 flex-shrink-0", displayVenue?.id === venue.id ? "text-blue-500" : "text-slate-400")} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{venue.name}</p>
                    {venue.address && <p className="text-xs text-slate-500 truncate mt-0.5">{venue.address}</p>}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {venue.isDefault && <Badge className="text-[10px] py-0 bg-blue-100 text-blue-700 border-blue-200">Default</Badge>}
                      {!venue.active && <Badge variant="secondary" className="text-[10px] py-0">Inactive</Badge>}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Right: venue detail */}
          {displayVenue && (
            <div className="lg:col-span-3 space-y-4">
              {/* Title bar */}
              <div className="flex items-start justify-between gap-3 bg-white border border-slate-200 rounded-xl p-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900">{displayVenue.name}</h2>
                    {displayVenue.isDefault && <Badge className="bg-blue-100 text-blue-700 border-blue-200">Default</Badge>}
                    {!displayVenue.active && <Badge variant="secondary">Inactive</Badge>}
                    {displayVenue.venueType && (
                      <Badge variant="outline" className="capitalize">{displayVenue.venueType.replace("-", " ")}</Badge>
                    )}
                  </div>
                  {displayVenue.address && (
                    <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
                      <MapPin className="h-3.5 w-3.5" />{displayVenue.address}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                    {displayVenue.phone && <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="h-3 w-3" />{displayVenue.phone}</p>}
                    {displayVenue.email && <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="h-3 w-3" />{displayVenue.email}</p>}
                    {displayVenue.website && <a href={displayVenue.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 flex items-center gap-1 hover:underline"><Globe className="h-3 w-3" />{displayVenue.website}</a>}
                    {displayVenue.capacity && <p className="text-xs text-slate-500">Capacity: {displayVenue.capacity}</p>}
                    {displayVenue.cuisine && <p className="text-xs text-slate-500">Cuisine: {displayVenue.cuisine}</p>}
                  </div>
                </div>
                {isManager && (
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => openEdit(displayVenue)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" />Edit
                    </Button>
                    {!displayVenue.isDefault && (
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-red-500 hover:text-red-700" onClick={() => setDeleteId(displayVenue.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Detail sections */}
              <DetailSection icon={Utensils} title="Food Information" color="orange">
                {editingDetails ? (
                  <Textarea
                    value={detailForm.foodInfo}
                    onChange={(e) => setDetailForm((f) => ({ ...f, foodInfo: e.target.value }))}
                    placeholder="Food menu notes, allergen policy, dietary options, specials board info…"
                    rows={4}
                    className="text-sm"
                  />
                ) : displayVenue.foodInfo ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{displayVenue.foodInfo}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No food information added yet.</p>
                )}
              </DetailSection>

              <DetailSection icon={Wine} title="Drinks & Bar" color="purple">
                {editingDetails ? (
                  <Textarea
                    value={detailForm.drinksInfo}
                    onChange={(e) => setDetailForm((f) => ({ ...f, drinksInfo: e.target.value }))}
                    placeholder="Bar setup, draught lines, house spirits, cocktail menu notes…"
                    rows={4}
                    className="text-sm"
                  />
                ) : displayVenue.drinksInfo ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{displayVenue.drinksInfo}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No bar/drinks information added yet.</p>
                )}
              </DetailSection>

              <DetailSection icon={Settings2} title="Equipment & Systems" color="slate">
                {editingDetails ? (
                  <Textarea
                    value={detailForm.equipment}
                    onChange={(e) => setDetailForm((f) => ({ ...f, equipment: e.target.value }))}
                    placeholder="POS system, kitchen equipment, A/V, broadband, CCTV, alarm codes…"
                    rows={4}
                    className="text-sm"
                  />
                ) : displayVenue.equipment ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{displayVenue.equipment}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No equipment information added yet.</p>
                )}
              </DetailSection>

              <DetailSection icon={Info} title="General Notes" color="blue">
                {editingDetails ? (
                  <Textarea
                    value={detailForm.notes}
                    onChange={(e) => setDetailForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="General manager notes, parking info, access codes, supplier contacts…"
                    rows={4}
                    className="text-sm"
                  />
                ) : displayVenue.notes ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{displayVenue.notes}</p>
                ) : (
                  <p className="text-sm text-slate-400 italic">No general notes added yet.</p>
                )}
              </DetailSection>

              {isManager && (
                <div className="flex justify-end gap-2">
                  {editingDetails ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditingDetails(false)}>Cancel</Button>
                      <Button size="sm" className="h-8 text-xs" onClick={() => saveDetails(displayVenue)} disabled={savingDetails}>
                        {savingDetails ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}Save details
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => startEditDetails(displayVenue)}>
                      <Edit2 className="h-3.5 w-3.5 mr-1" />Edit details
                    </Button>
                  )}
                </div>
              )}

              {/* Checklists */}
              <DetailSection icon={ClipboardList} title="Custom Checklists" color="green">
                <ChecklistPanel venue={displayVenue} isManager={isManager} onUpdate={load} />
              </DetailSection>

              {/* Clock-in radius */}
              <DetailSection icon={MapPin} title="Clock-in Geofence" color="slate">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-xs text-slate-400">Timezone</p><p className="font-medium text-slate-800">{displayVenue.timezone}</p></div>
                  <div><p className="text-xs text-slate-400">Radius</p><p className="font-medium text-slate-800">{displayVenue.geoRadius}m</p></div>
                  {displayVenue.geoLat && <div><p className="text-xs text-slate-400">Latitude</p><p className="font-medium text-slate-800">{displayVenue.geoLat}</p></div>}
                  {displayVenue.geoLng && <div><p className="text-xs text-slate-400">Longitude</p><p className="font-medium text-slate-800">{displayVenue.geoLng}</p></div>}
                </div>
              </DetailSection>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Venue" : "Add Venue"}</DialogTitle>
            <DialogDescription>Manage location details and settings</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Basic info */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Basic Info</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Venue Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. The Main Bar" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={form.venueType || "_none"} onValueChange={(v) => setForm((f) => ({ ...f, venueType: v === "_none" ? "" : v }))}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {VENUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuisine</Label>
                  <Input value={form.cuisine} onChange={(e) => setForm((f) => ({ ...f, cuisine: e.target.value }))} placeholder="e.g. Irish, Italian" className="h-9 text-sm" />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Address</Label>
                  <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+353..." className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="venue@example.com" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Website</Label>
                  <Input value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} placeholder="https://..." className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Capacity</Label>
                  <Input type="number" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 80" className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Geofence */}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Clock-in Geofence</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Latitude</Label>
                  <Input value={form.geoLat} onChange={(e) => setForm((f) => ({ ...f, geoLat: e.target.value }))} placeholder="53.349805" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Longitude</Label>
                  <Input value={form.geoLng} onChange={(e) => setForm((f) => ({ ...f, geoLng: e.target.value }))} placeholder="-6.26031" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Radius (m)</Label>
                  <Input type="number" value={form.geoRadius} onChange={(e) => setForm((f) => ({ ...f, geoRadius: e.target.value }))} className="h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Timezone</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Europe/Dublin">Europe/Dublin</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                    <SelectItem value="Europe/Paris">Europe/Paris</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                    <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Flags */}
            <div className="border-t border-slate-100 pt-3 flex items-center gap-3">
              <Switch checked={form.isDefault} onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))} />
              <Label className="text-sm">Set as default venue</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveVenue} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Save Changes" : "Add Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Venue?</DialogTitle>
            <DialogDescription>This will remove the venue and all associated checklists. Employees and shifts linked to it will need to be reassigned.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteVenue}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
