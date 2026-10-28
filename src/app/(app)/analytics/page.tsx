"use client";

import { DistBars, EquityChart } from "@/components/Charts";
import { Filters } from "@/components/Filters";
import { FxConversionNotice } from "@/components/FxConversionNotice";
import { ReportingErrorBanner } from "@/components/ReportingErrorBanner";
import { Banner, Card, Spinner, Stat } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { formatMoney, formatPct, pnlClass } from "@/lib/format";
import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const ws = useWorkspace();
  const { loading: workspaceLoading, loadAnalytics } = ws;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (workspaceLoading) return;
    const controller = new AbortController();
    loadAnalytics(controller.signal)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load analytics");
        }
      });
    return () => controller.abort();
  }, [workspaceLoading, loadAnalytics]);

  if (workspaceLoading || !data) {
    const loadError = ws.error || error;
    if (loadError) {
      return (
        <div className="space-y-7">
          <ReportingErrorBanner message={loadError} />
          <section className="filter-panel" aria-label="Analytics filters">
            <Filters value={ws.filters} onChange={ws.setFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
          </section>
        </div>
      );
    }
    return <Spinner label="Running analytics engine" />;
  }
  const a = data.analytics;
  const s = a.stats;

  return (
    <div className="space-y-7">
      {error ? <ReportingErrorBanner message={error} /> : null}
      <FxConversionNotice conversion={data.conversion} />
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Evidence / Performance analysis</p>
          <h1>Analytics</h1>
          <p className="page-description">Expectancy R is the mean across trades with a valid R basis; coverage is shown below. Profit factor uses actual positive and negative net P&amp;L and is undefined when there is no negative P&amp;L.</p>
        </div>
      </div>
      <section className="filter-panel" aria-label="Analytics filters">
        <Filters value={ws.filters} onChange={ws.setFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
      </section>
      {s.sampleWarning ? <Banner tone="warn">n={s.totalTrades}. Small samples overfit stories.</Banner> : null}
      <div className="stats-grid grid-cols-2 md:grid-cols-4">
        <Stat label="Expectancy R" value={s.expectancyR ?? "n/a"} hint={`${s.rSampleSize} of ${s.totalTrades} trades have R · ${s.rMissing} missing`} />
        <Stat label="Avg win R" value={s.averageWinR ?? "—"} />
        <Stat label="Avg loss R" value={s.averageLossR ?? "—"} />
        <Stat label="Recovery factor" value={s.recoveryFactor ?? "n/a"} hint="Net / max DD" />
      </div>
      <Card>
        <div className="card-heading"><div><p className="eyebrow mb-2">Sensitivity check</p><h2>Outlier dependence</h2></div><span>Leave one out</span></div>
        <div className="stats-grid mt-5 grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Best / gross profit"
            value={a.outliers.best?.share == null ? "—" : formatPct(a.outliers.best.share)}
            hint={a.outliers.best ? `${a.outliers.best.instrument} · ${a.outliers.best.displayId}` : "No closed trades"}
          />
          <Stat
            label="Net without best"
            value={a.outliers.withoutBest ? formatMoney(a.outliers.withoutBest.netPnl, ws.currency) : "—"}
            hint={a.outliers.withoutBest ? `n=${a.outliers.withoutBest.totalTrades} · Exp ${a.outliers.withoutBest.expectancyR ?? "—"}R` : "No comparison"}
          />
          <Stat
            label="Worst / gross loss"
            value={a.outliers.worst?.share == null ? "—" : formatPct(a.outliers.worst.share)}
            hint={a.outliers.worst ? `${a.outliers.worst.instrument} · ${a.outliers.worst.displayId}` : "No closed trades"}
          />
          <Stat
            label="Net without worst"
            value={a.outliers.withoutWorst ? formatMoney(a.outliers.withoutWorst.netPnl, ws.currency) : "—"}
            hint={a.outliers.withoutWorst ? `n=${a.outliers.withoutWorst.totalTrades} · Exp ${a.outliers.withoutWorst.expectancyR ?? "—"}R` : "No comparison"}
          />
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Removing one record is a sensitivity check, not proof that the record caused the outcome. Shares use gross profit/loss; net P&amp;L and expectancy are recalculated from the remaining sample.</p>
      </Card>
      <Card>
        <h2 className="mb-1 font-semibold">Closed-trade performance curve</h2>
        <p className="mb-3 text-xs leading-5 text-[var(--muted)]">Cumulative closed-trade P&amp;L from the selected starting-balance basis; not a cash-flow-aware account valuation.</p>
        <EquityChart data={a.equity} currency={ws.currency} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Weekday</h2>
          <DistBars data={a.byWeekday.map((r: any) => ({ label: r.label.slice(0, 3), value: Number(r.stats.netPnl) }))} />
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Direction</h2>
          <Table rows={a.byDirection} currency={ws.currency} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-2 font-semibold">Instrument</h2><Table rows={a.byInstrument} currency={ws.currency} /></Card>
        <Card><h2 className="mb-2 font-semibold">Session</h2><Table rows={a.bySession} currency={ws.currency} /></Card>
        <Card><h2 className="mb-2 font-semibold">Timeframe</h2><Table rows={a.byTimeframe} currency={ws.currency} /></Card>
        <Card><h2 className="mb-2 font-semibold">Plan adherence</h2><Table rows={a.byPlan} currency={ws.currency} /></Card>
        <Card><h2 className="mb-2 font-semibold">Emotion before entry</h2><Table rows={a.byEmotion} currency={ws.currency} /></Card>
        <Card><h2 className="mb-2 font-semibold">News tag</h2><Table rows={a.byNews} currency={ws.currency} /></Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Insights (correlations, not proof)</h2>
        <ul className="space-y-3">
          {a.insights.map((i: any) => (
            <li key={i.title} className="card-quiet p-3">
              <p className="font-medium">{i.title}</p>
              <p className="text-sm text-[var(--muted)]">{i.body}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Table({ rows, currency }: { rows: any[]; currency: string }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Bucket</th>
            <th>n</th>
            <th>Win%</th>
            <th>Exp R</th>
            <th>Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.label}{r.sampleWarning ? " *" : ""}</td>
              <td>{r.stats.totalTrades}</td>
              <td>{formatPct(r.stats.winRate)}</td>
              <td>{r.stats.expectancyR ?? "—"}</td>
              <td className={pnlClass(r.stats.netPnl)}>{formatMoney(r.stats.netPnl, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
