"use client";

import { cn } from "@/lib/format";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  variant = "primary",
  className,
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger"; loading?: boolean }) {
  return (
    <button
      className={cn("btn", variant === "primary" && "btn-primary", variant === "ghost" && "btn-ghost", variant === "danger" && "btn-danger", className)}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("select", props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("textarea min-h-24", props.className)} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  const unpadded = className?.split(/\s+/).includes("p-0");
  return <section className={cn("card", !unpadded && "p-5", className)}>{children}</section>;
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="stat">
      <p className="eyebrow">{label}</p>
      <p className={cn("stat-value", tone === "up" && "text-[var(--green)]", tone === "down" && "text-[var(--red)]")}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Image src="/empty-journal.png" alt="" width={112} height={112} className="brand-mark mb-6 h-28 w-28" />
      <p className="eyebrow">Blank page</p>
      <h3 className="mt-2 text-2xl">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Banner({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "good" }) {
  return <div className={cn("banner", tone === "warn" && "banner-warn", tone === "good" && "banner-good")}>{children}</div>;
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("badge", className)}>{children}</span>;
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[var(--muted)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="eyebrow">{label}</span>
    </div>
  );
}
