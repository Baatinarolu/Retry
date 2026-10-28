"use client";

import {
  DIRECTIONS,
  EMOTIONS,
  MARKET_CATEGORIES,
  SESSIONS,
  TIMEFRAMES,
  TRADE_TYPES,
} from "@/lib/constants";
import { computeTradeMetrics } from "@/lib/calculations";
import { apiJson } from "@/lib/client-api";
import { calculateExecutionLedger } from "@/lib/execution-ledger";
import { formatMoney, formatR } from "@/lib/format";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { Banner, Button, Field, Input, Select, Textarea } from "./ui";
import { ScreenshotGallery, ScreenshotLightbox, type TradeScreenshot } from "./ScreenshotGallery";
import { ScreenshotUploader } from "./ScreenshotUploader";

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
  quoteCurrency: string;
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

function displayFactor(value: number) {
  return Number(value.toPrecision(12)).toString();
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
  positionSize: "",
  lotSize: "",
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

export function TradeForm({
  tradeId,
  onSaved,
  screenshots,
  onScreenshotsChanged,
}: {
  tradeId?: string;
  onSaved?: (trade: Record<string, unknown>) => void;
  screenshots?: TradeScreenshot[];
  onScreenshotsChanged?: Dispatch<SetStateAction<TradeScreenshot[]>>;
}) {
  const router = useRouter();
  const draftKey = tradeId ? `${DRAFT_KEY}:${tradeId}` : DRAFT_KEY;
  const [form, setForm] = useState(empty);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentsLoaded, setInstrumentsLoaded] = useState(false);
  const [executions, setExecutions] = useState<
    { type: "entry" | "scale_in" | "scale_out" | "exit"; price: string; quantity: string; executedAt: string; fees: string; notes: string }[]
  >([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [applyingSpecification, setApplyingSpecification] = useState(false);
  const [offlineDraft, setOfflineDraft] = useState(false);
  const [localShots, setLocalShots] = useState<TradeScreenshot[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const shots = screenshots ?? localShots;
  const updateShots: Dispatch<SetStateAction<TradeScreenshot[]>> = (update) => {
    if (onScreenshotsChanged) onScreenshotsChanged(update);
    else setLocalShots(update);
  };
  const selectedAccount = accounts.find((account) => account.id === form.accountId);
  const currency = selectedAccount?.currency || "USD";
  const selectedInstrument = instruments.find((instrument) => instrument.symbol === form.instrument);
  const specificationMatchesTemplate = selectedInstrument
    ? (["contractSize", "tickSize", "tickValue", "pipSize", "pipValue"] as const)
      .every((key) => Number(form[key]) === Number(selectedInstrument[key]))
    : false;
  const quoteCurrency = selectedInstrument?.quoteCurrency?.toUpperCase();
  const manualPnlAllowed = form.status === "closed" || executions.length > 0;
  const calculationBasis = Number(form.tickSize) > 0 && Number(form.tickValue) > 0
    ? `Tick method: (directional price move ÷ ${form.tickSize}) × ${form.tickValue} ${currency} × quantity.`
    : Number(form.pipSize) > 0 && Number(form.pipValue) > 0
      ? `Pip method: (directional price move ÷ ${form.pipSize}) × ${form.pipValue} ${currency} × quantity.`
      : Number(form.contractSize) > 0
        ? `Contract method: directional price move × ${form.contractSize} × quantity; the result is treated as ${currency}.`
        : `Quantity-only method: directional price move × quantity; the result is treated as ${currency}.`;

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
      apiJson<{ accounts?: Account[]; instruments?: Instrument[] }>("/api/bootstrap"),
      apiJson<{ strategies?: Strategy[] }>("/api/strategies?basic=1"),
      apiJson<{ tags?: Tag[] }>("/api/tags"),
    ]).then(([boot, strat, tag]) => {
      setAccounts(boot.accounts || []);
      setInstruments(boot.instruments || []);
      setStrategies(strat.strategies || []);
      setTags(tag.tags || []);
      setInstrumentsLoaded(true);
      setForm((current) => {
        const hasDraft = Boolean(localStorage.getItem(draftKey));
        const specificationUntouched = (["contractSize", "tickSize", "tickValue", "pipSize", "pipValue"] as const)
          .every((key) => current[key] === empty[key]);
        const instrument = tradeId || hasDraft || !specificationUntouched
          ? undefined
          : boot.instruments?.find((item) => item.symbol === current.instrument);
        return {
          ...current,
          accountId: current.accountId || boot.accounts?.[0]?.id || "",
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
        };
      });
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load accounts and strategy data."));
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
          setLocalShots(t.screenshots || []);
          // A failed edit may have a newer local draft; restore it after the server version.
          restoreDraft();
        })
        .catch(() => setError("Could not load this trade."));
    }
  }, [tradeId, draftKey, restoreDraft]);

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

  async function applyInstrumentSpecification() {
    setApplyingSpecification(true);
    setError("");
    try {
      const data = await apiJson<{ instruments?: Instrument[] }>("/api/instruments");
      const latest = data.instruments || [];
      setInstruments(latest);
      const instrument = latest.find((item) => item.symbol === form.instrument);
      if (!instrument) throw new Error(`No saved instrument specification exists for ${form.instrument}`);
      setForm((current) => ({
        ...current,
        marketCategory: instrument.category || current.marketCategory,
        contractSize: instrument.contractSize,
        tickSize: instrument.tickSize,
        tickValue: instrument.tickValue,
        pipSize: instrument.pipSize,
        pipValue: instrument.pipValue,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load the instrument specification");
    } finally {
      setApplyingSpecification(false);
    }
  }

  const summaryMetrics = useMemo(
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

  const executionPreview = useMemo(() => {
    if (!executions.length) return { ledger: null, error: "" };
    try {
      return {
        ledger: calculateExecutionLedger({
          direction: form.direction as "long" | "short",
          status: form.status as "open" | "closed",
          executions,
          stopLoss: form.stopLoss,
          takeProfit: form.takeProfit,
          contractSize: form.contractSize,
          tickSize: form.tickSize,
          tickValue: form.tickValue,
          pipSize: form.pipSize,
          pipValue: form.pipValue,
          commission: form.commission,
          swap: form.swap,
          slippage: form.slippage,
          overrideNetPnl: form.pnlOverridden ? form.overrideNetPnl : null,
        }),
        error: "",
      };
    } catch (cause) {
      return { ledger: null, error: cause instanceof Error ? cause.message : "Invalid executions" };
    }
  }, [executions, form]);
  const metrics = executionPreview.ledger?.metrics ?? summaryMetrics;
  const calculationTrace = useMemo(() => {
    if (executionPreview.ledger || form.status === "open" || !form.exitPrice) return "";
    const entry = Number(form.entryPrice);
    const exit = Number(form.exitPrice);
    const quantity = Number(form.positionSize || form.lotSize);
    if (![entry, exit, quantity].every(Number.isFinite) || quantity <= 0) return "";
    const move = form.direction === "long" ? exit - entry : entry - exit;
    const tickSize = Number(form.tickSize);
    const tickValue = Number(form.tickValue);
    const pipSize = Number(form.pipSize);
    const pipValue = Number(form.pipValue);
    if (tickSize > 0 && tickValue > 0) {
      return `${(move / tickSize).toFixed(4)} ticks × ${displayFactor(tickValue * quantity)} ${currency} per tick for this position = ${metrics.grossPnl} ${currency}`;
    }
    if (pipSize > 0 && pipValue > 0) {
      return `${(move / pipSize).toFixed(4)} pips × ${displayFactor(pipValue * quantity)} ${currency} per pip for this position = ${metrics.grossPnl} ${currency}`;
    }
    const contractSize = Number(form.contractSize);
    if (contractSize > 0) {
      return `Price move ${move.toFixed(8)} × contract ${form.contractSize} × quantity ${quantity} = ${metrics.grossPnl} ${currency}`;
    }
    return `Price move ${move.toFixed(8)} × quantity ${quantity} = ${metrics.grossPnl} ${currency}`;
  }, [currency, executionPreview.ledger, form, metrics.grossPnl]);
  const positionSizeForRisk = executionPreview.ledger?.positionSize ?? (form.positionSize || form.lotSize);

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
          positionSize: Number(positionSizeForRisk || 0),
        }),
      })
        .then((r) => r.json())
        .then((d) => setWarnings(d.warnings || []))
        .catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [form.accountId, positionSizeForRisk, metrics.initialRisk, metrics.plannedRr]);

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
      if (executionPreview.error) throw new Error(executionPreview.error);
      if (!executions.length && !(Number(form.positionSize || form.lotSize) > 0)) {
        throw new Error("Enter the lot size or contract quantity exactly as shown by your broker.");
      }
      if (!executions.length && form.status === "closed" && (!form.exitAt || !form.exitPrice)) {
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
    if (!tradeId) throw new Error("Save the trade first, then attach screenshots.");
    const data = new FormData();
    data.set("file", file);
    data.set("category", category);
    data.set("caption", caption);
    const response = await fetch(`/api/trades/${tradeId}/screenshots`, { method: "POST", body: data });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Upload failed");
    updateShots((current) => [...current, result.screenshot]);
    setError("");
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
          <fieldset>
            <legend className="eyebrow mb-2">How should we record P&amp;L?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`card-quiet flex cursor-pointer items-start gap-3 p-3 ${!form.pnlOverridden ? "border-[var(--accent)]" : ""}`}>
                <input className="mt-1" type="radio" name="pnl-entry-method" checked={!form.pnlOverridden} onChange={() => set("pnlOverridden", false)} />
                <span>
                  <span className="block text-sm font-medium">Calculate automatically</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Use the saved symbol settings. You only enter prices and position size—no pip math.</span>
                </span>
              </label>
              <label className={`card-quiet flex items-start gap-3 p-3 ${manualPnlAllowed ? "cursor-pointer" : "opacity-50"} ${form.pnlOverridden ? "border-[var(--accent)]" : ""}`}>
                <input className="mt-1" type="radio" name="pnl-entry-method" checked={form.pnlOverridden} disabled={!manualPnlAllowed} onChange={() => set("pnlOverridden", true)} />
                <span>
                  <span className="block text-sm font-medium">Use broker P&amp;L</span>
                  <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">Simplest when pip/tick values are unknown. Copy the final profit or loss from your broker.</span>
                </span>
              </label>
            </div>
          </fieldset>
          {form.pnlOverridden && manualPnlAllowed ? (
            <Field label={`Final net P&L from broker (${currency})`} hint="Copy the final amount after broker costs. Use a minus sign for a loss, for example -250.50.">
              <Input inputMode="decimal" value={form.overrideNetPnl} onChange={(e) => set("overrideNetPnl", e.target.value)} placeholder="646.07 or -250.50" required />
            </Field>
          ) : null}
          {!form.pnlOverridden && instrumentsLoaded ? (
            specificationMatchesTemplate ? (
              <Banner tone="good">Saved {form.instrument} settings are loaded. Enter the trade prices and size; no contract, tick, or pip values are needed from you.</Banner>
            ) : selectedInstrument ? (
              <Banner tone="warn">
                This trade&apos;s calculation settings differ from the saved {form.instrument} template. <button type="button" className="font-medium underline" onClick={() => void applyInstrumentSpecification()}>Load saved settings</button> or review the advanced fields before saving.
              </Banner>
            ) : (
              <Banner tone="warn">No saved template was found for {form.instrument}. Use broker P&amp;L for the simplest entry, or review the advanced calculation settings before saving.</Banner>
            )
          ) : null}
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
              <Input
                type="datetime-local"
                value={executionPreview.ledger ? toLocalInput(executionPreview.ledger.entryAt) : form.entryAt}
                onChange={(e) => set("entryAt", e.target.value)}
                disabled={executions.length > 0}
                required
              />
            </Field>
            <Field label="Exit">
              <Input
                type="datetime-local"
                value={executionPreview.ledger ? (executionPreview.ledger.exitAt ? toLocalInput(executionPreview.ledger.exitAt) : "") : form.exitAt}
                onChange={(e) => set("exitAt", e.target.value)}
                disabled={form.status === "open" || executions.length > 0}
                required={form.status === "closed" && executions.length === 0}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(e) => {
                  const status = e.target.value;
                  setForm((current) => ({
                    ...current,
                    status,
                    pnlOverridden: status === "open" && executions.length === 0 ? false : current.pnlOverridden,
                  }));
                }}
              >
                <option value="closed">Closed</option>
                <option value="open">Open</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Entry price" hint="Copy the price from your broker.">
              <Input
                inputMode="decimal"
                value={executionPreview.ledger?.entryPrice ?? form.entryPrice}
                onChange={(e) => set("entryPrice", e.target.value)}
                readOnly={executions.length > 0}
                required={executions.length === 0}
              />
            </Field>
            <Field label="Exit price" hint="Use the final exit price.">
              <Input
                inputMode="decimal"
                value={executionPreview.ledger ? (executionPreview.ledger.exitPrice ?? "") : form.exitPrice}
                onChange={(e) => set("exitPrice", e.target.value)}
                readOnly={executions.length > 0}
                required={form.status === "closed" && executions.length === 0}
              />
            </Field>
            <Field label="Stop loss (optional)">
              <Input inputMode="decimal" value={form.stopLoss} onChange={(e) => set("stopLoss", e.target.value)} />
            </Field>
            <Field label="Take profit (optional)">
              <Input inputMode="decimal" value={form.takeProfit} onChange={(e) => set("takeProfit", e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Field
              label={form.marketCategory === "forex" ? "Lot size" : "Quantity / contracts"}
              hint="Copy this exactly—for example 0.01. Do not convert lots into units."
            >
              <Input
                inputMode="decimal"
                value={executionPreview.ledger?.positionSize ?? form.lotSize}
                onChange={(e) => { set("lotSize", e.target.value); set("positionSize", e.target.value); }}
                readOnly={executions.length > 0}
                required={executions.length === 0}
                placeholder="0.01"
              />
            </Field>
          </div>
          <details className="editorial-details">
            <summary>Fees &amp; adjustments (optional)</summary>
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Costs affect automatic net P&amp;L. They do not change a broker-entered net result.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label={`Commission (${currency})`}><Input inputMode="decimal" value={form.commission} onChange={(e) => set("commission", e.target.value)} /></Field>
              <Field label={`Swap / funding (${currency})`}><Input inputMode="decimal" value={form.swap} onChange={(e) => set("swap", e.target.value)} /></Field>
              <Field label={`Slippage cost (${currency})`}><Input inputMode="decimal" value={form.slippage} onChange={(e) => set("slippage", e.target.value)} /></Field>
            </div>
          </details>
          <details className="editorial-details">
            <summary>Advanced calculation settings (usually not needed)</summary>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" variant="ghost" loading={applyingSpecification} onClick={() => void applyInstrumentSpecification()}>Use saved {form.instrument} specification</Button>
              <p className="max-w-2xl text-xs leading-5 text-[var(--muted)]">Replace the contract/tick/pip fields in this editor with the latest template. Review the calculator, then {tradeId ? "Update trade" : "Save trade"} to keep the result.{form.pnlOverridden ? " Choose Calculate automatically above if you want calculated net P&L." : ""}</p>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              <Field label="Contract size"><Input inputMode="decimal" value={form.contractSize} onChange={(e) => set("contractSize", e.target.value)} /></Field>
              <Field label="Tick size"><Input inputMode="decimal" value={form.tickSize} onChange={(e) => set("tickSize", e.target.value)} /></Field>
              <Field label={`Tick value / lot (${currency})`}><Input inputMode="decimal" value={form.tickValue} onChange={(e) => set("tickValue", e.target.value)} /></Field>
              <Field label="Pip size"><Input inputMode="decimal" value={form.pipSize} onChange={(e) => set("pipSize", e.target.value)} /></Field>
              <Field label={`Pip value / lot (${currency})`}><Input inputMode="decimal" value={form.pipValue} onChange={(e) => set("pipValue", e.target.value)} /></Field>
            </div>
          </details>
        </section>

        <aside className="card h-fit space-y-3 p-5">
          <div className="card-heading"><h2>Calculator</h2><span>Live preview</span></div>
          <p className="text-xs leading-5 text-[var(--muted)]">{form.pnlOverridden ? "Using the final net result you entered from your broker." : executionPreview.ledger ? "Reconciled automatically from your fills and saved calculation settings." : "Calculated automatically from your prices, size, and saved calculation settings."}</p>
          {!form.pnlOverridden ? (
            <>
              {calculationTrace ? (
                <div className="card-quiet p-3">
                  <p className="eyebrow">Simple breakdown</p>
                  <p className="font-mono-num mt-1 text-xs leading-5">{calculationTrace}</p>
                </div>
              ) : !executionPreview.ledger ? <p className="text-xs leading-5 text-[var(--muted)]">Enter entry price, exit price, and size to see the calculation.</p> : null}
              <details className="editorial-details">
                <summary>Technical calculation details</summary>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{calculationBasis}</p>
              </details>
            </>
          ) : null}
          {!form.pnlOverridden && quoteCurrency && quoteCurrency !== currency.toUpperCase() ? (
            <Banner>
              The current {form.instrument} template is quoted in {quoteCurrency}, while {selectedAccount?.name || "this account"} uses {currency}. No automatic {quoteCurrency} → {currency} trade-P&amp;L conversion is applied. Use pip/tick values already denominated in {currency}, or choose Use broker P&amp;L. Reporting FX rates do not rewrite this native calculation.
            </Banner>
          ) : null}
          {form.pnlOverridden ? <Banner tone="good">No pip, tick, or currency conversion is applied to your broker net. Calculated gross P&amp;L and initial risk still use the saved specification.</Banner> : null}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">{form.pnlOverridden ? "Calculated gross" : "Gross"}</p><p className="font-mono-num">{formatMoney(metrics.grossPnl, currency)}</p></div>
            <div className="card-quiet p-3"><p className="text-xs text-[var(--muted)]">{form.pnlOverridden ? "Broker net" : "Net"}</p><p className="font-mono-num">{formatMoney(metrics.netPnl, currency)}</p></div>
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
        <p className="text-sm text-[var(--muted)]">
          Fills drive blended entry/exit prices, quantities, realized P&amp;L, and holding time. Summary fields become read-only while fills are present.
        </p>
        {executionPreview.error ? <Banner tone="warn">{executionPreview.error}</Banner> : null}
        {executionPreview.ledger ? (
          <div className="card-quiet grid gap-2 p-3 text-xs text-[var(--muted)] sm:grid-cols-3">
            <span>Open quantity <strong className="text-[var(--text)]">{executionPreview.ledger.remainingQuantity}</strong></span>
            <span>Blended entry <strong className="text-[var(--text)]">{executionPreview.ledger.entryPrice}</strong></span>
            <span>Blended exit <strong className="text-[var(--text)]">{executionPreview.ledger.exitPrice ?? "—"}</strong></span>
          </div>
        ) : null}
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
        <Button type="button" variant="ghost" onClick={() => setExecutions((xs) => [...xs, { type: xs.length ? "scale_out" : "entry", price: "", quantity: "", executedAt: localNow(), fees: "0", notes: "" }])}>
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
        {!tradeId ? <p className="text-sm text-[var(--muted)]">Save the trade, then use Add images on its detail page. Images are uploaded only after the server confirms the trade exists.</p> : null}
        {tradeId ? <ScreenshotUploader onUpload={uploadShot} /> : null}
        <ScreenshotGallery
          screenshots={shots}
          onUpdated={(updated) => updateShots((current) => current.map((shot) => shot.id === updated.id ? updated : shot))}
          onDeleted={(deletedId) => updateShots((current) => current.filter((shot) => shot.id !== deletedId))}
          onZoom={setZoom}
        />
        <ScreenshotLightbox screenshotId={zoom} onClose={() => setZoom(null)} />
      </section>

      <div className="flex flex-wrap gap-3 border-t border-[var(--line-strong)] pt-5">
        <Button type="submit" loading={saving}>{tradeId ? "Update trade" : "Save trade"}</Button>
        <Button type="button" variant="ghost" onClick={persistDraft}>Save local draft</Button>
      </div>
    </form>
  );
}
