import { format, formatDistanceStrict } from "date-fns";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatMoney(value: string | number | null | undefined, currency = "USD", digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n);
  } catch {
    return `${n.toFixed(digits)} ${currency}`;
  }
}

export function formatNumber(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatPctPoints(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatR(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}R`;
}

export function pnlClass(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return "text-zinc-300";
  return n > 0 ? "text-emerald-400" : "text-rose-400";
}

export function formatDurationMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function formatWhen(iso: string | Date | null | undefined, pattern = "dd MMM yyyy HH:mm"): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, pattern);
}

export function relativeWhen(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return formatDistanceStrict(d, new Date(), { addSuffix: true });
}

export function resultBadge(result: string): { label: string; className: string } {
  if (result === "win") return { label: "Win", className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" };
  if (result === "loss") return { label: "Loss", className: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30" };
  return { label: "B/E", className: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30" };
}
