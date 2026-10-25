"use client";

import { EquityChart, PnlBars } from "@/components/Charts";
import { Filters } from "@/components/Filters";
import { Banner, Card, Empty, Spinner, Stat } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { apiJson } from "@/lib/client-api";
import { formatDurationMinutes, formatMoney, formatPct, formatR, pnlClass, resultBadge } from "@/lib/format";
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
        action={
          <Link href="/trades/new" className="btn btn-primary">
            Add trade
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">Every number below is derived from your journal. Not a forecast.</p>
        </div>
        <Link href="/trades/new" className="btn btn-primary">
          Add trade
        </Link>
      </div>
      <Card>
        <Filters
          value={ws.filters}
          onChange={ws.setFilters}
          accounts={ws.accounts}
          instruments={ws.instruments}
          strategies={ws.strategies}
        />
      </Card>
      {s.sampleWarning ? (
        <Banner tone="warn">Sample size {s.totalTrades} is small. Treat patterns as hypotheses until you have 20+ trades.</Banner>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Stat label="Net P&L" value={formatMoney(s.netPnl, ws.currency)} tone={Number(s.netPnl) >= 0 ? "up" : "down"} />
        <Stat label="Win rate" value={formatPct(s.winRate)} hint={`${s.winningTrades}W / ${s.losingTrades}L / ${s.breakEvenTrades} BE`} />
        <Stat label="Profit factor" value={s.profitFactor === null ? "n/a" : s.profitFactor.toFixed(2)} hint="Undefined when there are no losses" />
        <Stat label="Expectancy" value={s.expectancyR === null ? "—" : `${s.expectancyR.toFixed(2)}R`} hint={formatMoney(s.expectancyCurrency, ws.currency) + " / trade"} />
        <Stat label="Max drawdown" value={formatMoney(s.maxDrawdown, ws.currency)} tone="down" />
        <Stat label="Avg win" value={formatMoney(s.averageWin, ws.currency)} tone="up" />
        <Stat label="Avg loss" value={formatMoney(s.averageLoss, ws.currency)} tone="down" />
        <Stat label="Avg R" value={s.averageRr === null ? "—" : s.averageRr.toFixed(2)} />
        <Stat label="Rule following" value={s.ruleFollowingPct === null ? "—" : `${s.ruleFollowingPct}%`} />
        <Stat label="Losing streak" value={`${s.currentLosingStreak} / max ${s.maxLosingStreak}`} />
        <Stat label="Gross profit" value={formatMoney(s.grossProfit, ws.currency)} tone="up" />
        <Stat label="Gross loss" value={formatMoney(s.grossLoss, ws.currency)} tone="down" />
        <Stat label="Return on start" value={s.returnOnStarting === null ? "—" : `${s.returnOnStarting.toFixed(2)}%`} />
        <Stat label="Avg hold" value={formatDurationMinutes(s.averageHoldingMinutes)} />
        <Stat label="Trades" value={s.totalTrades} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Equity curve</h2>
          <EquityChart data={data.analytics.equity} currency={ws.currency} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Daily net P&L</h2>
          <PnlBars data={data.analytics.daily} currency={ws.currency} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Breakdown title="By instrument" rows={data.analytics.byInstrument} currency={ws.currency} />
        <Breakdown title="By strategy" rows={data.analytics.byStrategy} currency={ws.currency} />
        <Breakdown title="By session" rows={data.analytics.bySession} currency={ws.currency} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Recent trades</h2>
          <TradeMini rows={recent} currency={ws.currency} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Journal notes</h2>
          {notes.length === 0 ? <p className="text-sm text-[var(--muted)]">No daily notes yet.</p> : null}
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="border-b border-[var(--border)] pb-3 text-sm">
                <p className="font-medium">{n.journalDate} · {n.grade || "ungraded"}</p>
                <p className="text-[var(--muted)]">{n.notes}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Best trades</h2>
          <TradeMini rows={data.analytics.best} currency={ws.currency} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Worst trades</h2>
          <TradeMini rows={data.analytics.worst} currency={ws.currency} />
        </Card>
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Most common tagged mistakes</h2>
        <ul className="grid gap-2 md:grid-cols-3">
          {data.analytics.mistakes.length === 0 ? <p className="text-sm text-[var(--muted)]">No mistake tags in this sample.</p> : null}
          {data.analytics.mistakes.map((m: { label: string; count: number; netPnl: number }) => (
            <li key={m.label} className="card-quiet p-3 text-sm">
              <p>{m.label}</p>
              <p className={pnlClass(m.netPnl)}>
                n={m.count} · {formatMoney(m.netPnl, ws.currency)}
              </p>
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
      <h2 className="mb-3 font-semibold">{title}</h2>
      <ul className="space-y-2 text-sm">
        {rows.slice(0, 6).map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-2">
            <span>
              {r.label} <span className="text-[var(--muted)]">n={r.stats.totalTrades}{r.sampleWarning ? " · small n" : ""}</span>
            </span>
            <span className={pnlClass(r.stats.netPnl)}>{formatMoney(r.stats.netPnl, currency)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TradeMini({ rows, currency }: { rows: any[]; currency: string }) {
  if (!rows?.length) return <p className="text-sm text-[var(--muted)]">None.</p>;
  return (
    <ul className="space-y-2">
      {rows.slice(0, 6).map((t) => {
        const badge = resultBadge(t.result);
        return (
          <li key={t.id}>
            <Link href={`/trades/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-[var(--bg-card-2)]">
              <div>
                <p className="text-sm font-medium">
                  {t.instrument} · {t.direction}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {t.displayId} · {formatR(t.rMultiple)}
                </p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-2 py-0.5 text-xs ${badge.className}`}>{badge.label}</span>
                <p className={`font-mono-num text-sm ${pnlClass(t.netPnl)}`}>{formatMoney(t.netPnl, currency)}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
