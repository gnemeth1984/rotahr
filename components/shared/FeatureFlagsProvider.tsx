"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { FeatureKey, FeatureFlag, resolveFeatureFlags } from "@/lib/features";

type FlagMap = Record<FeatureKey, FeatureFlag>;

interface FlagsCtx {
  flags: FlagMap | null;
  loading: boolean;
  reload: () => void;
}

const Ctx = createContext<FlagsCtx>({ flags: null, loading: true, reload: () => {} });

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FlagMap | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const r = await fetch("/api/settings/features");
      if (r.ok) {
        const d = await r.json();
        setFlags(d.flags);
      }
    } catch {
      // silently fail — fall back to show everything
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return <Ctx.Provider value={{ flags, loading, reload: load }}>{children}</Ctx.Provider>;
}

export function useFeatureFlags() {
  return useContext(Ctx);
}

/**
 * Returns true if the feature is enabled AND the role can see it.
 * If flags haven't loaded yet, default to showing everything (graceful).
 */
export function useCanSeeFeature(key: FeatureKey, role: string | undefined): boolean {
  const { flags, loading } = useFeatureFlags();
  if (loading || !flags || !role) return true; // default to visible
  const flag = flags[key];
  if (!flag) return true;
  if (!flag.enabled) return false;
  return flag.roles.includes(role);
}
