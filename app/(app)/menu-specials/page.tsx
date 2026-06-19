"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Utensils,
  Plus,
  Pencil,
  Trash2,
  Pin,
  PinOff,
  Archive,
  ImageIcon,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info,
  Megaphone,
  Ban,
} from "lucide-react";
import { UserRole as Role } from "@/types/roles";
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  differenceInDays,
  parseISO,
} from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "special" | "change" | "announcement" | "86'd";

interface MenuSpecial {
  id: string;
  title: string;
  description: string | null;
  category: Category;
  date: string;
  endDate: string | null;
  pinned: boolean;
  imageDataUri: string | null;
  archived: boolean;
  createdAt: string;
  createdBy: { name: string | null };
}

interface CategoryMeta {
  value: Category;
  label: string;
  icon: React.ElementType;
  color: string;
}

const CATEGORIES: CategoryMeta[] = [
  {
    value: "special",
    label: "Daily Special",
    icon: Utensils,
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    value: "change",
    label: "Menu Change",
    icon: Info,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "announcement",
    label: "Announcement",
    icon: Megaphone,
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
  {
    value: "86'd",
    label: "86'd (Out of Stock)",
    icon: Ban,
    color: "bg-red-100 text-red-800 border-red-200",
  },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  category: "special" as Category,
  date: new Date().toISOString().slice(0, 10),
  endDate: "",
  pinned: false,
  imageDataUri: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCategoryMeta(cat: Category): CategoryMeta {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[0];
}

function dateLabel(dateStr: string, endDateStr?: string | null): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  const end = endDateStr ? parseISO(endDateStr) : null;
  if (end && !isPast(end)) {
    const days = differenceInDays(end, new Date()) + 1;
    return `Until ${format(end, "d MMM")} (${days}d left)`;
  }
  return format(d, "d MMM");
}

function isActive(s: MenuSpecial): boolean {
  const end = s.endDate ? parseISO(s.endDate) : null;
  if (end) return !isPast(end);
  return !isPast(parseISO(s.date)) || isToday(parseISO(s.date));
}

// ─── Special Card ─────────────────────────────────────────────────────────────

function SpecialCard({
  s,
  canEdit,
  onEdit,
  onPin,
  onArchive,
  onDelete,
  onLightbox,
}: {
  s: MenuSpecial;
  canEdit: boolean;
  onEdit: (s: MenuSpecial) => void;
  onPin: (s: MenuSpecial) => void;
  onArchive: (s: MenuSpecial) => void;
  onDelete: (id: string) => void;
  onLightbox: (src: string) => void;
}) {
  const meta = getCategoryMeta(s.category);
  const Icon = meta.icon;

  return (
    <div
      className={`relative rounded-xl border bg-white shadow-sm overflow-hidden transition hover:shadow-md ${
        s.archived ? "opacity-60" : ""
      }`}
    >
      {s.imageDataUri && (
        <div
          className="w-full h-36 bg-gray-100 overflow-hidden cursor-pointer"
          onClick={() => onLightbox(s.imageDataUri!)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.imageDataUri}
            alt={s.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
          />
        </div>
      )}

      {s.pinned && (
        <div className="absolute top-2 right-2 z-10">
          <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
            <Pin className="w-3 h-3" /> Pinned
          </span>
        </div>
      )}

      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 leading-tight text-sm line-clamp-2">
          {s.title}
        </h3>

        <div className="flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}
          >
            <Icon className="w-3 h-3" />
            {meta.label}
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {dateLabel(s.date, s.endDate)}
          </span>
        </div>

        {s.description && (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
            {s.description}
          </p>
        )}

        <p className="text-xs text-gray-400">
          Posted by {s.createdBy.name ?? "Unknown"} ·{" "}
          {format(parseISO(s.createdAt), "d MMM yyyy")}
        </p>

        {canEdit && (
          <div className="flex items-center gap-1 pt-1 border-t flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onEdit(s)}
            >
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onPin(s)}
            >
              {s.pinned ? (
                <PinOff className="w-3 h-3 mr-1" />
              ) : (
                <Pin className="w-3 h-3 mr-1" />
              )}
              {s.pinned ? "Unpin" : "Pin"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onArchive(s)}
            >
              <Archive className="w-3 h-3 mr-1" />
              {s.archived ? "Restore" : "Archive"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
              onClick={() => onDelete(s.id)}
            >
              <Trash2 className="w-3 h-3 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  items,
  defaultOpen = true,
  canEdit,
  onEdit,
  onPin,
  onArchive,
  onDelete,
  onLightbox,
}: {
  title: string;
  items: MenuSpecial[];
  defaultOpen?: boolean;
  canEdit: boolean;
  onEdit: (s: MenuSpecial) => void;
  onPin: (s: MenuSpecial) => void;
  onArchive: (s: MenuSpecial) => void;
  onDelete: (id: string) => void;
  onLightbox: (src: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <button
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 uppercase tracking-wide hover:text-gray-900 transition"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
        {title}
        <span className="text-xs font-normal text-gray-400">
          ({items.length})
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((s) => (
            <SpecialCard
              key={s.id}
              s={s}
              canEdit={canEdit}
              onEdit={onEdit}
              onPin={onPin}
              onArchive={onArchive}
              onDelete={onDelete}
              onLightbox={onLightbox}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MenuSpecialsPage() {
  const { data: session } = useSession();
  const role = (session?.user?.role ?? Role.EMPLOYEE) as Role;
  const canEdit = role === Role.MANAGER || role === Role.ADMIN;

  const [specials, setSpecials] = useState<MenuSpecial[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete confirm dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Image lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Image upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // ─── Data ─────────────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/menu-specials${showArchived ? "?archived=1" : ""}`
      );
      if (res.ok) {
        const data: MenuSpecial[] = await res.json();
        setSpecials(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  function openNew() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      date: new Date().toISOString().slice(0, 10),
    });
    setImagePreview("");
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(s: MenuSpecial) {
    setEditingId(s.id);
    setForm({
      title: s.title,
      description: s.description ?? "",
      category: s.category,
      date: s.date.slice(0, 10),
      endDate: s.endDate ? s.endDate.slice(0, 10) : "",
      pinned: s.pinned,
      imageDataUri: s.imageDataUri ?? "",
    });
    setImagePreview(s.imageDataUri ?? "");
    setFormError("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!form.date) {
      setFormError("Date is required");
      return;
    }

    setSaving(true);
    setFormError("");

    const body = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      date: form.date,
      endDate: form.endDate || null,
      pinned: form.pinned,
      imageDataUri: form.imageDataUri || null,
    };

    try {
      const res = editingId
        ? await fetch(`/api/menu-specials/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/menu-specials", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError((err as { error?: string }).error ?? "Something went wrong");
        return;
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/menu-specials/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteId(null);
    load();
  }

  async function togglePin(s: MenuSpecial) {
    await fetch(`/api/menu-specials/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !s.pinned }),
    });
    load();
  }

  async function toggleArchive(s: MenuSpecial) {
    await fetch(`/api/menu-specials/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: !s.archived }),
    });
    load();
  }

  function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const uri = e.target?.result as string;
      setImagePreview(uri);
      setForm((f) => ({ ...f, imageDataUri: uri }));
    };
    reader.readAsDataURL(file);
  }

  // ─── Group specials ───────────────────────────────────────────────────────

  const pinned = specials.filter((s) => s.pinned && !s.archived);
  const active = specials.filter(
    (s) => !s.pinned && !s.archived && isActive(s)
  );
  const past = specials.filter(
    (s) => !s.pinned && !s.archived && !isActive(s)
  );
  const archivedList = specials.filter((s) => s.archived);

  const sharedCardProps = {
    canEdit,
    onEdit: openEdit,
    onPin: togglePin,
    onArchive: toggleArchive,
    onDelete: (id: string) => setDeleteId(id),
    onLightbox: (src: string) => setLightboxSrc(src),
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 w-full max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Utensils className="w-6 h-6 text-emerald-600" />
            Menu &amp; Specials
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Daily specials, menu changes &amp; announcements for the team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs"
          >
            <Archive className="w-3.5 h-3.5 mr-1" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          {canEdit && (
            <Button onClick={openNew} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Post
            </Button>
          )}
        </div>
      </div>

      {/* Category legend */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <span
              key={c.value}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.color}`}
            >
              <Icon className="w-3 h-3" />
              {c.label}
            </span>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : specials.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Utensils className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No posts yet</p>
          {canEdit && (
            <p className="text-sm mt-1">
              Click &quot;New Post&quot; to share a daily special or
              announcement with the team.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {pinned.length > 0 && (
            <Section title="📌 Pinned" items={pinned} {...sharedCardProps} />
          )}
          <Section title="Active" items={active} {...sharedCardProps} />
          <Section
            title="Past"
            items={past}
            defaultOpen={false}
            {...sharedCardProps}
          />
          {showArchived && (
            <Section
              title="Archived"
              items={archivedList}
              defaultOpen={false}
              {...sharedCardProps}
            />
          )}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Post" : "New Menu Post"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, category: v as Category }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder={
                  form.category === "special"
                    ? "e.g. Pan-fried sea bass with lemon butter"
                    : form.category === "86'd"
                    ? "e.g. Beef burger — sold out"
                    : form.category === "change"
                    ? "e.g. New seasonal menu from Monday"
                    : "e.g. Staff meeting at 4pm before service"
                }
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description / Notes</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Add details, allergens, prep notes, or instructions..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  End Date{" "}
                  <span className="text-gray-400 font-normal text-xs">
                    (optional)
                  </span>
                </Label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Pin toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, pinned: !f.pinned }))}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                  form.pinned ? "bg-yellow-400" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.pinned ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <Label
                className="cursor-pointer"
                onClick={() => setForm((f) => ({ ...f, pinned: !f.pinned }))}
              >
                Pin to top of board
              </Label>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label>
                Photo{" "}
                <span className="text-gray-400 font-normal text-xs">
                  (optional)
                </span>
              </Label>
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-40 object-cover"
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition"
                    onClick={() => {
                      setImagePreview("");
                      setForm((f) => ({ ...f, imageDataUri: "" }));
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleImageFile(file);
                  }}
                >
                  <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    Click or drag a photo of the dish
                  </p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageFile(f);
                }}
              />
            </div>

            {formError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Save Changes" : "Post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog
        open={!!deleteId}
        onOpenChange={(o: boolean) => !o && setDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            This is permanent and cannot be undone.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxSrc}
            alt="Full size"
            className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
          />
          <button
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2"
            onClick={() => setLightboxSrc(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
