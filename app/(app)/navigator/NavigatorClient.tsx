"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Compass,
  Sun,
  ListChecks,
  Utensils,
  Activity,
  Repeat,
  Timer,
  MessageCircle,
  SlidersHorizontal,
  Gauge,
  RefreshCw,
} from "lucide-react";
import { NavState } from "./types";
import { Btn, Pill, Spinner } from "./nav-ui";
import { TodayTab } from "./TodayTab";
import { TasksTab } from "./TasksTab";
import { FoodTab } from "./FoodTab";
import { MoveTab } from "./MoveTab";
import { HabitsTab } from "./HabitsTab";
import { FocusTab } from "./FocusTab";
import { ChatTab } from "./ChatTab";
import { SetupTab } from "./SetupTab";
import { SystemTab } from "./SystemTab";

const TABS = [
  { id: "today", label: "Today", icon: Sun },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "food", label: "Food", icon: Utensils },
  { id: "move", label: "Move", icon: Activity },
  { id: "habits", label: "Habits", icon: Repeat },
  { id: "focus", label: "Focus", icon: Timer },
  { id: "chat", label: "Chat", icon: MessageCircle },
  { id: "system", label: "System", icon: Gauge },
  { id: "setup", label: "Setup", icon: SlidersHorizontal },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function NavigatorClient({ firstName }: { firstName: string }) {
  const [state, setState] = useState<NavState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("today");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const res = await fetch("/api/navigator/state", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not load Navigator");
      setState(await res.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Navigator");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the header clock and any live focus timer honest without hammering the API.
  useEffect(() => {
    const t = setInterval(() => load(true), 120_000);
    return () => clearInterval(t);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const greeting = useMemo(() => {
    const hour = Number((state?.now ?? "09:00").slice(0, 2));
    if (hour < 5) return "Still up";
    if (hour < 12) return "Morning";
    if (hour < 18) return "Afternoon";
    return "Evening";
  }, [state?.now]);

  const openCount = state?.tasks.filter((t) => !t.parentId).length ?? 0;

  return (
    <div className="text-slate-100">
      {/* Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff6b35] to-[#e8365d] shadow-[0_12px_34px_-14px_rgba(232,54,93,0.85)]">
            <Compass className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-[28px]">
              Navigator
            </h1>
            <p className="text-sm text-slate-400">
              {greeting}, {firstName}
              {state ? ` · ${state.now}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state?.focus && <Pill tone="flame">Focus live: {state.focus.label}</Pill>}
          {openCount > 0 && <Pill tone="slate">{openCount} open</Pill>}
          <button
            onClick={() => load()}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-2 text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="mb-6 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all ${
                active
                  ? "bg-gradient-to-br from-[#ff6b35] to-[#e8365d] text-white shadow-[0_10px_28px_-14px_rgba(232,54,93,0.9)]"
                  : "border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09] hover:text-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      {error && (
        <div className="mb-5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
          <Btn size="sm" variant="quiet" className="ml-3" onClick={() => load()}>
            Try again
          </Btn>
        </div>
      )}

      {!state ? (
        <Spinner label="Loading your day…" />
      ) : (
        <>
          {tab === "today" && <TodayTab state={state} refresh={refresh} />}
          {tab === "tasks" && <TasksTab state={state} refresh={refresh} />}
          {tab === "food" && <FoodTab state={state} refresh={refresh} />}
          {tab === "move" && <MoveTab state={state} refresh={refresh} />}
          {tab === "habits" && <HabitsTab state={state} refresh={refresh} />}
          {tab === "focus" && <FocusTab state={state} refresh={refresh} />}
          {tab === "chat" && <ChatTab state={state} refresh={refresh} />}
          {tab === "system" && <SystemTab />}
          {tab === "setup" && <SetupTab state={state} refresh={refresh} />}
        </>
      )}
    </div>
  );
}
