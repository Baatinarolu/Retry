"use client";

import { formatMoney } from "@/lib/format";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tick = { fill: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)" };
const tooltipStyle = {
  background: "var(--surface-raised)",
  border: "1px solid var(--line-strong)",
  borderRadius: 0,
  boxShadow: "none",
  color: "var(--ink)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
};

function moneyTip(currency: string) {
  return {
    contentStyle: tooltipStyle,
    formatter: (v: unknown) => formatMoney(Number(v ?? 0), currency),
  };
}

export function EquityChart({ data, currency }: { data: { t: string; equity: number; cumulativePnl: number }[]; currency: string }) {
  const rows = data.map((d) => ({ ...d, label: d.t.slice(5, 10) }));
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={54} />
          <Tooltip {...moneyTip(currency)} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke="var(--accent)"
            fill="var(--accent)"
            fillOpacity={0.08}
            strokeWidth={1.8}
            dot={false}
            activeDot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PnlBars({ data, currency }: { data: { date: string; pnl: number }[]; currency: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.map((d) => ({ ...d, label: d.date.slice(5) }))} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={8} />
          <YAxis tick={tick} axisLine={false} tickLine={false} width={54} />
          <Tooltip {...moneyTip(currency)} cursor={{ fill: "var(--accent-wash)", opacity: 0.45 }} />
          <Bar dataKey="pnl" radius={0} maxBarSize={28}>
            {data.map((d, i) => <Cell key={i} fill={d.pnl >= 0 ? "var(--green)" : "var(--red)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExecutionReviewChart({
  data,
  currency,
}: {
  data: Array<{ index: number; price: string; netPnl: string }>;
  currency: string;
}) {
  const rows = data.map((point) => ({
    ...point,
    label: `#${point.index}`,
    priceValue: Number(point.price),
    netValue: Number(point.netPnl),
  }));
  return (
    <div className="h-72" aria-label="Execution prices and running realized P&L">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" vertical={false} />
          <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} dy={8} />
          <YAxis yAxisId="price" tick={tick} axisLine={false} tickLine={false} width={64} domain={["auto", "auto"]} />
          <YAxis yAxisId="pnl" orientation="right" tick={tick} axisLine={false} tickLine={false} width={64} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: unknown, name: unknown) => {
              const numeric = Number(value ?? 0);
              return name === "netPnl" ? formatMoney(numeric, currency) : numeric.toFixed(8);
            }}
          />
          <ReferenceLine yAxisId="pnl" y={0} stroke="var(--line-strong)" />
          <Line yAxisId="price" type="monotone" dataKey="priceValue" name="price" stroke="var(--accent)" strokeWidth={1.8} dot={{ r: 3 }} />
          <Line yAxisId="pnl" type="monotone" dataKey="netValue" name="netPnl" stroke="var(--green)" strokeWidth={1.8} dot={{ r: 3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistBars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="2 5" horizontal={false} />
          <XAxis type="number" tick={tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={tick} axisLine={false} tickLine={false} width={96} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--accent-wash)", opacity: 0.45 }} />
          <Bar dataKey="value" fill="var(--blue)" radius={0} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
