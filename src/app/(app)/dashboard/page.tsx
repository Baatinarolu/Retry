"use client";

import { EquityChart, PnlBars } from "@/components/Charts";
import { Filters } from "@/components/Filters";
import { Banner, Card, Empty, Spinner, Stat } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { apiJson } from "@/lib/client-api";
import { formatDurationMinutes, formatMoney, formatPct, formatR, pnlClass, resultBadge } from "@/lib/format";
import { ArrowUpRight, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const ws = useWorkspace();
  const { loading: workspaceLoading, loadAnalytics, loadTrades } = ws;
  const [data, setData] = useState<{ analytics?: any; sampleSize?: number } | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (workspaceLoading) return;
    const controller = new AbortController();
    Promise.all([
      loadAnalytics(controller.signal),
      loadTrades(1, "", controller.signal),
      apiJson<{ entries?: any[] }>("/api/journal", { signal: controller.signal }),
    ])
      .then(([analytics, trades, journal]) => {
        setData(analytics);
        setRecent(trades.trades || []);
        setNotes((journal.entries || []).slice(0, 4));
        setError("");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load dashboard");
        }
      });
    return () => controller.abort();
  }, [workspaceLoading, loadAnalytics, loadTrades]);

  if (workspaceLoading || !data) {
    return ws.error || error ? <Banner tone="warn">{ws.error || error}</Banner> : <Spinner label="Calculating live statistics" />;
  }
  const s = data.analytics?.stats;
  if (!s || s.totalTrades === 0) {
    return (
      <Empty
        title="No trades in this filter"
        body="Statistics are computed from stored records only. Add a trade or open the labeled demo journal."
        action={<Link href="/trades/new" className="btn btn-primary">Add trade</Link>}
      />
    );
  }

  return (
    <div className="space-y-7">
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Overview / Your trading record</p>
          <h1>Dashboard</h1>
          <p className="page-description">Every number is derived from your journal. A review of what happened—not a forecast.</p>
        </div>
        <Link href="/trades/new" className="btn btn-primary"><Plus className="h-4 w-4" /> Add trade</Link>
      </div>

      <section className="filter-panel" aria-label="Dashboard filters">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
          <p className="eyebrow">Define the sample</p>
          <span className="font-mono text-[10px] text-[var(--muted)]">n = {s.totalTrades}</span>
        </div>
        <Filters value={ws.filters} onChange={ws.setFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
      </section>

      {s.sampleWarning ? <Banner tone="warn">Sample size {s.totalTrades} is small. Treat patterns as hypotheses until you have 20+ trades.</Banner> : null}

      <section aria-label="Headline performance">
        <div className="section-label"><span>Headline performance</span><span>Selected sample</span></div>
        <div className="stats-grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          <Stat label="Net P&L" value={formatMoney(s.netPnl, ws.currency)} tone={Number(s.netPnl) >= 0 ? "up" : "down"} />
          <Stat label="Win rate" value={formatPct(s.winRate)} hint={`${s.winningTrades}W / ${s.losingTrades}L / ${s.breakEvenTrades} BE`} />
          <Stat label="Expectancy" value={s.expectancyR === null ? "—" : `${s.expectancyR.toFixed(2)}R`} hint={formatMoney(s.expectancyCurrency, ws.currency) + " / trade"} />
          <Stat label="Profit factor" value={s.profitFactor === null ? "n/a" : s.profitFactor.toFixed(2)} hint="Undefined without losses" />
          <Stat label="Max drawdown" value={formatMoney(s.maxDrawdown, ws.currency)} tone="down" />
        </div>
      </section>

      <section aria-label="Detailed performance ledger">
        <div className="section-label"><span>Performance ledger</span><span>Secondary measures</span></div>
        <div className="stats-grid grid-cols-2 md:grid-cols-5">
          <Stat label="Average win" value={formatMoney(s.averageWin, ws.currency)} tone="up" />
          <Stat label="Average loss" value={formatMoney(s.averageLoss, ws.currency)} tone="down" />
          <Stat label="Average R" value={s.averageRr === null ? "—" : s.averageRr.toFixed(2)} />
          <Stat label="Rule following" value={s.ruleFollowingPct === null ? "—" : `${s.ruleFollowingPct}%`} />
          <Stat label="Losing streak" value={`${s.currentLosingStreak} / ${s.maxLosingStreak}`} hint="Current / maximum" />
          <Stat label="Gross profit" value={formatMoney(s.grossProfit, ws.currency)} tone="up" />
          <Stat label="Gross loss" value={formatMoney(s.grossLoss, ws.currency)} tone="down" />
          <Stat label="Return on start" value={s.returnOnStarting === null ? "—" : `${s.returnOnStarting.toFixed(2)}%`} />
          <Stat label="Average hold" value={formatDurationMinutes(s.averageHoldingMinutes)} />
          <Stat label="Recorded trades" value={s.totalTrades} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-0">
          <div className="chart-card">
            <div className="card-heading"><div><p className="eyebrow mb-2">Cumulative record</p><h2>Equity curve</h2></div><span>01</span></div>
            <EquityChart data={data.analytics.equity} currency={ws.currency} />
          </div>
        </Card>
        <Card className="p-0">
          <div className="chart-card">
            <div className="card-heading"><div><p className="eyebrow mb-2">Session outcomes</p><h2>Daily net P&amp;L</h2></div><span>02</span></div>
            <PnlBars data={data.analytics.daily} currency={ws.currency} />
          </div>
        </Card>
      </div>

      <section>
        <div className="section-label"><span>Comparative review</span><span>Net result by group</span></div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Breakdown title="By instrument" rows={data.analytics.byInstrument} currency={ws.currency} />
          <Breakdown title="By strategy" rows={data.analytics.byStrategy} currency={ws.currency} />
          <Breakdown title="By session" rows={data.analytics.bySession} currency={ws.currency} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="card-heading"><h2>Recent trades</h2><Link href="/trades" className="flex items-center gap-1 text-[var(--accent)] hover:underline">View journal <ArrowUpRight className="h-3.5 w-3.5" /></Link></div>
          <TradeMini rows={recent} currency={ws.currency} />
        </Card>
        <Card>
          <div className="card-heading"><h2>Latest journal notes</h2><span>Daily review</span></div>
          {notes.length === 0 ? <p className="text-sm text-[var(--muted)]">No daily notes yet.</p> : null}
          <ul className="divide-y divide-[var(--line)]">
            {notes.map((n) => (
              <li key={n.id} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em]">{n.journalDate}</p>
                  <span className="badge">{n.grade || "Ungraded"}</span>
                </div>
                <p className="text-sm leading-6 text-[var(--muted)]">{n.notes}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card><div className="card-heading"><h2>Best trades</h2><span>By net result</span></div><TradeMini rows={data.analytics.best} currency={ws.currency} /></Card>
        <Card><div className="card-heading"><h2>Worst trades</h2><span>By net result</span></div><TradeMini rows={data.analytics.worst} currency={ws.currency} /></Card>
      </div>

      <Card>
        <div className="card-heading"><h2>Recurring tagged mistakes</h2><span>Observed, not causal</span></div>
        <ul className="grid gap-x-8 gap-y-5 md:grid-cols-3">
          {data.analytics.mistakes.length === 0 ? <p className="text-sm text-[var(--muted)]">No mistake tags in this sample.</p> : null}
          {data.analytics.mistakes.map((m: { label: string; count: number; netPnl: number }) => (
            <li key={m.label} className="border-l border-[var(--line-strong)] pl-4">
              <p className="font-serif text-lg">{m.label}</p>
              <p className={`mt-1 font-mono text-xs ${pnlClass(m.netPnl)}`}>n={m.count} · {formatMoney(m.netPnl, ws.currency)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Breakdown({ title, rows, currency }: { title: string; rows: any[]; currency: string }) {
  return (
    <Card>
      <div className="card-heading"><h2>{title}</h2><span>Top 6</span></div>
      {rows.length === 0 ? <p className="text-sm text-[var(--muted)]">No records in this group.</p> : null}
      <ul className="divide-y divide-[var(--line)]">
        {rows.slice(0, 6).map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.label}</p>
              <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">n={r.stats.totalTrades}{r.sampleWarning ? " · small sample" : ""}</p>
            </div>
            <span className={`shrink-0 font-mono text-xs ${pnlClass(r.stats.netPnl)}`}>{formatMoney(r.stats.netPnl, currency)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TradeMini({ rows, currency }: { rows: any[]; currency: string }) {
  if (!rows?.length) return <p className="text-sm text-[var(--muted)]">No trades in this sample.</p>;
  return (
    <ul className="divide-y divide-[var(--line)]">
      {rows.slice(0, 6).map((t) => {
        const badge = resultBadge(t.result);
        return (
          <li key={t.id}>
            <Link href={`/trades/${t.id}`} className="-mx-2 flex items-center justify-between gap-3 px-2 py-3 transition-colors hover:bg-[var(--accent-wash)]">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{t.instrument} <span className="font-normal text-[var(--muted)]">/ {t.direction}</span></p>
                <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">{t.displayId} · {formatR(t.rMultiple)}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className={`badge ${badge.className}`}>{badge.label}</span>
                <p className={`mt-1.5 font-mono text-xs ${pnlClass(t.netPnl)}`}>{formatMoney(t.netPnl, currency)}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
