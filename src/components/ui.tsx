"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  loading,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "ai" | "danger"; loading?: boolean }) {
  const styles = {
    primary: "bg-neutral-950 text-white hover:bg-neutral-800",
    secondary: "bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50",
    ghost: "text-neutral-700 hover:bg-neutral-100",
    ai: "bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100",
    danger: "text-red-700 hover:bg-red-50",
  }[variant];
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} aria-hidden />;
}

export function Field({ label, hint, children, right }: { label: string; hint?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-neutral-800">
        {label}
        {right}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10";

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const c = {
    info: "bg-sky-50 text-sky-900 border-sky-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-red-50 text-red-900 border-red-200",
    ok: "bg-emerald-50 text-emerald-900 border-emerald-200",
  }[tone];
  return <div className={`rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function StepFooter({ step, total, children }: { step: number; total: number; children: ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <span className="relative h-2 w-14 overflow-hidden rounded-full bg-neutral-200">
          <span className="absolute inset-y-0 left-0 rounded-full bg-emerald-500" style={{ width: `${(step / total) * 100}%` }} />
        </span>
        Step {step} of {total}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export const formatINR = (n: number) => "₹" + n.toLocaleString("en-IN");
