"use client";

import type { ReactNode } from "react";

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-ink px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-muted focus:border-primary/60";

export function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const styles = {
    primary: "bg-gradient-btn text-white hover:opacity-90",
    ghost: "border border-white/10 bg-panel text-white hover:border-primary/60",
    danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-bold transition disabled:opacity-50 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10">
      <div
        className={`w-full rounded-2xl border border-white/10 bg-panel p-6 shadow-2xl ${
          wide ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function Thumb({
  src,
  alt,
  className = "h-14 w-10",
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return (
      <span
        className={`flex items-center justify-center rounded bg-panel-2 text-[9px] text-muted ${className}`}
      >
        none
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={`rounded object-cover ${className}`} />;
}

export function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-muted"
      }`}
    >
      {text}
    </span>
  );
}
