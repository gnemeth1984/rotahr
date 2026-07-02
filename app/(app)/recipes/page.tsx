"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChefHat, Plus, Pencil, Trash2, X, Check, AlertTriangle,
  TrendingUp, Package, Search, Filter, ImagePlus, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/shared/CurrencyProvider";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockItem {
  id: string;
  name: string;
  unit: string;
  lastPrice: number | null;
}

interface Ingredient {
  id: string;
  name: string;
  qty: number;
  unit: string;
  stockItem?: StockItem | null;
  stockItemId?: string | null;
}

interface Dish {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  sellPrice?: number | null;
  costPrice?: number | null;
  imageUrl?: string | null;
  active: boolean;
  ingredients: Ingredient[];
}

const CATEGORIES = ["starter", "main", "dessert", "drinks", "sides", "other"];
const UNITS = ["unit", "kg", "g", "litre", "ml", "portion", "slice", "bunch", "case", "box", "bottle"];

// ─── GP% calc ─────────────────────────────────────────────────────────────────
function calcCost(ingredients: Ingredient[]): number {
  return ingredients.reduce((sum, ing) => {
    const price = ing.stockItem?.lastPrice ?? 0;
    return sum + ing.qty * price;
  }, 0);
}

function gpPct(cost: number, sell: number | null | undefined): number | null {
  if (!sell || sell === 0 || cost === 0) return null;
  return ((sell - cost) / sell) * 100;
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────
function RecipeCard({
  dish,
  fmt,
  onEdit,
  onDelete,
}: {
  dish: Dish;
  fmt: (n: number) => string;
  onEdit: (d: Dish) => void;
  onDelete: (id: string) => void;
}) {
  const liveCost = calcCost(dish.ingredients);
  const gp = gpPct(liveCost, dish.sellPrice);
  const gpColor =
    gp === null ? "text-slate-400" :
    gp >= 65 ? "text-green-600" :
    gp >= 50 ? "text-amber-600" :
    "text-red-600";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow">
      {dish.imageUrl && (
        <div className="mb-3 -mx-1 -mt-1">
          <img
            src={dish.imageUrl}
            alt={dish.name}
            className="w-full h-36 object-cover rounded-lg border border-slate-100"
          />
        </div>
      )}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-800 text-sm">{dish.name}</h3>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full capitalize">
              {dish.category}
            </span>
          </div>
          {dish.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{dish.description}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onEdit(dish)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(dish.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-xs text-slate-400 mb-0.5">Cost/portion</p>
          <p className="text-sm font-bold text-slate-800">{fmt(liveCost)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-xs text-slate-400 mb-0.5">Sell price</p>
          <p className="text-sm font-bold text-slate-800">
            {dish.sellPrice ? fmt(dish.sellPrice) : <span className="text-slate-300">—</span>}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-xs text-slate-400 mb-0.5">GP%</p>
          <p className={cn("text-sm font-bold", gpColor)}>
            {gp !== null ? `${gp.toFixed(1)}%` : <span className="text-slate-300">—</span>}
          </p>
        </div>
      </div>

      {/* Ingredients */}
      {dish.ingredients.length > 0 && (
        <div className="space-y-1">
          {dish.ingredients.map((ing) => (
            <div key={ing.id} className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3 text-slate-300" />
                {ing.name} × {ing.qty} {ing.unit}
              </span>
              <span className="font-mono">
                {ing.stockItem?.lastPrice
                  ? fmt(ing.qty * ing.stockItem.lastPrice)
                  : <span className="text-slate-300">no price</span>}
              </span>
            </div>
          ))}
        </div>
      )}
      {dish.ingredients.length === 0 && (
        <p className="text-xs text-slate-300 italic">No ingredients added yet</p>
      )}
    </div>
  );
}

// ─── Recipe Dialog ────────────────────────────────────────────────────────────
function RecipeDialog({
  dish,
  stockItems,
  fmt,
  onClose,
  onSave,
}: {
  dish: Dish | null;
  stockItems: StockItem[];
  fmt: (n: number) => string;
  onClose: () => void;
  onSave: () => void;
}) {
  const isNew = !dish;
  const [name, setName] = useState(dish?.name ?? "");
  const [description, setDescription] = useState(dish?.description ?? "");
  const [category, setCategory] = useState(dish?.category ?? "main");
  const [sellPrice, setSellPrice] = useState(dish?.sellPrice?.toString() ?? "");
  const [ingredients, setIngredients] = useState<Ingredient[]>(dish?.ingredients ?? []);
  const [imageUrl, setImageUrl] = useState(dish?.imageUrl ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageErr, setImageErr] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageErr("");
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/menu/dishes/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImageUrl(data.url);
    } catch (e: any) {
      setImageErr(e.message);
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  // new ingredient row
  const [newIngName, setNewIngName] = useState("");
  const [newIngQty, setNewIngQty] = useState("1");
  const [newIngUnit, setNewIngUnit] = useState("unit");
  const [newIngStockId, setNewIngStockId] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockDropOpen, setStockDropOpen] = useState(false);
  const stockInputRef = useRef<HTMLInputElement>(null);

  const liveCost = calcCost(ingredients);
  const sell = parseFloat(sellPrice) || null;
  const gp = gpPct(liveCost, sell);
  const gpColor = gp === null ? "text-slate-400" : gp >= 65 ? "text-green-600" : gp >= 50 ? "text-amber-600" : "text-red-600";

  function addIngredient() {
    if (!newIngName.trim() || !newIngQty) return;
    const si = stockItems.find((s) => s.id === newIngStockId) ?? null;
    setIngredients((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: newIngName.trim(),
        qty: parseFloat(newIngQty),
        unit: newIngUnit,
        stockItemId: si?.id ?? null,
        stockItem: si,
      },
    ]);
    setNewIngName("");
    setNewIngQty("1");
    setNewIngStockId("");
    setStockSearch("");
  }

  function pickStockItem(id: string) {
    setNewIngStockId(id);
    const si = stockItems.find((s) => s.id === id);
    if (si) {
      setNewIngName(si.name);
      setNewIngUnit(si.unit);
      setStockSearch(si.name);
    }
  }

  const stockMatches = stockSearch.trim()
    ? stockItems.filter((s) => s.name.toLowerCase().includes(stockSearch.toLowerCase()))
    : stockItems;

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!name.trim()) { setErr("Name is required"); return; }
    setSaving(true);
    setErr("");
    try {
      // 1. Save/update the dish
      let dishId = dish?.id;
      if (isNew) {
        const res = await fetch("/api/menu/dishes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, category, sellPrice: sellPrice || null, imageUrl: imageUrl || null }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed");
        dishId = data.dish.id;
      } else {
        const res = await fetch(`/api/menu/dishes/${dish!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, category, sellPrice: sellPrice || null, imageUrl: imageUrl || null }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed");
        }
      }

      // 2. Replace ingredients via PATCH
      await fetch(`/api/menu/dishes/${dishId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellPrice: sellPrice || null,
          ingredients: ingredients.map((ing) => ({
            name: ing.name,
            qty: ing.qty,
            unit: ing.unit,
            stockItemId: ing.stockItemId ?? null,
          })),
        }),
      });

      onSave();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="font-bold text-lg text-slate-800">
            {isNew ? "New Recipe" : "Edit Recipe"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {err && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{err}</div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Recipe name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="e.g. Beef Burger"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Sell price</label>
              <input
                type="number"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="0.00"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                placeholder="Brief description"
              />
            </div>
          </div>

          {/* Dish photo */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Photo of finished dish <span className="text-slate-300 font-normal">(so chefs know how it should look)</span>
            </label>
            {imageErr && <p className="text-xs text-red-500 mb-1">{imageErr}</p>}
            {imageUrl ? (
              <div className="relative w-full h-44 rounded-lg overflow-hidden border border-slate-200">
                <img src={imageUrl} alt={name || "Dish"} className="w-full h-full object-cover" />
                <button
                  onClick={() => setImageUrl("")}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/75 text-white rounded-full p-1.5"
                  title="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-slate-700 text-xs font-medium rounded-lg px-2.5 py-1.5 flex items-center gap-1"
                >
                  {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  Replace
                </button>
              </div>
            ) : (
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:border-violet-300 hover:text-violet-500 transition-colors"
              >
                {uploadingImage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-xs">Uploading…</span>
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-xs">Tap to upload a photo</span>
                  </>
                )}
              </button>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Live cost preview */}
          {ingredients.length > 0 && (
            <div className="bg-violet-50 border border-violet-100 rounded-xl p-4 flex gap-4">
              <div className="text-center flex-1">
                <p className="text-xs text-violet-400 mb-0.5">Cost/portion</p>
                <p className="font-bold text-violet-700">{fmt(liveCost)}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-violet-400 mb-0.5">Sell price</p>
                <p className="font-bold text-violet-700">{sell ? fmt(sell) : "—"}</p>
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-violet-400 mb-0.5">GP%</p>
                <p className={cn("font-bold", gpColor)}>{gp !== null ? `${gp.toFixed(1)}%` : "—"}</p>
              </div>
            </div>
          )}

          {/* Ingredients */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Ingredients</label>
            {ingredients.length > 0 && (
              <div className="space-y-1 mb-3">
                {ingredients.map((ing, idx) => (
                  <div key={ing.id} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-slate-700">{ing.name}</span>
                    <span className="text-slate-500 text-xs">{ing.qty} {ing.unit}</span>
                    {ing.stockItem?.lastPrice && (
                      <span className="text-slate-400 text-xs font-mono">{fmt(ing.qty * ing.stockItem.lastPrice)}</span>
                    )}
                    <button onClick={() => removeIngredient(idx)} className="text-slate-300 hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add ingredient row */}
            <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-slate-400">Add ingredient</p>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-5 relative">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    <input
                      ref={stockInputRef}
                      type="text"
                      value={stockSearch}
                      placeholder="Search stock…"
                      autoComplete="off"
                      className="w-full border border-slate-200 rounded-lg pl-6 pr-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                      onChange={(e) => {
                        setStockSearch(e.target.value);
                        setStockDropOpen(true);
                        if (!e.target.value.trim()) {
                          setNewIngStockId("");
                        }
                      }}
                      onFocus={() => setStockDropOpen(true)}
                      onBlur={() => setTimeout(() => setStockDropOpen(false), 150)}
                    />
                  </div>
                  {stockDropOpen && stockMatches.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                      {stockMatches.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); pickStockItem(s.id); setStockDropOpen(false); }}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs hover:bg-violet-50 flex items-center justify-between gap-2",
                            newIngStockId === s.id && "bg-violet-50 text-violet-700 font-medium"
                          )}
                        >
                          <span>{s.name}</span>
                          <span className="text-slate-400 shrink-0">{s.unit}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-5">
                  <input
                    value={newIngName}
                    onChange={(e) => setNewIngName(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    placeholder="or type name"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.001"
                    value={newIngQty}
                    onChange={(e) => setNewIngQty(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                    placeholder="Qty"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={newIngUnit}
                  onChange={(e) => setNewIngUnit(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                >
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  onClick={addIngredient}
                  className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white text-xs rounded-lg hover:bg-violet-700 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" /> Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-sm bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? "Saving…" : <><Check className="h-4 w-4" /> Save recipe</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RecipesPage() {
  const { fmt } = useCurrency();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [dialog, setDialog] = useState<{ open: boolean; dish: Dish | null }>({ open: false, dish: null });

  const load = useCallback(async () => {
    setLoading(true);
    const [dishRes, stockRes] = await Promise.all([
      fetch("/api/menu/dishes"),
      fetch("/api/stock"),
    ]);
    const { dishes: d } = await dishRes.json();
    const stockData = await stockRes.json();
    setDishes(d ?? []);
    setStockItems(stockData.items ?? stockData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteDish(id: string) {
    if (!confirm("Delete this recipe?")) return;
    await fetch(`/api/menu/dishes/${id}`, { method: "DELETE" });
    setDishes((prev) => prev.filter((d) => d.id !== id));
  }

  const filtered = dishes.filter((d) => {
    const matchSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || d.category === catFilter;
    return matchSearch && matchCat;
  });

  // Summary stats
  const totalRecipes = dishes.length;
  const avgGp = (() => {
    const withGp = dishes
      .map((d) => gpPct(calcCost(d.ingredients), d.sellPrice))
      .filter((g): g is number => g !== null);
    return withGp.length ? withGp.reduce((a, b) => a + b, 0) / withGp.length : null;
  })();
  const lowGpCount = dishes.filter((d) => {
    const g = gpPct(calcCost(d.ingredients), d.sellPrice);
    return g !== null && g < 50;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-violet-500" />
            Recipe Costing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Build recipes from your stock items — live GP% calculated automatically from supplier prices
          </p>
        </div>
        <button
          onClick={() => setDialog({ open: true, dish: null })}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> New Recipe
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total recipes</p>
          <p className="text-2xl font-bold text-slate-800">{totalRecipes}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Average GP%</p>
          <p className={cn("text-2xl font-bold", avgGp === null ? "text-slate-300" : avgGp >= 60 ? "text-green-600" : avgGp >= 50 ? "text-amber-600" : "text-red-600")}>
            {avgGp !== null ? `${avgGp.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 mb-1">Low GP recipes</p>
            <p className={cn("text-2xl font-bold", lowGpCount > 0 ? "text-red-600" : "text-slate-300")}>
              {lowGpCount}
            </p>
          </div>
          {lowGpCount > 0 && <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5" />}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {["all", ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCatFilter(c)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-colors",
                catFilter === c
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {c === "all" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Recipe grid */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Loading recipes…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ChefHat className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">
            {dishes.length === 0 ? "No recipes yet — add your first one" : "No recipes match your filter"}
          </p>
          {dishes.length === 0 && (
            <button
              onClick={() => setDialog({ open: true, dish: null })}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-xl hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" /> Add recipe
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((dish) => (
            <RecipeCard
              key={dish.id}
              dish={dish}
              fmt={fmt}
              onEdit={(d) => setDialog({ open: true, dish: d })}
              onDelete={deleteDish}
            />
          ))}
        </div>
      )}

      {/* Dialog */}
      {dialog.open && (
        <RecipeDialog
          dish={dialog.dish}
          stockItems={stockItems}
          fmt={fmt}
          onClose={() => setDialog({ open: false, dish: null })}
          onSave={() => { setDialog({ open: false, dish: null }); load(); }}
        />
      )}
    </div>
  );
}
