"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, Pencil, X, Loader2, AlertCircle, ChevronDown, ChevronUp,
  Link2, Printer, ExternalLink, Copy, Check, ChefHat, Users, Euro,
  ShieldAlert, Leaf, Wheat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const COURSE_TYPES = [
  { value: "starter", label: "Starters" },
  { value: "soup", label: "Soup" },
  { value: "main", label: "Main Course" },
  { value: "dessert", label: "Desserts" },
  { value: "cheese", label: "Cheese Course" },
  { value: "tea_coffee", label: "Tea & Coffee" },
  { value: "canapes", label: "Canapés & Nibbles" },
  { value: "kids", label: "Kids Menu" },
  { value: "buffet", label: "Buffet" },
];

const ALLERGENS = [
  { key: "allergenGluten", label: "Gluten", icon: "🌾" },
  { key: "allergenCrustacean", label: "Crustaceans", icon: "🦐" },
  { key: "allergenEgg", label: "Eggs", icon: "🥚" },
  { key: "allergenFish", label: "Fish", icon: "🐟" },
  { key: "allergenPeanut", label: "Peanuts", icon: "🥜" },
  { key: "allergenSoy", label: "Soybeans", icon: "🫘" },
  { key: "allergenMilk", label: "Milk/Dairy", icon: "🥛" },
  { key: "allergenNuts", label: "Tree Nuts", icon: "🌰" },
  { key: "allergenCelery", label: "Celery", icon: "🌿" },
  { key: "allergenMustard", label: "Mustard", icon: "🟡" },
  { key: "allergenSesame", label: "Sesame", icon: "✳️" },
  { key: "allergenSulphites", label: "Sulphites", icon: "🍷" },
  { key: "allergenLupin", label: "Lupin", icon: "🌸" },
  { key: "allergenMollusc", label: "Molluscs", icon: "🦪" },
];

