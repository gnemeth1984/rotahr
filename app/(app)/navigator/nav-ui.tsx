"use client";

import { ReactNode, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

/**
 * Navigator's own dark surface. The rest of Rotahr is light, so everything
 * here is self-contained — no globals touched, no theme switching.
 */
export const NAVY = "#0f1c35";
export const NAVY_DEEP = "#0a1428";
export const FLAME = "linearGradient";

export function Panel({
  children,
  className = "",
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm ${
        glow ? "shadow-[0_0_0_1px_rgba(255,107,53,0.25),0_18px_50px_-20px_rgba(255,107,53,0.35)]" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{children}</h2>
      {right}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "flame" | "ghost" | "quiet" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Btn({
  loading,
  variant = "ghost",
  size = "md",
  className = "",
  children,
  disabled,
  ...rest
}: BtnProps) {
  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-5 py-3.5 text-base rounded-xl",
  }[size];

  const variants = {
    flame:
      "text-white font-semibold bg-gradient-to-br from-[#ff6b35] to-[#e8365d] hover:brightness-110 shadow-[0_10px_30px_-12px_rgba(232,54,93,0.7)]",
    ghost: "text-slate-100 bg-white/[0.06] border border-white/10 hover:bg-white/[0.11]",
    quiet: "text-slate-400 hover:text-slate-100 hover:bg-white/[0.06]",
    danger: "text-rose-200 bg-rose-500/10 border border-rose-400/25 hover:bg-rose-500/20",
  }[variant];

  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 transition-all disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${variants} ${className}`}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "flame" | "green" | "amber" | "blue" | "violet";
}) {
  const tones = {
    slate: "bg-white/[0.06] text-slate-300 border-white/10",
    flame: "bg-[#ff6b35]/15 text-[#ffb08a] border-[#ff6b35]/30",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-400/25",
    amber: "bg-amber-500/15 text-amber-200 border-amber-400/25",
    blue: "bg-sky-500/15 text-sky-200 border-sky-400/25",
    violet: "bg-violet-500/15 text-violet-200 border-violet-400/25",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0a1428] px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-[#ff6b35]/60 focus:ring-2 focus:ring-[#ff6b35]/20";

export function Scale({
  value,
  onChange,
  labels,
}: {
  value: number | null;
  onChange: (v: number) => void;
  labels?: [string, string];
}) {
  return (
    <div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`h-11 flex-1 rounded-xl border text-sm font-semibold transition-all ${
              value === n
                ? "border-transparent bg-gradient-to-br from-[#ff6b35] to-[#e8365d] text-white shadow-[0_8px_24px_-10px_rgba(232,54,93,0.8)]"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.09] hover:text-slate-200"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {labels && (
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-500">
          <span>{labels[0]}</span>
          <span>{labels[1]}</span>
        </div>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export const PRIORITY_TONE: Record<string, "flame" | "amber" | "green" | "slate"> = {
  urgent: "flame",
  important: "amber",
  quickwin: "green",
  later: "slate",
};

export const KIND_TONE: Record<string, "flame" | "amber" | "green" | "blue" | "violet" | "slate"> = {
  deep: "flame",
  admin: "blue",
  meal: "green",
  move: "violet",
  break: "slate",
  transition: "slate",
  rest: "slate",
  social: "amber",
  buffer: "slate",
};
