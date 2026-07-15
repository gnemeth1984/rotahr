// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  NotebookPen,
  StickyNote,
  PackageX,
  Wrench,
  ClipboardList,
  Plus,
  Loader2,
  Check,
  Trash2,
  Camera,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const LOG_TYPES = [
  { value: "note", label: "Shift Note", icon: StickyNote, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "86", label: "86'd Item", icon: PackageX, color: "text-red-600 bg-red-50 border-red-200" },
  { value: "repair", label: "Repair / Maintenance", icon: Wrench, color: "text-amber-600 bg-amber-50 border-amber-200" },
];

function LogTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "note", title: "", description: "" });

  const load = useCallback(async () => {
    const params = filter !== "all" ? `?type=${filter}` : "";
    const res = await fetch(`/api/log-book/entries${params}`);
    if (res.ok) setEntries((await res.json()).entries);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/log-book/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Logged");
      setForm({ type: "note", title: "", description: "" });
      setOpen(false);
      load();
    } catch {
      toast.error("Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  async function toggleResolved(entry: any) {
    await fetch(`/api/log-book/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !entry.resolved }),
    });
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/log-book/entries/${id}`, { method: "DELETE" });
    toast.success("Deleted");
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
            All
          </Button>
          {LOG_TYPES.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={filter === t.value ? "default" : "outline"}
              onClick={() => setFilter(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add entry
        </Button>
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-14 text-slate-400">
          <NotebookPen className="h-8 w-8" />
          <p>No entries yet — log a note, an 86'd item, or a repair issue.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {entries.map((e) => {
            const meta = LOG_TYPES.find((t) => t.value === e.type) || LOG_TYPES[0];
            const Icon = meta.icon;
            return (
              <Card key={e.id} className={cn("border", e.resolved && "opacity-60")}>
                <CardContent className="flex items-start justify-between gap-3 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5 rounded-lg border p-1.5", meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{e.title}</span>
                        {e.resolved && (
                          <Badge variant="success" className="gap-1">
                            <Check className="h-3 w-3" /> Resolved
                          </Badge>
                        )}
                      </div>
                      {e.description && <p className="mt-1 text-sm text-slate-500">{e.description}</p>}
                      <p className="mt-1 text-xs text-slate-400">
                        {e.createdBy?.name || e.createdBy?.email} ·{" "}
                        {new Date(e.createdAt).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}
                        {e.venue?.name ? ` · ${e.venue.name}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {(e.type === "86" || e.type === "repair") && (
                      <Button size="sm" variant="outline" onClick={() => toggleResolved(e)}>
                        {e.resolved ? "Reopen" : "Resolve"}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add log entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOG_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Title — e.g. 'Ran out of Guinness' or 'Walk-in door won't seal'"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Textarea
              placeholder="Details (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TasksTab({ isManager }: { isManager: boolean }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPhotoTaskId, setPendingPhotoTaskId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    frequency: "once",
    dueDate: "",
    requirePhoto: false,
    assignedToId: "",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/log-book/tasks");
    if (res.ok) setTasks((await res.json()).tasks);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (isManager) {
      fetch("/api/employees")
        .then((r) => r.json())
        .then((d) => setEmployees(d.employees || d || []))
        .catch(() => {});
    }
  }, [load, isManager]);

  async function handleCreate() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/log-book/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, dueDate: form.dueDate || null, assignedToId: form.assignedToId || null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Task created");
      setForm({ title: "", description: "", frequency: "once", dueDate: "", requirePhoto: false, assignedToId: "" });
      setOpen(false);
      load();
    } catch {
      toast.error("Couldn't create task — try again");
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(task: any) {
    if (!task.completed && task.requirePhoto && !task.photoUrl) {
      setPendingPhotoTaskId(task.id);
      fileInputRef.current?.click();
      return;
    }
    await fetch(`/api/log-book/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    load();
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingPhotoTaskId) return;
    setUploadingFor(pendingPhotoTaskId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const uploadRes = await fetch("/api/log-book/tasks/upload-photo", { method: "POST", body: fd });
      const { url } = await uploadRes.json();
      await fetch(`/api/log-book/tasks/${pendingPhotoTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true, photoUrl: url }),
      });
      toast.success("Task completed with photo proof");
      load();
    } catch {
      toast.error("Photo upload failed — try again");
    } finally {
      setUploadingFor(null);
      setPendingPhotoTaskId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/log-book/tasks/${id}`, { method: "DELETE" });
    toast.success("Task deleted");
    load();
  }

  const openTasks = tasks.filter((t) => !t.completed);
  const doneTasks = tasks.filter((t) => t.completed);

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-500">{openTasks.length} open task{openTasks.length === 1 ? "" : "s"}</h2>
        {isManager && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New task
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-14 text-slate-400">
          <ClipboardList className="h-8 w-8" />
          <p>No tasks yet.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {[...openTasks, ...doneTasks].map((t) => (
            <Card key={t.id} className={cn("border", t.completed && "opacity-60")}>
              <CardContent className="flex items-start justify-between gap-3 py-3.5">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(t)}
                    disabled={uploadingFor === t.id}
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
                      t.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 hover:border-slate-400"
                    )}
                  >
                    {uploadingFor === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : t.completed ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium text-slate-900", t.completed && "line-through")}>{t.title}</span>
                      {t.frequency !== "once" && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {t.frequency}
                        </Badge>
                      )}
                      {t.requirePhoto && (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <Camera className="h-3 w-3" /> photo required
                        </Badge>
                      )}
                    </div>
                    {t.description && <p className="mt-1 text-sm text-slate-500">{t.description}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      {t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : "Unassigned"}
                      {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString("en-IE")}` : ""}
                      {t.venue?.name ? ` · ${t.venue.name}` : ""}
                    </p>
                    {t.photoUrl && (
                      <a href={t.photoUrl} target="_blank" rel="noreferrer" className="mt-1.5 inline-block">
                        <img src={t.photoUrl} alt="proof" className="h-16 w-16 rounded-md border object-cover" />
                      </a>
                    )}
                  </div>
                </div>
                {isManager && (
                  <Button size="sm" variant="ghost" className="text-slate-400 hover:text-red-500" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Task title — e.g. 'Deep clean fryer'"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Textarea
              placeholder="Details (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="flex gap-2">
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <Select value={form.assignedToId || "__none__"} onValueChange={(v) => setForm({ ...form, assignedToId: v === "__none__" ? "" : v })}>
              <SelectTrigger>
                <SelectValue placeholder="Assign to (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {employees.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.requirePhoto}
                onChange={(e) => setForm({ ...form, requirePhoto: e.target.checked })}
              />
              Require a photo to mark this complete
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LogBookInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "log");

  const isManager = session?.user?.role === "MANAGER" || session?.user?.role === "ADMIN";

  function switchTab(id: string) {
    setActiveTab(id);
    router.replace(`/log-book?tab=${id}`, { scroll: false });
  }

  const tabs = [
    { id: "log", label: "Manager Log", icon: NotebookPen },
    { id: "tasks", label: "Tasks", icon: ClipboardList },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-0">
      <div className="flex items-center gap-3 mb-5">
        <NotebookPen className="h-7 w-7 text-orange-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manager Log Book</h1>
          <p className="text-slate-500 text-sm">Shift notes, 86'd items, repairs, and daily ops tasks — in one place.</p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-5">
        {tabs.map((tab) => {
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

      {activeTab === "log" && <LogTab />}
      {activeTab === "tasks" && <TasksTab isManager={isManager} />}
    </div>
  );
}

export default function LogBookPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" /></div>}>
      <LogBookInner />
    </Suspense>
  );
}
