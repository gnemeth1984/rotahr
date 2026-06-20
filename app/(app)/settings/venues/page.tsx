// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  MapPin, Plus, Edit2, Trash2, Loader2, Star, Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { UserRole as Role } from "@/types/roles";

type Venue = {
  id: string;
  name: string;
  address?: string;
  geoLat?: number;
  geoLng?: number;
  geoRadius: number;
  timezone: string;
  isDefault: boolean;
  active: boolean;
};

const EMPTY_FORM = {
  name: "",
  address: "",
  geoLat: "",
  geoLng: "",
  geoRadius: "200",
  timezone: "Europe/Dublin",
  isDefault: false,
};

export default function VenuesSettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isAdmin = role === Role.ADMIN;
  const isManager = role === Role.MANAGER || isAdmin;

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/venues")
      .then((r) => r.json())
      .then((d) => {
        setVenues(d.venues ?? []);
        setLoading(false);
      });
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  }

  function openEdit(venue: Venue) {
    setEditing(venue);
    setForm({
      name: venue.name,
      address: venue.address ?? "",
      geoLat: venue.geoLat?.toString() ?? "",
      geoLng: venue.geoLng?.toString() ?? "",
      geoRadius: venue.geoRadius.toString(),
      timezone: venue.timezone,
      isDefault: venue.isDefault,
    });
    setShowDialog(true);
  }

  async function saveVenue() {
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address || null,
      geoLat: form.geoLat ? parseFloat(form.geoLat) : null,
      geoLng: form.geoLng ? parseFloat(form.geoLng) : null,
      geoRadius: parseInt(form.geoRadius) || 200,
      timezone: form.timezone,
      isDefault: form.isDefault,
    };
    try {
      if (editing) {
        const res = await fetch(`/api/venues/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        setVenues((prev) => {
          let updated = prev.map((v) => v.id === editing.id ? data.venue : v);
          if (payload.isDefault) updated = updated.map((v) => v.id === editing.id ? v : { ...v, isDefault: false });
          return updated;
        });
      } else {
        const res = await fetch("/api/venues", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        setVenues((prev) => {
          let updated = payload.isDefault ? prev.map((v) => ({ ...v, isDefault: false })) : prev;
          return [data.venue, ...updated];
        });
      }
      setShowDialog(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteVenue(id: string) {
    await fetch(`/api/venues/${id}`, { method: "DELETE" });
    setVenues((prev) => prev.filter((v) => v.id !== id));
    setDeleteId(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Venues</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage multiple locations. Staff and shifts can be assigned to specific venues.
          </p>
        </div>
        {isManager && (
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Venue
          </Button>
        )}
      </div>

      {venues.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No venues set up yet</p>
            <p className="text-slate-400 text-sm mt-1">
              Add your first venue to enable multi-location rota management
            </p>
            <Button className="mt-4" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-2" /> Add Venue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {venues.map((venue) => (
            <Card key={venue.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{venue.name}</p>
                        {venue.isDefault && (
                          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                      </div>
                      {venue.address && (
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {venue.address}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                        {venue.geoLat && venue.geoLng ? (
                          <span>Geo-fenced ({venue.geoRadius}m radius)</span>
                        ) : (
                          <span>No geo-fence</span>
                        )}
                        <span>{venue.timezone}</span>
                      </div>
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(venue)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        onClick={() => setDeleteId(venue.id)}
                        disabled={venue.isDefault}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Venue" : "Add Venue"}</DialogTitle>
            <DialogDescription>
              Set up location details and optional geo-fence for clock-in
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Venue Name *</Label>
              <Input
                placeholder="e.g. Main Street, Airport Location"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                placeholder="Full address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="53.3498"
                  value={form.geoLat}
                  onChange={(e) => setForm((f) => ({ ...f, geoLat: e.target.value }))}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="-6.2603"
                  value={form.geoLng}
                  onChange={(e) => setForm((f) => ({ ...f, geoLng: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Geo-fence Radius (metres)</Label>
              <Input
                type="number"
                placeholder="200"
                value={form.geoRadius}
                onChange={(e) => setForm((f) => ({ ...f, geoRadius: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between py-1">
              <Label className="cursor-pointer">Set as default venue</Label>
              <Switch
                checked={form.isDefault}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isDefault: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveVenue} disabled={saving || !form.name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editing ? "Save" : "Add Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Venue?</DialogTitle>
            <DialogDescription>
              The venue will be deactivated. Existing shifts and employees assigned to it won't be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteVenue(deleteId)}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