const DIETARY = [
  { key: "isVegan", label: "Vegan", color: "bg-green-100 text-green-700 border-green-300" },
  { key: "isVegetarian", label: "Vegetarian", color: "bg-lime-100 text-lime-700 border-lime-300" },
  { key: "isGlutenFree", label: "Gluten-Free", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { key: "isHalal", label: "Halal", color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
  { key: "isKosher", label: "Kosher", color: "bg-purple-100 text-purple-700 border-purple-300" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface FunctionDishBase {
  id: string;
  name: string;
  description?: string | null;
  notes?: string | null;
  isVegan: boolean; isVegetarian: boolean; isGlutenFree: boolean; isHalal: boolean; isKosher: boolean;
  allergenGluten: boolean; allergenCrustacean: boolean; allergenEgg: boolean; allergenFish: boolean;
  allergenPeanut: boolean; allergenSoy: boolean; allergenMilk: boolean; allergenNuts: boolean;
  allergenCelery: boolean; allergenMustard: boolean; allergenSesame: boolean; allergenSulphites: boolean;
  allergenLupin: boolean; allergenMollusc: boolean;
  sortOrder: number;
}

// With index signature for dynamic allergen/dietary key lookups
interface FunctionDish extends FunctionDishBase {
  [key: string]: unknown;
}

interface FunctionCourse {
  id: string;
  courseType: string;
  label?: string | null;
  choiceCount: number;
  sortOrder: number;
  dishes: FunctionDish[];
}

interface FunctionMenu {
  id: string;
  name: string;
  description?: string | null;
  pricePerHead?: number | null;
  minGuests?: number | null;
  maxGuests?: number | null;
  isActive: boolean;
  shareToken: string;
  courses: FunctionCourse[];
}

function emptyDish(): Omit<FunctionDish, "id" | "sortOrder"> {
  return {
    name: "", description: "", notes: "",
    isVegan: false, isVegetarian: false, isGlutenFree: false, isHalal: false, isKosher: false,
    allergenGluten: false, allergenCrustacean: false, allergenEgg: false, allergenFish: false,
    allergenPeanut: false, allergenSoy: false, allergenMilk: false, allergenNuts: false,
    allergenCelery: false, allergenMustard: false, allergenSesame: false, allergenSulphites: false,
    allergenLupin: false, allergenMollusc: false,
  };
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export function FunctionMenusTab({ canEdit }: { canEdit: boolean }) {
  const [menus, setMenus] = useState<FunctionMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<FunctionMenu | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/menu/functions");
    const d = r.ok ? await r.json() : {};
    setMenus(d.menus ?? []);
    // Keep selected menu in sync
    if (selectedMenu) {
      const updated = (d.menus ?? []).find((m: FunctionMenu) => m.id === selectedMenu.id);
      if (updated) setSelectedMenu(updated);
    }
    setLoading(false);
  }, [selectedMenu?.id]);

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>
  );

  // Menu detail view
  if (selectedMenu) {
    return (
      <MenuEditor
        menu={selectedMenu}
        canEdit={canEdit}
        onBack={() => { setSelectedMenu(null); load(); }}
        onSaved={load}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Create printable function menus with course options, allergens and dietary info.</p>
        {canEdit && (
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />New function menu
          </Button>
        )}
      </div>

      {menus.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
          <ChefHat className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-600">No function menus yet</p>
          {canEdit && <p className="text-sm text-slate-400 mt-1">Create your first menu for weddings, events and group bookings</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {menus.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            canEdit={canEdit}
            onSelect={() => setSelectedMenu(menu)}
            onDeleted={load}
          />
        ))}
      </div>

      {showCreate && (
        <CreateMenuModal
          onClose={() => setShowCreate(false)}
          onCreated={(menu) => { setShowCreate(false); setSelectedMenu(menu); load(); }}
        />
      )}
    </div>
  );
}

// ── Menu Card ─────────────────────────────────────────────────────────────────

function MenuCard({ menu, canEdit, onSelect, onDeleted }: {
  menu: FunctionMenu; canEdit: boolean; onSelect: () => void; onDeleted: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/menu/${menu.shareToken}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function del() {
    if (!confirm(`Delete "${menu.name}"? This cannot be undone.`)) return;
    await fetch(`/api/menu/functions/${menu.id}`, { method: "DELETE" });
    onDeleted();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 hover:border-orange-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{menu.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{menu.courses.length} courses · {menu.courses.reduce((s, c) => s + c.dishes.length, 0)} dishes</p>
        </div>
        <span className={cn("text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium",
          menu.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        )}>
          {menu.isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {(menu.pricePerHead || menu.minGuests || menu.maxGuests) && (
        <div className="flex gap-3 text-xs text-slate-500">
          {menu.pricePerHead && <span className="flex items-center gap-1"><Euro className="h-3 w-3" />€{menu.pricePerHead}/head</span>}
          {(menu.minGuests || menu.maxGuests) && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {menu.minGuests && menu.maxGuests ? `${menu.minGuests}–${menu.maxGuests}` : menu.minGuests ? `${menu.minGuests}+` : `≤${menu.maxGuests}`} guests
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1 h-8 text-xs bg-orange-500 hover:bg-orange-600" onClick={onSelect}>
          <Pencil className="h-3.5 w-3.5 mr-1" />{canEdit ? "Edit" : "View"}
        </Button>
        <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Copy share link">
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Link2 className="h-4 w-4" />}
        </button>
        <a href={shareUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" title="Open shareable menu">
          <ExternalLink className="h-4 w-4" />
        </a>
        {canEdit && (
          <button onClick={del} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Create Menu Modal ─────────────────────────────────────────────────────────

function CreateMenuModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (menu: FunctionMenu) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerHead, setPricePerHead] = useState("");
  const [minGuests, setMinGuests] = useState("");
  const [maxGuests, setMaxGuests] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) { setError("Name required"); return; }
    setSaving(true);
    const r = await fetch("/api/menu/functions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description, pricePerHead, minGuests, maxGuests }),
    });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Error"); setSaving(false); return; }
    onCreated(d.menu);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Function Menu</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Menu name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wedding Package A" />
          </div>
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Brief description for customers…" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Price/head (€)</Label>
              <Input type="number" step="0.01" value={pricePerHead} onChange={(e) => setPricePerHead(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <Label>Min guests</Label>
              <Input type="number" value={minGuests} onChange={(e) => setMinGuests(e.target.value)} placeholder="e.g. 20" />
            </div>
            <div className="space-y-1">
              <Label>Max guests</Label>
              <Input type="number" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} placeholder="e.g. 200" />
            </div>
          </div>
          {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Create & add courses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Choice Count Picker ───────────────────────────────────────────────────────

function ChoiceCountPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 hover:border-orange-300 hover:bg-orange-50 text-slate-600 hover:text-orange-700 transition-colors font-medium"
      >
        Choose {value}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xs mx-4 mb-4 sm:mb-0 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">How many choices?</p>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">Number of dishes a guest can select from this course</p>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  onClick={() => { onChange(n); setOpen(false); }}
                  className={cn(
                    "py-3 rounded-xl text-sm font-bold border-2 transition-all",
                    value === n
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-slate-200 text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Menu Editor ───────────────────────────────────────────────────────────────

function MenuEditor({ menu, canEdit, onBack, onSaved }: {
  menu: FunctionMenu; canEdit: boolean; onBack: () => void; onSaved: () => void;
}) {
  const [courses, setCourses] = useState<FunctionCourse[]>(menu.courses);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [editDish, setEditDish] = useState<{ courseId: string; dish: FunctionDish | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(new Set(menu.courses.map((c) => c.id)));

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/menu/${menu.shareToken}`;

  async function copyLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addCourse(courseType: string, label: string, choiceCount: number) {
    setSaving(true);
    const r = await fetch(`/api/menu/functions/${menu.id}/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseType, label, choiceCount, sortOrder: courses.length }),
    });
    const d = await r.json();
    if (r.ok) {
      const updated = [...courses, d.course];
      setCourses(updated);
      setExpandedCourses((prev) => new Set([...prev, d.course.id]));
    }
    setSaving(false);
    setShowAddCourse(false);
    onSaved();
  }

  async function deleteCourse(courseId: string) {
    if (!confirm("Remove this course?")) return;
    await fetch(`/api/menu/functions/${menu.id}/courses`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    setCourses((prev) => prev.filter((c) => c.id !== courseId));
    onSaved();
  }

  async function updateChoiceCount(courseId: string, choiceCount: number) {
    await fetch(`/api/menu/functions/${menu.id}/courses`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId, choiceCount }),
    });
    setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, choiceCount } : c));
  }

  async function saveDish(courseId: string, dish: Omit<FunctionDish, "id" | "sortOrder">, existingId?: string) {
    const course = courses.find((c) => c.id === courseId)!;
    if (existingId) {
      const r = await fetch(`/api/menu/functions/${menu.id}/courses/${courseId}/dishes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishId: existingId, ...dish }),
      });
      const d = await r.json();
      if (r.ok) {
        setCourses((prev) => prev.map((c) =>
          c.id === courseId
            ? { ...c, dishes: c.dishes.map((dish) => dish.id === existingId ? d.dish : dish) }
            : c
        ));
      }
    } else {
      const r = await fetch(`/api/menu/functions/${menu.id}/courses/${courseId}/dishes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...dish, sortOrder: course.dishes.length }),
      });
      const d = await r.json();
      if (r.ok) {
        setCourses((prev) => prev.map((c) =>
          c.id === courseId ? { ...c, dishes: [...c.dishes, d.dish] } : c
        ));
      }
    }
    setEditDish(null);
    onSaved();
  }

  async function deleteDish(courseId: string, dishId: string) {
    if (!confirm("Remove this dish?")) return;
    await fetch(`/api/menu/functions/${menu.id}/courses/${courseId}/dishes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishId }),
    });
    setCourses((prev) => prev.map((c) =>
      c.id === courseId ? { ...c, dishes: c.dishes.filter((d) => d.id !== dishId) } : c
    ));
    onSaved();
  }

  function toggleCourse(id: string) {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Dietary warning: course has no dietary option
  function hasDietaryWarning(course: FunctionCourse) {
    return course.dishes.length > 0 &&
      !course.dishes.some((d) => d.isVegan || d.isVegetarian || d.isGlutenFree || d.isHalal || d.isKosher);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-700 text-sm flex items-center gap-1">
            ← Back
          </button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">{menu.name}</h2>
            {menu.pricePerHead && <p className="text-xs text-slate-400">€{menu.pricePerHead}/head</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink} className="flex items-center gap-1.5 text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            <ExternalLink className="h-3.5 w-3.5" />Preview
          </a>
          <button onClick={() => window.open(shareUrl, "_blank")?.print()} className="flex items-center gap-1.5 text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors">
            <Printer className="h-3.5 w-3.5" />Print
          </button>
        </div>
      </div>

      {/* Courses */}
      <div className="space-y-3">
        {courses.map((course) => {
          const expanded = expandedCourses.has(course.id);
          const courseLabel = course.label || COURSE_TYPES.find((c) => c.value === course.courseType)?.label || course.courseType;
          const warning = hasDietaryWarning(course);

          return (
            <div key={course.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {/* Course header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                <button onClick={() => toggleCourse(course.id)} className="flex-1 flex items-center gap-3 text-left">
                  <span className="font-semibold text-slate-800 text-sm">{courseLabel}</span>
                  {warning && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      <ShieldAlert className="h-3 w-3" />No dietary option
                    </span>
                  )}
                  <span className="text-xs text-slate-400 ml-auto">{course.dishes.length} options</span>
                  {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canEdit ? (
                    <ChoiceCountPicker
                      value={course.choiceCount}
                      onChange={(n) => updateChoiceCount(course.id, n)}
                    />
                  ) : (
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Choose {course.choiceCount}
                    </span>
                  )}
                  {canEdit && (
                    <button onClick={() => deleteCourse(course.id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Dish list */}
              {expanded && (
                <div className="divide-y divide-slate-50">
                  {course.dishes.map((dish) => (
                    <DishRow
                      key={dish.id}
                      dish={dish}
                      canEdit={canEdit}
                      onEdit={() => setEditDish({ courseId: course.id, dish })}
                      onDelete={() => deleteDish(course.id, dish.id)}
                    />
                  ))}
                  {canEdit && (
                    <div className="px-4 py-2">
                      <button
                        onClick={() => setEditDish({ courseId: course.id, dish: null })}
                        className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" />Add dish option
                      </button>
                    </div>
                  )}
                  {course.dishes.length === 0 && !canEdit && (
                    <p className="px-4 py-3 text-xs text-slate-400 italic">No options added yet</p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add course */}
        {canEdit && (
          <button
            onClick={() => setShowAddCourse(true)}
            className="w-full border-2 border-dashed border-slate-200 rounded-xl py-4 text-sm text-slate-400 hover:border-orange-300 hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />Add course
          </button>
        )}
      </div>

      {/* Add Course Modal */}
      {showAddCourse && (
        <AddCourseModal
          existingTypes={courses.map((c) => c.courseType)}
          onClose={() => setShowAddCourse(false)}
          onAdd={addCourse}
          saving={saving}
        />
      )}

      {/* Edit Dish Modal */}
      {editDish && (
        <DishModal
          dish={editDish.dish}
          onClose={() => setEditDish(null)}
          onSave={(d) => saveDish(editDish.courseId, d, editDish.dish?.id)}
        />
      )}
    </div>
  );
}

// ── Dish Row ──────────────────────────────────────────────────────────────────

function DishRow({ dish, canEdit, onEdit, onDelete }: {
  dish: FunctionDish; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const allergenList = ALLERGENS.filter((a) => (dish as Record<string, unknown>)[a.key]).map((a) => a.label);
  const dietBadges = DIETARY.filter((d) => (dish as Record<string, unknown>)[d.key]);

  return (
    <div className="px-4 py-3 flex items-start gap-3 group hover:bg-slate-50/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-800">{dish.name}</span>
          {dietBadges.map((b) => (
            <span key={b.key} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", b.color)}>
              {b.label}
            </span>
          ))}
        </div>
        {dish.description && <p className="text-xs text-slate-400 mt-0.5 italic">{dish.description}</p>}
        {allergenList.length > 0 && (
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Wheat className="h-3 w-3 text-amber-500" />
            <span className="font-medium text-slate-500">Contains:</span> {allergenList.join(" · ")}
          </p>
        )}
        {dish.notes && (
          <p className="text-xs text-slate-400 mt-0.5">
            <span className="font-medium">Staff note:</span> {dish.notes}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button onClick={onEdit} className="p-1 rounded hover:bg-slate-200 text-slate-400"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}
    </div>
  );
}

// ── Add Course Modal ──────────────────────────────────────────────────────────

function AddCourseModal({ existingTypes, onClose, onAdd, saving }: {
  existingTypes: string[];
  onClose: () => void;
  onAdd: (courseType: string, label: string, choiceCount: number) => void;
  saving: boolean;
}) {
  const [courseType, setCourseType] = useState("");
  const [label, setLabel] = useState("");
  const [choiceCount, setChoiceCount] = useState(1);

  const available = COURSE_TYPES; // allow duplicates (e.g. two buffet sections)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Add Course</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Course type *</Label>
            <Select value={courseType} onValueChange={setCourseType}>
              <SelectTrigger><SelectValue placeholder="Select course…" /></SelectTrigger>
              <SelectContent>
                {available.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Custom label <span className="text-slate-400">(optional)</span></Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Amuse Bouche" />
          </div>
          <div className="space-y-1">
            <Label>Number of choices guests can make</Label>
            <Select value={choiceCount.toString()} onValueChange={(v) => setChoiceCount(parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={n.toString()}>Choose {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!courseType || saving}
            onClick={() => onAdd(courseType, label, choiceCount)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Add course
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Dish Modal ────────────────────────────────────────────────────────────────

function DishModal({ dish, onClose, onSave }: {
  dish: FunctionDish | null;
  onClose: () => void;
  onSave: (d: Omit<FunctionDishBase, "id" | "sortOrder">) => void;
}) {
  const [form, setForm] = useState<Omit<FunctionDishBase, "id" | "sortOrder">>(
    dish ? { ...dish } : emptyDish()
  );
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function set(key: string, value: unknown) {
    setForm((prev) => ({ ...prev, [key]: value }) as any);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    onSave(form);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? "Edit Dish" : "Add Dish Option"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Dish name *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pan-seared Salmon" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description <span className="text-slate-400">(shown on menu card)</span></Label>
              <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} placeholder="e.g. With lemon butter sauce, seasonal vegetables…" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Staff notes <span className="text-slate-400">(internal only)</span></Label>
              <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Prep time 20 min, pre-portion day before" />
            </div>
          </div>

          {/* Dietary badges */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-green-500" />Dietary</Label>
            <div className="flex flex-wrap gap-2">
              {DIETARY.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => set(d.key, !(form as Record<string, unknown>)[d.key])}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                    (form as Record<string, unknown>)[d.key] ? d.color : "border-slate-200 text-slate-400 hover:border-slate-300"
                  )}
                >
                  {(form as Record<string, unknown>)[d.key] ? "✓ " : ""}{d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Allergens */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              14 EU Allergens — tick all that <span className="font-bold text-red-600">APPLY</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALLERGENS.map((a) => {
                const active = (form as Record<string, unknown>)[a.key] as boolean;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => set(a.key, !active)}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all text-left",
                      active
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                    )}
                  >
                    <span>{a.icon}</span>
                    <span>{a.label}</span>
                    {active && <Check className="h-3 w-3 ml-auto text-red-500" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!form.name.trim() || saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {dish ? "Save changes" : "Add dish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
