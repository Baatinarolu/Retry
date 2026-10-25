"use client";

import { Banner, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatR } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

function localNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function BacktestingPage() {
  const [list, setList] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    instrument: "EURUSD",
    timeframe: "15m",
    startDate: "2025-01-01",
    endDate: "2025-03-31",
    session: "london",
    entryRules: "",
    exitRules: "",
    riskModel: "0.5% simulated, 1R stop",
    notes: "",
  });
  const [row, setRow] = useState({
    instrument: "EURUSD",
    direction: "long",
    entryAt: localNow(),
    exitAt: localNow(),
    entryPrice: "",
    exitPrice: "",
    stopLoss: "",
    takeProfit: "",
    resultR: "1",
    resultCurrency: "0",
    informationAtDecision: "",
    notes: "",
    followedRules: true,
  });

  const reloadList = useCallback(async (signal?: AbortSignal) => {
    const data = await apiJson<{ backtests?: any[] }>("/api/backtests", { signal });
    setList(data.backtests || []);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ backtests?: any[] }>("/api/backtests", { signal: controller.signal })
      .then((data) => setList(data.backtests || []))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load backtests");
        }
      });
    return () => controller.abort();
  }, []);

  async function open(id: string) {
    const data = await apiJson<{ backtest: any; trades?: any[]; stats: any }>(`/api/backtests?id=${id}`);
    setActive(data.backtest);
    setTrades(data.trades || []);
    setStats(data.stats);
    setRow((current) => ({ ...current, instrument: data.backtest.instrument }));
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiJson<{ backtest: any }>("/api/backtests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      await reloadList();
      await open(data.backtest.id);
      setMessage("Backtest created.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create backtest");
    } finally {
      setSaving(false);
    }
  }

  async function addTrade(event: React.FormEvent) {
    event.preventDefault();
    if (!active) return;
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/backtests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          backtestId: active.id,
          ...row,
          entryAt: new Date(row.entryAt).toISOString(),
          exitAt: row.exitAt ? new Date(row.exitAt).toISOString() : null,
        }),
      });
      await open(active.id);
      setMessage("Simulated trade logged.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not log simulated trade");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrade(id: string) {
    if (!active || !confirm("Delete this simulated trade?")) return;
    try {
      await apiJson(`/api/backtests?tradeId=${id}`, { method: "DELETE" });
      await open(active.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete simulated trade");
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Manual backtesting journal</h1>
        <p className="text-sm text-[var(--muted)]">Simulated results are stored separately from live trades. Statistics are calculated in R.</p>
      </div>
      <Banner tone="warn">Record only information available at the decision. Look-ahead bias is a process error, not a feature.</Banner>
      {error ? <Banner tone="warn">{error}</Banner> : null}
      {message ? <Banner tone="good">{message}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.2fr]">
        <Card>
          <h2 className="mb-3 font-semibold">New backtest</h2>
          <form onSubmit={create} className="space-y-3">
            <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Instrument"><Input value={form.instrument} onChange={(event) => setForm({ ...form, instrument: event.target.value })} required /></Field>
              <Field label="Timeframe"><Input value={form.timeframe} onChange={(event) => setForm({ ...form, timeframe: event.target.value })} required /></Field>
              <Field label="Start"><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></Field>
              <Field label="End"><Input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} required /></Field>
            </div>
            <Field label="Entry rules"><Textarea value={form.entryRules} onChange={(event) => setForm({ ...form, entryRules: event.target.value })} /></Field>
            <Field label="Exit rules"><Textarea value={form.exitRules} onChange={(event) => setForm({ ...form, exitRules: event.target.value })} /></Field>
            <Field label="Risk model"><Input value={form.riskModel} onChange={(event) => setForm({ ...form, riskModel: event.target.value })} /></Field>
            <Button type="submit" loading={saving}>Create</Button>
          </form>
          <ul className="mt-5 space-y-2 text-sm">
            {list.map((backtest) => (
              <li key={backtest.id}>
                <button className="text-left text-teal-300" onClick={() => open(backtest.id).catch((cause) => setError(cause.message))}>
                  {backtest.name} · {backtest.instrument}
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          {!active ? <p className="text-sm text-[var(--muted)]">Select a backtest.</p> : null}
          {active ? (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-amber-300">Simulated</p>
                <h2 className="text-xl font-semibold">{active.name}</h2>
                <p className="text-sm text-[var(--muted)]">{active.instrument} {active.timeframe} · {active.startDate} → {active.endDate}</p>
              </div>
              {stats ? (
                <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                  <div className="card-quiet p-3">n={stats.totalTrades}</div>
                  <div className="card-quiet p-3">WR {(stats.winRate ? stats.winRate * 100 : 0).toFixed(1)}%</div>
                  <div className="card-quiet p-3">Exp {stats.expectancyR ?? "n/a"}R</div>
                  <div className="card-quiet p-3">PF (R) {stats.profitFactor ?? "n/a"}</div>
                </div>
              ) : null}
              <form onSubmit={addTrade} className="grid gap-2 md:grid-cols-2">
                <Field label="Instrument"><Input value={row.instrument} onChange={(event) => setRow({ ...row, instrument: event.target.value })} required /></Field>
                <Field label="Direction">
                  <Select value={row.direction} onChange={(event) => setRow({ ...row, direction: event.target.value })}>
                    <option value="long">Long</option><option value="short">Short</option>
                  </Select>
                </Field>
                <Field label="Entry"><Input type="datetime-local" value={row.entryAt} onChange={(event) => setRow({ ...row, entryAt: event.target.value })} required /></Field>
                <Field label="Exit"><Input type="datetime-local" value={row.exitAt} onChange={(event) => setRow({ ...row, exitAt: event.target.value })} /></Field>
                <Field label="Entry price"><Input inputMode="decimal" value={row.entryPrice} onChange={(event) => setRow({ ...row, entryPrice: event.target.value })} required /></Field>
                <Field label="Exit price"><Input inputMode="decimal" value={row.exitPrice} onChange={(event) => setRow({ ...row, exitPrice: event.target.value })} /></Field>
                <Field label="Stop loss"><Input inputMode="decimal" value={row.stopLoss} onChange={(event) => setRow({ ...row, stopLoss: event.target.value })} /></Field>
                <Field label="Take profit"><Input inputMode="decimal" value={row.takeProfit} onChange={(event) => setRow({ ...row, takeProfit: event.target.value })} /></Field>
                <Field label="Result R"><Input inputMode="decimal" value={row.resultR} onChange={(event) => setRow({ ...row, resultR: event.target.value })} required /></Field>
                <Field label="Result currency"><Input inputMode="decimal" value={row.resultCurrency} onChange={(event) => setRow({ ...row, resultCurrency: event.target.value })} /></Field>
                <div className="md:col-span-2"><Field label="What was known then"><Textarea value={row.informationAtDecision} onChange={(event) => setRow({ ...row, informationAtDecision: event.target.value })} /></Field></div>
                <div className="md:col-span-2"><Field label="Notes"><Textarea value={row.notes} onChange={(event) => setRow({ ...row, notes: event.target.value })} /></Field></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={row.followedRules} onChange={(event) => setRow({ ...row, followedRules: event.target.checked })} /> Followed rules</label>
                <Button type="submit" loading={saving}>Log simulated trade</Button>
              </form>
              <ul className="space-y-2 text-sm">
                {trades.map((trade) => (
                  <li key={trade.id} className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2">
                    <span>{trade.direction} · {trade.informationAtDecision || trade.notes || "No decision notes"}</span>
                    <span className="flex items-center gap-3">{formatR(trade.resultR)}<button className="text-rose-300" onClick={() => deleteTrade(trade.id)}>Delete</button></span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
