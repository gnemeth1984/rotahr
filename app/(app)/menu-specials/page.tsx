"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Utensils, ChefHat, CalendarDays, BookOpen, Layers,
  Sparkles, Plus, Pencil, Trash2, X, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, Copy, Save, Printer, Star,
  TrendingUp, Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { UserRole as Role } from "@/types/roles";
import { cn } from "@/lib/utils";
import { SpecialsTab } from "./_specials-tab";
import { FunctionMenusTab } from "./_function-menus-tab";

// ── Types ─────────────────────────────────────────────────────────────────────

type DishCategory = "starter" | "main" | "dessert" | "drinks" | "sides" | "other";

interface StockItem { id: string; name: string; unit: string; lastPrice?: number | null; }

interface DishIngredient {
  id?: string;
  name: string;
  stockItemId?: string | null;
  qty: number;
  unit: string;
  stockItem?: { id: string; name: string; unit: string; lastPrice?: number | null } | null;
}

interface Dish {
  id: string;
  name: string;
  description?: string | null;
  category: DishCategory;
  sellPrice?: number | null;
  costPrice?: number | null;
  imageUrl?: string | null;
  active: boolean;
  ingredients: DishIngredient[];
}

interface MenuTemplate { id: string; name: string; planData: WeekPlan; createdAt: string; }

type MealPeriod = "breakfast" | "lunch" | "dinner";
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type Day = typeof DAYS[number];
const DAY_LABELS: Record<Day, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const MEAL_PERIODS: MealPeriod[] = ["breakfast", "lunch", "dinner"];
const MEAL_ICONS: Record<MealPeriod, string> = { breakfast: "☀️", lunch: "🌤️", dinner: "🌙" };

type WeekPlan = Record<Day, Record<MealPeriod, string[]>>;

