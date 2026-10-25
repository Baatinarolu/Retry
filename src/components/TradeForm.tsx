"use client";

import {
  DIRECTIONS,
  EMOTIONS,
  MARKET_CATEGORIES,
  SCREENSHOT_CATEGORIES,
  SESSIONS,
  TIMEFRAMES,
  TRADE_TYPES,
} from "@/lib/constants";
import { computeTradeMetrics } from "@/lib/calculations";
import { formatMoney, formatR } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Banner, Button, Field, Input, Select, Textarea } from "./ui";

type Account = { id: string; name: string; currency: string; currentBalance: string };
type Strategy = { id: string; name: string };
type Tag = { id: string; name: string; color: string };
type Instrument = {
  symbol: string;
  category: string;
  contractSize: string;
  tickSize: string;
  tickValue: string;
  pipSize: string;
  pipValue: string;
};

export type TradeFormValues = Record<string, unknown>;

const DRAFT_KEY = "tm-trade-draft";
const DRAFT_EVENT = "tm-draft-change";

function toLocalInput(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function localNow() {
  return toLocalInput(new Date());
}

const empty = {
  accountId: "",
  strategyId: "",
  instrument: "EURUSD",
  marketCategory: "forex",
  direction: "long",
  tradeType: "intraday",
  session: "london",
  timezone: "Africa/Lagos",
  entryAt: localNow(),
  exitAt: localNow(),
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  takeProfit: "",
  positionSize: "0.5",
  lotSize: "0.5",
  contractSize: "1",
  tickSize: "0",
  tickValue: "0",
  pipSize: "0.0001",
  pipValue: "10",
  commission: "0",
  swap: "0",
  slippage: "0",
  overrideNetPnl: "",
  pnlOverridden: false,
  status: "closed",
  marketBias: "",
  htfDirection: "",
  entryTimeframe: "15m",
  htfTimeframe: "4h",
  marketStructure: "",
  entryModel: "",
  confluence: "",
  entryReason: "",
  slJustification: "",
  tpJustification: "",
  invalidation: "",
  plannedExit: "",
  followedPlan: true,
  newsRelated: false,
  notes: "",
  emotionBefore: "Calm",
  emotionDuring: "Focused",
  emotionAfter: "Neutral",
  confidence: 6,
  patience: 6,
  fomo: false,
  fear: false,
  greed: false,
  revenge: false,
  overtrading: false,
  hesitation: false,
  impulsive: false,
  earlyExit: false,
  movedStop: false,
  brokeRiskRules: false,
  lessons: "",
  didWell: "",
  improve: "",
  reflection: "",
};

export function TradeForm({ tradeId, onSaved }: { tradeId?: string; onSaved?: (trade: Record<string, unknown>) => void }) {
  const router = useRouter();
  const draftKey = tradeId ? `${DRAFT_KEY}:${tradeId}` : DRAFT_KEY;
  const [form, setForm] = useState(empty);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [executions, setExecutions] = useState<
    { type: "entry" | "scale_in" | "scale_out" | "exit"; price: string; quantity: string; executedAt: string; fees: string; notes: string }[]
  >([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [offlineDraft, setOfflineDraft] = useState(false);
  const [shots, setShots] = useState<{ id: string; category: string; caption: string }[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const currency = accounts.find((a) => a.id === form.accountId)?.currency || "USD";

  const restoreDraft = useCallback(() => {
    const draft = localStorage.getItem(draftKey);
    if (!draft) return;
    try {
      const parsed = JSON.parse(draft);
      setForm((current) => ({ ...current, ...parsed.form }));
      setTagIds(Array.isArray(parsed.tagIds) ? parsed.tagIds : []);
      setExecutions(Array.isArray(parsed.executions) ? parsed.executions : []);
      setOfflineDraft(true);
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    Promise.all([
      fetch("/api/bootstrap").then((r) => r.json()),
      fetch("/api/strategies").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([boot, strat, tag]) => {
      setAccounts(boot.accounts || []);
      setInstruments(boot.instruments || []);
      setStrategies(strat.strategies || []);
      setTags(tag.tags || []);
      setForm((f) => ({ ...f, accountId: f.accountId || boot.accounts?.[0]?.id || "" }));
    }).catch(() => setError("Could not load accounts and strategy data."));
    if (tradeId) {
      fetch(`/api/trades/${tradeId}`)
        .then((r) => r.json())
        .then((d) => {
          const t = d.trade;
          if (!t) return;
          setForm((f) => ({
            ...f,
            accountId: t.accountId,
            strategyId: t.strategyId || "",
            instrument: t.instrument,
            marketCategory: t.marketCategory,
            direction: t.direction,
            tradeType: t.tradeType,
            session: t.session,
            timezone: t.timezone,
            entryAt: t.entryAt ? toLocalInput(t.entryAt) : f.entryAt,
            exitAt: t.exitAt ? toLocalInput(t.exitAt) : "",
            entryPrice: t.entryPrice || "",
            exitPrice: t.exitPrice || "",
            stopLoss: t.stopLoss || "",
            takeProfit: t.takeProfit || "",
            positionSize: t.positionSize,
            lotSize: t.lotSize,
            contractSize: t.contractSize,
            tickSize: t.tickSize,
            tickValue: t.tickValue,
            pipSize: t.pipSize,
            pipValue: t.pipValue,
            commission: t.commission,
            swap: t.swap,
            slippage: t.slippage,
            status: t.status,
            marketBias: t.marketBias,
            htfDirection: t.htfDirection,
            entryTimeframe: t.entryTimeframe,
            htfTimeframe: t.htfTimeframe,
            marketStructure: t.marketStructure,
            entryModel: t.entryModel,
            confluence: t.confluence,
            entryReason: t.entryReason,
            slJustification: t.slJustification,
            tpJustification: t.tpJustification,
            invalidation: t.invalidation,
            plannedExit: t.plannedExit,
            followedPlan: t.followedPlan,
            newsRelated: t.newsRelated,
            notes: t.notes,
            pnlOverridden: t.pnlOverridden,
            overrideNetPnl: t.pnlOverridden ? t.netPnl : "",
            emotionBefore: t.psychology?.emotionBefore || "Calm",
            emotionDuring: t.psychology?.emotionDuring || "Focused",
            emotionAfter: t.psychology?.emotionAfter || "Neutral",
            confidence: t.psychology?.confidence ?? 6,
            patience: t.psychology?.patience ?? 6,
            fomo: t.psychology?.fomo,
            fear: t.psychology?.fear,
            greed: t.psychology?.greed,
            revenge: t.psychology?.revenge,
            overtrading: t.psychology?.overtrading,
            hesitation: t.psychology?.hesitation,
            impulsive: t.psychology?.impulsive,
            earlyExit: t.psychology?.earlyExit,
            movedStop: t.psychology?.movedStop,
            brokeRiskRules: t.psychology?.brokeRiskRules,
            lessons: t.psychology?.lessons || "",
            didWell: t.psychology?.didWell || "",
            improve: t.psychology?.improve || "",
            reflection: t.psychology?.reflection || "",
          }));
          setTagIds((t.tags || []).map((x: Tag) => x.id));
          setExecutions(
            (t.executions || []).map((e: { type: "entry" | "scale_in" | "scale_out" | "exit"; price: string; quantity: string; executedAt: string; fees: string; notes: string }) => ({
              type: e.type,
              price: e.price,
              quantity: e.quantity,
              executedAt: toLocalInput(e.executedAt),
              fees: e.fees,
              notes: e.notes,
            })),
          );
          setShots(t.screenshots || []);
          // A failed edit may have a newer local draft; restore it after the server version.
          restoreDraft();
        })
        .catch(() => setError("Could not load this trade."));
    }
  }, [tradeId, restoreDraft]);

  useEffect(() => {
    if (tradeId) return;
    // Read browser storage after hydration; this also keeps the server-rendered form deterministic.
    const timer = window.setTimeout(restoreDraft, 0);
    return () => window.clearTimeout(timer);
  }, [tradeId, restoreDraft]);

  function set<K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function changeInstrument(value: string) {
    const symbol = value.toUpperCase();
    const instrument = instruments.find((item) => item.symbol === symbol);
    setForm((current) => ({
      ...current,
      instrument: symbol,
      ...(instrument
        ? {
            marketCategory: instrument.category || current.marketCategory,
            contractSize: instrument.contractSize,
            tickSize: instrument.tickSize,
            tickValue: instrument.tickValue,
            pipSize: instrument.pipSize,
            pipValue: instrument.pipValue,
          }
        : {}),
    }));
  }

  const metrics = useMemo(
    () =>
      computeTradeMetrics({
        direction: form.direction as "long" | "short",
        entryPrice: form.entryPrice || "0",
        exitPrice: form.status === "open" ? null : form.exitPrice,
        stopLoss: form.stopLoss,
        takeProfit: form.takeProfit,
        positionSize: form.positionSize,
        lotSize: form.lotSize,
        contractSize: form.contractSize,
        tickSize: form.tickSize,
        tickValue: form.tickValue,
        pipSize: form.pipSize,
        pipValue: form.pipValue,
        commission: form.commission,
        swap: form.swap,
        slippage: form.slippage,
        overrideNetPnl: form.pnlOverridden ? form.overrideNetPnl : null,
        entryAt: new Date(form.entryAt),
        exitAt: form.exitAt ? new Date(form.exitAt) : null,
      }),
    [form],
  );

  useEffect(() => {
    if (!form.accountId || !metrics.initialRisk) return;
    const t = setTimeout(() => {
      fetch("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: form.accountId,
          plannedRisk: Number(metrics.initialRisk),
          plannedRr: Number(metrics.plannedRr || 0),
          positionSize: Number(form.positionSize || form.lotSize || 0),
        }),
      })
        .then((r) => r.json())
        .then((d) => setWarnings(d.warnings || []))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [form.accountId, form.positionSize, form.lotSize, metrics.initialRisk, metrics.plannedRr]);

  function persistDraft() {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ form, tagIds, executions, savedAt: Date.now(), synced: false }));
      setOfflineDraft(true);
      if (draftKey === DRAFT_KEY) window.dispatchEvent(new Event(DRAFT_EVENT));
    } catch {
      setError("This browser could not store a local draft. Export or copy your notes before leaving.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!navigator.onLine) {
      persistDraft();
      setError("You are offline. Draft saved locally and is not synchronized until the server confirms.");
      return;
    }
    setSaving(true);
    try {
      if (form.status === "closed" && (!form.exitAt || !form.exitPrice)) {
        throw new Error("Closed trades need an exit time and exit price.");
      }
      const payload = {
        ...form,
        strategyId: form.strategyId || null,
        tagIds,
        executions: executions.map((execution) => ({
          ...execution,
          executedAt: new Date(execution.executedAt).toISOString(),
        })),
        psychology: {
          emotionBefore: form.emotionBefore,
          emotionDuring: form.emotionDuring,
          emotionAfter: form.emotionAfter,
          confidence: Number(form.confidence),
          patience: Number(form.patience),
          fomo: form.fomo,
          fear: form.fear,
          greed: form.greed,
          revenge: form.revenge,
          overtrading: form.overtrading,
          hesitation: form.hesitation,
          impulsive: form.impulsive,
          earlyExit: form.earlyExit,
          movedStop: form.movedStop,
          brokeRiskRules: form.brokeRiskRules,
          followedPlan: form.followedPlan,
          lessons: form.lessons,
          didWell: form.didWell,
          improve: form.improve,
          reflection: form.reflection,
        },
        entryAt: new Date(form.entryAt).toISOString(),
        exitAt: form.exitAt ? new Date(form.exitAt).toISOString() : null,
      };
      const response = await fetch(tradeId ? `/api/trades/${tradeId}` : "/api/trades", {
        method: tradeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.trade?.id) throw new Error(data.error || "Could not save trade");
      localStorage.removeItem(draftKey);
      if (draftKey === DRAFT_KEY) window.dispatchEvent(new Event(DRAFT_EVENT));
      setOfflineDraft(false);
      onSaved?.(data.trade);
      router.push(`/trades/${data.trade.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save trade");
      persistDraft();
    } finally {
      setSaving(false);
    }
  }

  async function uploadShot(file: File, category: string, caption: string) {
    if (!tradeId) {
      setError("Save the trade first, then attach screenshots. Images are only stored after the server confirms.");
      return;
    }
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("category", category);
      data.set("caption", caption);
      const response = await fetch(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Upload failed");
      setShots((current) => [...current, result.screenshot]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    }
  }

  const flags: { key: keyof typeof empty; label: string }[] = [
    { key: "fomo", label: "FOMO" },
    { key: "fear", label: "Fear" },
    { key: "greed", label: "Greed" },
    { key: "revenge", label: "Revenge" },
    { key: "overtrading", label: "Overtrading" },
    { key: "hesitation", label: "Hesitation" },
    { key: "impulsive", label: "Impulsive entry" },
    { key: "earlyExit", label: "Early exit" },
    { key: "movedStop", label: "Moved stop improperly" },
    { key: "brokeRiskRules", label: "Broke risk rules" },
    { key: "followedPlan", label: "Followed plan" },
    { key: "newsRelated", label: "News-related" },
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {offlineDraft ? <Banner tone="warn">Local draft present — not synchronized until the server confirms the save.</Banner> : null}
      {warnings.map((w) => (
        <Banner key={w} tone="warn">
          {w}
        </Banner>
      ))}
      {error ? <Banner tone="warn">{error}</Banner> : null}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
        <section className="card space-y-4 p-5">
          <div className="card-heading"><h2>Execution</h2><span>01 / Trade record</span></div>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Account">
              <Select value={form.accountId} onChange={(e) => set("accountId", e.target.value)} required>
                <option value="">Select account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Instrument">
              <Input list="instruments" value={form.instrument} onChange={(e) => changeInstrument(e.target.value)} required />
              <datalist id="instruments">
                {instruments.map((i) => (
                  <option key={i.symbol} value={i.symbol} />
                ))}
              </datalist>
            </Field>
            <Field label="Market">
              <Select value={form.marketCategory} onChange={(e) => set("marketCategory", e.target.value)}>
                {MARKET_CATEGORIES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Direction">
              <Select value={form.direction} onChange={(e) => set("direction", e.target.value)}>
                {DIRECTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Type">
              <Select value={form.tradeType} onChange={(e) => set("tradeType", e.target.value)}>
                {TRADE_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Session">
              <Select value={form.session} onChange={(e) => set("session", e.target.value)}>
                {SESSIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entry">
              <Input type="datetime-local" value={form.entryAt} onChange={(e) => set("entryAt", e.target.value)} required />
            </Field>
            <Field label="Exit">
              <Input
                type="datetime-local"
                value={form.exitAt}
                onChange={(e) => set("exitAt", e.target.value)}
                disabled={form.status === "open"}
                required={form.status === "closed"}
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                <option value="closed">Closed</option>
                <option value="open">Open</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Entry price">
              <Input value={form.entryPrice} onChange={(e) => set("entryPrice", e.target.value)} required />
            </Field>
            <Field label="Exit price">
              <Input
                inputMode="decimal"
                value={form.exitPrice}
                onChange={(e) => set("exitPrice", e.target.value)}
                required={form.status === "closed"}
              />
            </Field>
            <Field label="Stop loss">
              <Input value={form.stopLoss} onChange={(e) => set("stopLoss", e.target.value)} />
            </Field>
            <Field label="Take profit">
              <Input value={form.takeProfit} onChange={(e) => set("takeProfit", e.target.value)} />
            </Field>
            <Field label="Lot / contracts">
              <Input value={form.lotSize} onChange={(e) => { set("lotSize", e.target.value); set("positionSize", e.target.value); }} />
            </Field>
            <Field label="Commission">
              <Input value={form.commission} onChange={(e) => set("commission", e.target.value)} />
            </Field>
            <Field label="Swap / funding">
              <Input value={form.swap} onChange={(e) => set("swap", e.target.value)} />
            </Field>
            <Field label="Slippage cost">
              <Input value={form.slippage} onChange={(e) => set("slippage", e.target.value)} />
            </Field>
          </div>
          <details className="editorial-details">
            <summary className="cursor-pointer text-sm text-[var(--muted)]">Contract specification (do not assume one size fits all)</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <Field label="Contract size"><Input value={form.contractSize} onChange={(e) => set("contractSize", e.target.value)} /></Field>
              <Field label="Tick size"><Input value={form.tickSize} onChange={(e) => set("tickSize", e.target.value)} /></Field>
              <Field label="Tick value"><Input value={form.tickValue} onChange={(e) => set("tickValue", e.target.value)} /></Field>
              <Field label="Pip size"><Input value={form.pipSize} onChange={(e) => set("pipSize", e.target.value)} /></Field>
              <Field label="Pip value"><Input value={form.pipValue} onChange={(e) => set("pipValue", e.target.value)} /></Field>
            </div>
          </details>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.pnlOverridden} onChange={(e) => set("pnlOverridden", e.target.checked)} />
            Override net P&amp;L
          </label>
          {form.pnlOverridden ? (
            <Field label="Manual net P&L">
              <Input value={form.overrideNetPnl} onChange={(e) => set("overrideNetPnl", e.target.value)} />
            </Field>
          ) : null}
        </section>

        <aside className="card h-fit space-y-3 p-5">
          <div className="card-heading"><h2>Calculator</h2><span>Live preview</span></div>
          <p className="text-xs text-[var(--muted)]">Uses your contract spec. Override if the broker fill differs.</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">Gross</p><p className="font-mono-num">{formatMoney(metrics.grossPnl, currency)}</p></div>
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">Net</p><p className="font-mono-num">{formatMoney(metrics.netPnl, currency)}</p></div>
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">Initial risk</p><p className="font-mono-num">{formatMoney(metrics.initialRisk, currency)}</p></div>
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">Planned R:R</p><p className="font-mono-num">{metrics.plannedRr ?? "—"}</p></div>
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">Realized R</p><p className="font-mono-num">{formatR(metrics.rMultiple)}</p></div>
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">Result</p><p className="font-mono-num uppercase">{metrics.result}</p></div>
          </div>
        </aside>
      </div>

      <section className="card space-y-4 p-5">
        <div className="card-heading"><h2>Strategy &amp; setup</h2><span>02 / The thesis</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Strategy">
            <Select value={form.strategyId} onChange={(e) => set("strategyId", e.target.value)}>
              <option value="">Unlinked</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Entry TF">
            <Select value={form.entryTimeframe} onChange={(e) => set("entryTimeframe", e.target.value)}>
              {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="HTF">
            <Select value={form.htfTimeframe} onChange={(e) => set("htfTimeframe", e.target.value)}>
              {TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Market bias"><Input value={form.marketBias} onChange={(e) => set("marketBias", e.target.value)} /></Field>
          <Field label="HTF direction"><Input value={form.htfDirection} onChange={(e) => set("htfDirection", e.target.value)} /></Field>
          <Field label="Structure"><Input value={form.marketStructure} onChange={(e) => set("marketStructure", e.target.value)} /></Field>
        </div>
        <Field label="ICT / SMC / custom tags">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const on = tagIds.includes(t.id);
              return (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTagIds((ids) => (on ? ids.filter((i) => i !== t.id) : [...ids, t.id]))}
                  className="badge px-3 py-1.5"
                  style={{
                    background: on ? "var(--accent-wash)" : "transparent",
                    border: `1px solid ${on ? "var(--accent)" : "var(--line)"}`,
                    color: on ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Entry reason"><Textarea value={form.entryReason} onChange={(e) => set("entryReason", e.target.value)} /></Field>
          <Field label="Invalidation"><Textarea value={form.invalidation} onChange={(e) => set("invalidation", e.target.value)} /></Field>
          <Field label="Stop justification"><Textarea value={form.slJustification} onChange={(e) => set("slJustification", e.target.value)} /></Field>
          <Field label="Target justification"><Textarea value={form.tpJustification} onChange={(e) => set("tpJustification", e.target.value)} /></Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="card-heading"><h2>Partials &amp; scaling</h2><span>03 / Executions</span></div>
        <p className="text-sm text-[var(--muted)]">Record multiple entries or scale-outs. These do not auto-recalculate blended P&amp;L unless you override net P&amp;L.</p>
        {executions.map((ex, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-6">
            <Select value={ex.type} onChange={(e) => setExecutions((xs) => xs.map((x, idx) => idx === i ? { ...x, type: e.target.value as typeof ex.type } : x))}>
              <option value="entry">Entry</option>
              <option value="scale_in">Scale in</option>
              <option value="scale_out">Scale out</option>
              <option value="exit">Exit</option>
            </Select>
            <Input placeholder="Price" value={ex.price} onChange={(e) => setExecutions((xs) => xs.map((x, idx) => idx === i ? { ...x, price: e.target.value } : x))} />
            <Input placeholder="Qty" value={ex.quantity} onChange={(e) => setExecutions((xs) => xs.map((x, idx) => idx === i ? { ...x, quantity: e.target.value } : x))} />
            <Input type="datetime-local" value={ex.executedAt} onChange={(e) => setExecutions((xs) => xs.map((x, idx) => idx === i ? { ...x, executedAt: e.target.value } : x))} />
            <Input placeholder="Fees" value={ex.fees} onChange={(e) => setExecutions((xs) => xs.map((x, idx) => idx === i ? { ...x, fees: e.target.value } : x))} />
            <Button type="button" variant="ghost" onClick={() => setExecutions((xs) => xs.filter((_, idx) => idx !== i))}>Remove</Button>
          </div>
        ))}
        <Button type="button" variant="ghost" onClick={() => setExecutions((xs) => [...xs, { type: "scale_out", price: "", quantity: "", executedAt: localNow(), fees: "0", notes: "" }])}>
          Add fill
        </Button>
      </section>

      <section className="card space-y-4 p-5">
        <div className="card-heading"><h2>Psychology</h2><span>04 / Process</span></div>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Before">
            <Select value={form.emotionBefore} onChange={(e) => set("emotionBefore", e.target.value)}>
              {EMOTIONS.map((e) => <option key={e}>{e}</option>)}
            </Select>
          </Field>
          <Field label="During">
            <Select value={form.emotionDuring} onChange={(e) => set("emotionDuring", e.target.value)}>
              {EMOTIONS.map((e) => <option key={e}>{e}</option>)}
            </Select>
          </Field>
          <Field label="After">
            <Select value={form.emotionAfter} onChange={(e) => set("emotionAfter", e.target.value)}>
              {EMOTIONS.map((e) => <option key={e}>{e}</option>)}
            </Select>
          </Field>
          <Field label={`Confidence ${form.confidence}`}>
            <input type="range" min={1} max={10} value={form.confidence} onChange={(e) => set("confidence", Number(e.target.value))} className="w-full" />
          </Field>
          <Field label={`Patience ${form.patience}`}>
            <input type="range" min={1} max={10} value={form.patience} onChange={(e) => set("patience", Number(e.target.value))} className="w-full" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          {flags.map((f) => (
            <label key={f.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={Boolean(form[f.key])} onChange={(e) => set(f.key, e.target.checked as never)} />
              {f.label}
            </label>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="What I did well"><Textarea value={form.didWell} onChange={(e) => set("didWell", e.target.value)} /></Field>
          <Field label="What to improve"><Textarea value={form.improve} onChange={(e) => set("improve", e.target.value)} /></Field>
          <Field label="Lessons"><Textarea value={form.lessons} onChange={(e) => set("lessons", e.target.value)} /></Field>
          <Field label="Reflection"><Textarea value={form.reflection} onChange={(e) => set("reflection", e.target.value)} /></Field>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div className="card-heading"><h2>Chart screenshots</h2><span>05 / Visual evidence</span></div>
        {!tradeId ? <p className="text-sm text-[var(--muted)]">Save the trade to upload private screenshots. They are served only to your account.</p> : null}
        {tradeId ? (
          <ShotUploader onUpload={uploadShot} />
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((s) => (
            <figure key={s.id} className="card-quiet overflow-hidden">
              <button type="button" onClick={() => setZoom(s.id)} className="block w-full">
                <Image
                  src={`/api/screenshots/${s.id}`}
                  alt={s.caption || s.category}
                  width={640}
                  height={320}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
              </button>
              <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-[var(--muted)]">
                <span>{s.category}{s.caption ? ` · ${s.caption}` : ""}</span>
                <button
                  type="button"
                  className="text-[var(--red)]"
                  onClick={async () => {
                    await fetch(`/api/screenshots/${s.id}`, { method: "DELETE" });
                    setShots((xs) => xs.filter((x) => x.id !== s.id));
                  }}
                >
                  Delete
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
        {zoom ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setZoom(null)}>
            <Image
              src={`/api/screenshots/${zoom}`}
              alt="Expanded chart screenshot"
              width={1600}
              height={1200}
              unoptimized
              className="h-auto max-h-full w-auto max-w-full border border-[var(--line-strong)]"
            />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3 border-t border-[var(--line-strong)] pt-5">
        <Button type="submit" loading={saving}>{tradeId ? "Update trade" : "Save trade"}</Button>
        <Button type="button" variant="ghost" onClick={persistDraft}>Save local draft</Button>
      </div>
    </form>
  );
}

function ShotUploader({ onUpload }: { onUpload: (file: File, category: string, caption: string) => Promise<void> }) {
  const [category, setCategory] = useState("entry");
  const [caption, setCaption] = useState("");
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <Field label="Category">
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {SCREENSHOT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Caption">
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
      </Field>
      <label className="btn btn-ghost cursor-pointer">
        Upload image
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file, category, caption);
          }}
        />
      </label>
    </div>
  );
}
