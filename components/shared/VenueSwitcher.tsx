"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Building2, ChevronDown, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Venue {
  id: string;
  name: string;
  isDefault: boolean;
}

// Global venue context — stored in sessionStorage so it persists navigation
const VENUE_KEY = "rotahr_active_venue";

export function getActiveVenueId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(VENUE_KEY);
}

export function VenueSwitcher() {
  const { data: session } = useSession();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetch("/api/venues")
      .then((r) => r.json())
      .then((d) => {
        const v: Venue[] = d.venues ?? [];
        setVenues(v);
        // Restore from session or pick default
        const saved = sessionStorage.getItem(VENUE_KEY);
        const found = saved ? v.find((x) => x.id === saved) : null;
        const defaultV = v.find((x) => x.isDefault) ?? v[0];
        const active = found ?? defaultV;
        if (active) {
          setActiveId(active.id);
          sessionStorage.setItem(VENUE_KEY, active.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  function select(v: Venue) {
    setActiveId(v.id);
    sessionStorage.setItem(VENUE_KEY, v.id);
    // Reload so pages re-fetch with the new venue filter
    window.location.reload();
  }

  // Only show if there are multiple venues
  if (loading || venues.length <= 1) return null;

  const active = venues.find((v) => v.id === activeId) ?? venues[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between px-3 text-slate-300 hover:text-white hover:bg-slate-700 gap-2"
        >
          <span className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 flex-shrink-0" />
            <span className="truncate text-sm">{active?.name ?? "Select venue"}</span>
          </span>
          <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-slate-500">Switch Venue</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {venues.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onClick={() => select(v)}
            className="flex items-center justify-between gap-2 cursor-pointer"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <span className="truncate">{v.name}</span>
              {v.isDefault && (
                <span className="text-xs text-slate-400 flex-shrink-0">(default)</span>
              )}
            </span>
            {v.id === activeId && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