function emptyPlan(): WeekPlan {
  const plan = {} as WeekPlan;
  for (const day of DAYS) {
    plan[day] = { breakfast: [], lunch: [], dinner: [] };
  }
  return plan;
}

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString("en-IE", { day: "numeric", month: "short" })} – ${sunday.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}`;
}

const DISH_CATEGORIES: { value: DishCategory; label: string }[] = [
  { value: "starter", label: "Starter" },
  { value: "main", label: "Main" },
  { value: "dessert", label: "Dessert" },
  { value: "drinks", label: "Drinks" },
  { value: "sides", label: "Sides" },
  { value: "other", label: "Other" },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "specials", label: "Specials Board", icon: Utensils },
  { id: "planner", label: "Weekly Planner", icon: CalendarDays },
  { id: "dishes", label: "Dish Library", icon: BookOpen },
  { id: "templates", label: "Templates", icon: Layers },
  { id: "functions", label: "Function Menus", icon: ChefHat },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

function MenuInner() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const permissions = session?.user?.permissions ?? [];
  const canEdit = role === Role.ADMIN || role === Role.MANAGER || permissions.includes("menu_planning");

  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "specials");

  function switchTab(id: string) {
    setActiveTab(id);
    router.replace(`/menu-specials?tab=${id}`, { scroll: false });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <ChefHat className="h-7 w-7 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Menu & Planning</h1>
          <p className="text-slate-500 text-sm">Manage your menu, plan your week, and get AI suggestions</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                activeTab === tab.id
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "specials" && <SpecialsTab />}
      {activeTab === "planner" && <PlannerTab canEdit={canEdit} />}
      {activeTab === "dishes" && <DishLibraryTab canEdit={canEdit} />}
      {activeTab === "templates" && <TemplatesTab canEdit={canEdit} />}
      {activeTab === "functions" && <FunctionMenusTab canEdit={canEdit} />}
    </div>
  );
}

// ── Weekly Planner Tab ────────────────────────────────────────────────────────

function PlannerTab({ canEdit }: { canEdit: boolean }) {
  const [weekStart, setWeekStart] = useState<Date>(getMondayOf(new Date()));
  const [plan, setPlan] = useState<WeekPlan>(emptyPlan());
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [activeMeal, setActiveMeal] = useState<{ day: Day; period: MealPeriod } | null>(null);
  const [searchDish, setSearchDish] = useState("");

  const weekKey = weekStart.toISOString().split("T")[0];

  const loadData = useCallback(async () => {
    setLoading(true);
    const [planRes, dishRes, tmplRes] = await Promise.all([
      fetch(`/api/menu/plans?weekStart=${weekKey}`),
      fetch("/api/menu/dishes"),
      fetch("/api/menu/templates"),
    ]);
    const planData = planRes.ok ? await planRes.json() : {};
    const dishData = dishRes.ok ? await dishRes.json() : {};
    const tmplData = tmplRes.ok ? await tmplRes.json() : {};

    setPlan(planData.plan?.planData ?? emptyPlan());
    setDishes(dishData.dishes ?? []);
    setTemplates(tmplData.templates ?? []);
    setLoading(false);
  }, [weekKey]);

  useEffect(() => { loadData(); }, [loadData]);

  async function savePlan() {
    setSaving(true);
    await fetch("/api/menu/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weekStart: weekKey, planData: plan }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function fetchAiSuggestions() {
    setLoadingAi(true);
    setAiError("");
    const r = await fetch("/api/menu/ai-suggestions");
    const d = await r.json();
    if (!r.ok) { setAiError(d.error ?? "AI unavailable"); setLoadingAi(false); return; }
    setAiSuggestions(d.suggestions ?? []);
    setLoadingAi(false);
  }

  async function saveAsTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    await fetch("/api/menu/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: templateName.trim(), planData: plan }),
    });
    setSavingTemplate(false);
    setShowSaveTemplate(false);
    setTemplateName("");
    const r = await fetch("/api/menu/templates");
    const d = r.ok ? await r.json() : {};
    setTemplates(d.templates ?? []);
  }

  function applyTemplate(tmpl: MenuTemplate) {
    setPlan(tmpl.planData);
  }

  function addDishToSlot(day: Day, period: MealPeriod, dishId: string) {
    setPlan((prev) => {
      const slot = prev[day][period];
      if (slot.includes(dishId)) return prev;
      return { ...prev, [day]: { ...prev[day], [period]: [...slot, dishId] } };
    });
    setActiveMeal(null);
    setSearchDish("");
  }

  function removeDishFromSlot(day: Day, period: MealPeriod, dishId: string) {
    setPlan((prev) => ({
      ...prev,
      [day]: { ...prev[day], [period]: prev[day][period].filter((id) => id !== dishId) },
    }));
  }

  function getDish(id: string) { return dishes.find((d) => d.id === id); }

  const filteredDishes = dishes.filter(
    (d) => d.active && d.name.toLowerCase().includes(searchDish.toLowerCase())
  );

  function prevWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  }
  function nextWeek() {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  }

  function handlePrint() { window.print(); }

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <button onClick={prevWeek} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">{formatWeekRange(weekStart)}</span>
          <button onClick={nextWeek} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Apply template */}
          {templates.length > 0 && canEdit && (
            <Select onValueChange={(id) => { const t = templates.find((t) => t.id === id); if (t) applyTemplate(t); }}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="Apply template…" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canEdit && (
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowSaveTemplate(true)}>
              <Save className="h-3.5 w-3.5 mr-1" />Save as template
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1" />Print
          </Button>
          {canEdit && (
            <Button size="sm" className="h-8 text-xs bg-orange-500 hover:bg-orange-600" onClick={savePlan} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
              {saved ? "Saved!" : "Save plan"}
            </Button>
          )}
        </div>
      </div>

      {/* AI Suggestions */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-semibold text-orange-800">AI Dish Suggestions</span>
            <span className="text-xs text-orange-500">Based on your current stock</span>
          </div>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
            onClick={fetchAiSuggestions} disabled={loadingAi}
          >
            {loadingAi ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
            {loadingAi ? "Thinking…" : aiSuggestions.length > 0 ? "Refresh" : "Get suggestions"}
          </Button>
        </div>
        {aiError && <p className="text-xs text-red-600">{aiError}</p>}
        {aiSuggestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
            {aiSuggestions.map((s, i) => (
              <AiSuggestionCard key={i} suggestion={s} />
            ))}
          </div>
        )}
        {aiSuggestions.length === 0 && !loadingAi && !aiError && (
          <p className="text-xs text-orange-600 opacity-70">Hit &quot;Get suggestions&quot; to get AI-powered dish ideas based on your overstocked items.</p>
        )}
      </div>

      {/* Planner grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white print:border-0">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="py-2.5 px-3 text-left text-xs font-semibold text-slate-500 w-24">Meal</th>
              {DAYS.map((day) => (
                <th key={day} className="py-2.5 px-2 text-center text-xs font-semibold text-slate-700">{DAY_LABELS[day]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_PERIODS.map((period) => (
              <tr key={period} className="border-b border-slate-100 last:border-0">
                <td className="py-3 px-3 align-top">
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <span>{MEAL_ICONS[period]}</span>
                    <span className="capitalize">{period}</span>
                  </span>
                </td>
                {DAYS.map((day) => {
                  const slotDishes = plan[day][period];
                  const isActive = activeMeal?.day === day && activeMeal?.period === period;
                  return (
                    <td key={day} className="py-2 px-1.5 align-top min-w-[110px]">
                      <div className="space-y-1">
                        {slotDishes.map((dishId) => {
                          const dish = getDish(dishId);
                          if (!dish) return null;
                          return (
                            <div key={dishId} className="flex items-start gap-1 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 group">
                              <span className="text-xs text-orange-800 flex-1 leading-tight">{dish.name}</span>
                              {canEdit && (
                                <button
                                  onClick={() => removeDishFromSlot(day, period, dishId)}
                                  className="opacity-0 group-hover:opacity-100 text-orange-400 hover:text-red-500 transition-opacity flex-shrink-0 mt-0.5"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {canEdit && (
                          <button
                            onClick={() => setActiveMeal(isActive ? null : { day, period })}
                            className={cn(
                              "w-full text-xs rounded-lg px-2 py-1 border border-dashed transition-colors text-left",
                              isActive
                                ? "border-orange-400 bg-orange-50 text-orange-600"
                                : "border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-400"
                            )}
                          >
                            <Plus className="h-2.5 w-2.5 inline mr-0.5" />Add
                          </button>
                        )}
                        {/* Dish picker — click buttons, no sliding menu */}
                        {isActive && (
                          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setActiveMeal(null)}>
                            <div className="bg-white rounded-2xl shadow-2xl p-4 w-full max-w-sm mx-4 mb-4 sm:mb-0 space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between">
                                <p className="font-semibold text-slate-800 text-sm capitalize">
                                  {DAY_LABELS[day]} · {period}
                                </p>
                                <button onClick={() => setActiveMeal(null)} className="text-slate-400 hover:text-slate-600">
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <Input
                                autoFocus
                                value={searchDish}
                                onChange={(e) => setSearchDish(e.target.value)}
                                placeholder="Search dish…"
                                className="h-8 text-sm"
                              />
                              <div className="max-h-56 overflow-y-auto space-y-1.5">
                                {filteredDishes.length === 0 && (
                                  <p className="text-sm text-slate-400 text-center py-4">No dishes found</p>
                                )}
                                {filteredDishes.map((dish) => (
                                  <button
                                    key={dish.id}
                                    onClick={() => addDishToSlot(day, period, dish.id)}
                                    className="w-full text-left flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-100 hover:border-orange-300 hover:bg-orange-50 transition-colors group"
                                  >
                                    <span className="text-sm font-medium text-slate-800 group-hover:text-orange-700">{dish.name}</span>
                                    <span className="text-xs text-slate-400 capitalize ml-2 flex-shrink-0">{dish.category}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save template dialog */}
      <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Save as Template</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Template name</Label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Summer Menu Week 1" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
            <Button onClick={saveAsTemplate} disabled={!templateName.trim() || savingTemplate}>
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── AI Suggestion Card ────────────────────────────────────────────────────────

interface AiSuggestion {
  name: string;
  description: string;
  category: string;
  usesIngredients: string[];
}

function AiSuggestionCard({ suggestion }: { suggestion: AiSuggestion }) {
  return (
    <div className="bg-white border border-orange-200 rounded-xl p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold text-slate-800 leading-tight">{suggestion.name}</p>
        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full capitalize flex-shrink-0">
          {suggestion.category}
        </span>
      </div>
      <p className="text-xs text-slate-500 leading-tight">{suggestion.description}</p>
      <div className="flex flex-wrap gap-1 pt-0.5">
        {suggestion.usesIngredients?.slice(0, 3).map((ing, i) => (
          <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">{ing}</span>
        ))}
      </div>
    </div>
  );
}

// ── Dish Library Tab ──────────────────────────────────────────────────────────

function DishLibraryTab({ canEdit }: { canEdit: boolean }) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDish, setEditDish] = useState<Dish | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterCat, setFilterCat] = useState("all");

  async function load() {
    setLoading(true);
    const [dr, sr] = await Promise.all([fetch("/api/menu/dishes"), fetch("/api/stock")]);
    const dd = dr.ok ? await dr.json() : {};
    const sd = sr.ok ? await sr.json() : {};
    setDishes(dd.dishes ?? []);
    setStockItems(sd.items ?? sd.stockItems ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteDish(id: string) {
    if (!confirm("Delete this dish?")) return;
    await fetch(`/api/menu/dishes/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = filterCat === "all" ? dishes : dishes.filter((d) => d.category === filterCat);
  const grouped = DISH_CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter((d) => d.category === cat.value && d.active);
    if (items.length > 0) acc[cat.value] = items;
    return acc;
  }, {} as Record<string, Dish[]>);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterCat("all")}
            className={cn("text-xs px-3 py-1.5 rounded-full font-medium transition-colors",
              filterCat === "all" ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
          >All</button>
          {DISH_CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setFilterCat(c.value)}
              className={cn("text-xs px-3 py-1.5 rounded-full font-medium transition-colors capitalize",
                filterCat === c.value ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
            >{c.label}</button>
          ))}
        </div>
        {canEdit && (
          <Button size="sm" className="bg-orange-500 hover:bg-orange-600" onClick={() => { setEditDish(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1.5" />Add dish
          </Button>
        )}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
          <BookOpen className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-600">No dishes yet</p>
          {canEdit && <p className="text-sm text-slate-400 mt-1">Add dishes to build your library</p>}
        </div>
      )}

      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 capitalize">{cat}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((dish) => (
              <DishCard key={dish.id} dish={dish} canEdit={canEdit}
                onEdit={() => { setEditDish(dish); setShowForm(true); }}
                onDelete={() => deleteDish(dish.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {showForm && (
        <DishFormModal
          dish={editDish}
          stockItems={stockItems}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function DishCard({ dish, canEdit, onEdit, onDelete }: {
  dish: Dish; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const margin = dish.sellPrice && dish.costPrice
    ? Math.round(((dish.sellPrice - dish.costPrice) / dish.sellPrice) * 100)
    : null;
  const autoCost = dish.ingredients.length > 0
    ? dish.ingredients.reduce((sum, ing) => {
      const price = ing.stockItem?.lastPrice ?? 0;
      return sum + price * ing.qty;
    }, 0)
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 hover:border-orange-200 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{dish.name}</p>
          {dish.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{dish.description}</p>}
        </div>
        {canEdit && (
          <div className="flex gap-1 flex-shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"><Pencil className="h-3.5 w-3.5" /></button>
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        {dish.sellPrice != null && (
          <span className="font-medium text-slate-700">€{dish.sellPrice.toFixed(2)}</span>
        )}
        {(dish.costPrice != null || autoCost !== null) && (
          <span className="text-slate-400">
            Cost: €{(dish.costPrice ?? autoCost ?? 0).toFixed(2)}
          </span>
        )}
        {margin !== null && (
          <span className={cn("font-medium", margin >= 70 ? "text-emerald-600" : margin >= 50 ? "text-amber-600" : "text-red-500")}>
            {margin}% margin
          </span>
        )}
      </div>

      {dish.ingredients.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dish.ingredients.slice(0, 4).map((ing, i) => (
            <span key={i} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {ing.name} {ing.qty}{ing.unit !== "unit" ? ing.unit : ""}
            </span>
          ))}
          {dish.ingredients.length > 4 && (
            <span className="text-[10px] text-slate-400">+{dish.ingredients.length - 4} more</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dish Form Modal ───────────────────────────────────────────────────────────

function DishFormModal({ dish, stockItems, onClose, onSaved }: {
  dish: Dish | null;
  stockItems: StockItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [category, setCategory] = useState<DishCategory>(dish?.category ?? "main");
  const [sellPrice, setSellPrice] = useState(dish?.sellPrice?.toString() ?? "");
  const [costPrice, setCostPrice] = useState(dish?.costPrice?.toString() ?? "");
  const [ingredients, setIngredients] = useState<DishIngredient[]>(dish?.ingredients ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const autoCost = ingredients.reduce((sum, ing) => {
    const si = stockItems.find((s) => s.id === ing.stockItemId);
    return sum + (si?.lastPrice ?? 0) * ing.qty;
  }, 0);

  function addIngredient() {
    setIngredients((prev) => [...prev, { name: "", qty: 1, unit: "unit", stockItemId: null }]);
  }
  function removeIngredient(i: number) {
    setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateIngredient(i: number, field: string, value: string | number | null) {
    setIngredients((prev) => prev.map((ing, idx) => idx === i ? { ...ing, [field]: value } : ing));
  }
  function pickStockItem(i: number, stockId: string) {
    const si = stockItems.find((s) => s.id === stockId);
    setIngredients((prev) => prev.map((ing, idx) =>
      idx === i ? { ...ing, stockItemId: stockId, name: si?.name ?? ing.name, unit: si?.unit ?? ing.unit } : ing
    ));
  }

  async function save() {
    if (!name.trim()) { setError("Name required"); return; }
    setSaving(true);
    setError("");
    const payload = { name, description, category, sellPrice, costPrice, ingredients };
    const url = dish ? `/api/menu/dishes/${dish.id}` : "/api/menu/dishes";
    const method = dish ? "PATCH" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) { setError(d.error ?? "Error saving"); setSaving(false); return; }
    onSaved();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? "Edit Dish" : "Add Dish"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grilled Sirloin" />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as DishCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DISH_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sell Price (€)</Label>
              <Input type="number" step="0.01" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Short description…" />
            </div>
          </div>

          {/* Recipe / Ingredients */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Recipe Ingredients</Label>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={addIngredient}>
                <Plus className="h-3 w-3 mr-1" />Add ingredient
              </Button>
            </div>
            {ingredients.length > 0 && (
              <div className="space-y-2">
                {ingredients.map((ing, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Select value={ing.stockItemId ?? ""} onValueChange={(v) => v ? pickStockItem(i, v) : updateIngredient(i, "stockItemId", null)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Stock item…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Custom</SelectItem>
                          {stockItems.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-4">
                      <Input className="h-8 text-xs" value={ing.name} onChange={(e) => updateIngredient(i, "name", e.target.value)} placeholder="Ingredient name" />
                    </div>
                    <div className="col-span-2">
                      <Input className="h-8 text-xs" type="number" step="0.01" value={ing.qty} onChange={(e) => updateIngredient(i, "qty", parseFloat(e.target.value))} placeholder="Qty" />
                    </div>
                    <div className="col-span-1">
                      <Input className="h-8 text-xs" value={ing.unit} onChange={(e) => updateIngredient(i, "unit", e.target.value)} placeholder="unit" />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => removeIngredient(i)} className="text-slate-400 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Food cost calculation */}
            {ingredients.length > 0 && (
              <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-4 text-sm">
                <span className="text-slate-500">Auto food cost:</span>
                <span className="font-semibold text-slate-800">€{autoCost.toFixed(2)}</span>
                {sellPrice && parseFloat(sellPrice) > 0 && (
                  <>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">Margin:</span>
                    <span className={cn("font-semibold", ((parseFloat(sellPrice) - autoCost) / parseFloat(sellPrice)) * 100 >= 65 ? "text-emerald-600" : "text-amber-600")}>
                      {Math.round(((parseFloat(sellPrice) - autoCost) / parseFloat(sellPrice)) * 100)}%
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {dish ? "Save changes" : "Add dish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Templates Tab ─────────────────────────────────────────────────────────────

function TemplatesTab({ canEdit }: { canEdit: boolean }) {
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load() {
    setLoading(true);
    const [tr, dr] = await Promise.all([fetch("/api/menu/templates"), fetch("/api/menu/dishes")]);
    const td = tr.ok ? await tr.json() : {};
    const dd = dr.ok ? await dr.json() : {};
    setTemplates(td.templates ?? []);
    setDishes(dd.dishes ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch("/api/menu/templates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  function useTemplate(tmpl: MenuTemplate) {
    // Navigate to planner with this template applied via localStorage
    localStorage.setItem("rotahr_apply_template", JSON.stringify(tmpl.planData));
    router.push("/menu-specials?tab=planner&applyTemplate=1");
  }

  function getDishName(id: string) { return dishes.find((d) => d.id === id)?.name ?? id; }

  function countDishes(planData: WeekPlan) {
    let count = 0;
    for (const day of DAYS) {
      for (const period of MEAL_PERIODS) {
        count += planData[day]?.[period]?.length ?? 0;
      }
    }
    return count;
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-slate-300" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Save your weekly plans as reusable templates and apply them in one click.</p>
        <Button size="sm" variant="outline" onClick={() => router.push("/menu-specials?tab=planner")}>
          <CalendarDays className="h-4 w-4 mr-1.5" />Go to Planner
        </Button>
      </div>

      {templates.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-20 text-center">
          <Layers className="h-10 w-10 mx-auto mb-3 text-slate-200" />
          <p className="font-medium text-slate-600">No templates yet</p>
          <p className="text-sm text-slate-400 mt-1">Build a weekly plan then save it as a template</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((tmpl) => {
          const totalDishes = countDishes(tmpl.planData);
          return (
            <div key={tmpl.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 hover:border-orange-200 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{tmpl.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {totalDishes} dish slots · {new Date(tmpl.createdAt).toLocaleDateString("en-IE")}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => deleteTemplate(tmpl.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Preview grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {DAYS.map((day) => {
                  const totalForDay = MEAL_PERIODS.reduce((s, p) => s + (tmpl.planData[day]?.[p]?.length ?? 0), 0);
                  return (
                    <div key={day} className="text-center">
                      <p className="text-[9px] text-slate-400 font-medium">{DAY_LABELS[day]}</p>
                      <div className={cn("mt-0.5 h-6 rounded text-[10px] flex items-center justify-center font-medium",
                        totalForDay > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"
                      )}>
                        {totalForDay > 0 ? totalForDay : "–"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 h-8 text-xs" onClick={() => useTemplate(tmpl)}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />Apply to planner
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuInner />
    </Suspense>
  );
}
