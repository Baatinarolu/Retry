"use client";

import { formatMoney } from "@/lib/format";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function moneyTip(currency: string) {
  return {
    contentStyle: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 },
    formatter: (v: unknown) => formatMoney(Number(v ?? 0), currency),
  };
}

export function EquityChart({ data, currency }: { data: { t: string; equity: number; cumulativePnl: number }[]; currency: string }) {
  const rows = data.map((d) => ({ ...d, label: d.t.slice(5, 10) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows}>
          <defs>
            <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip {...moneyTip(currency)} />
          <Area type="monotone" dataKey="equity" stroke="#2dd4bf" fill="url(#eq)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PnlBars({ data, currency }: { data: { date: string; pnl: number }[]; currency: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: d.date.slice(5) }))}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip {...moneyTip(currency)} />
          <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.pnl >= 0 ? "#34d399" : "#f87171"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistBars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis type="category" dataKey="label" tick={{ fill: "var(--muted)", fontSize: 11 }} width={90} />
          <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12 }} />
          <Bar dataKey="value" fill="#38bdf8" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
