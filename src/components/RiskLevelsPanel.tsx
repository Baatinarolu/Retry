"use client";

import { Banner, Button, Field, Input } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { summarizeRiskLevels } from "@/lib/risk-levels";
import { useRef, useState } from "react";

export type RiskLevelSnapshot = {
  id?: string;
  effectiveAt: string;
  stopLoss: string | null;
  takeProfit: string | null;
  notes?: string;
};

type DraftRow = {
  key: string;
  effectiveAt: string;
  stopLoss: string;
  takeProfit: string;
  notes: string;
};

function toDraft(levels: RiskLevelSnapshot[]): DraftRow[] {
  return levels.map((level, index) => ({
    key: level.id || `saved-${index}`,
    effectiveAt: level.effectiveAt,
    stopLoss: level.stopLoss || "",
    takeProfit: level.takeProfit || "",
    notes: level.notes || "",
  }));
}

export function RiskLevelsPanel({
  tradeId,
  levels,
  onSaved,
}: {
  tradeId: string;
  levels: RiskLevelSnapshot[];
  onSaved: (levels: RiskLevelSnapshot[]) => void;
}) {
  const [rows, setRows] = useState(() => toDraft(levels));
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const nextKey = useRef(0);
  const summary = summarizeRiskLevels(levels);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiJson<{ riskLevels: RiskLevelSnapshot[] }>(`/api/trades/${tradeId}/risk-levels`, {
        method: "POST",
        body: JSON.stringify({
          snapshots: rows.map((row) => ({
            effectiveAt: row.effectiveAt.trim(),
            stopLoss: row.stopLoss.trim() || null,
            takeProfit: row.takeProfit.trim() || null,
            notes: row.notes,
          })),
        }),
      });
      setRows(toDraft(data.riskLevels));
      onSaved(data.riskLevels);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save risk history");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!confirm("Clear every stop/target snapshot for this trade?")) return;
    setClearing(true);
    setError("");
    try {
      await apiJson(`/api/trades/${tradeId}/risk-levels`, { method: "DELETE" });
      setRows([]);
      onSaved([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear risk history");
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Plan record / Effective snapshots</p>
          <h2>Stop &amp; target history</h2>
        </div>
        <span>{summary.snapshots} snapshots</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Record when each complete stop/target state became effective. Blank levels mean no stop or target. These are manual journal records, not broker order events; they do not rewrite planned R or target attainment.
      </p>
      {summary.snapshots ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          {summary.stopChanges} stop changes · {summary.targetChanges} target changes after the first snapshot
        </p>
      ) : null}
      <form className="mt-5 space-y-4" onSubmit={save}>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className="card-quiet p-4">
              <div className="grid gap-3 lg:grid-cols-3">
                <Field label={`Effective at ${index + 1}`} hint="ISO timestamp with timezone">
                  <Input
                    value={row.effectiveAt}
                    onChange={(event) => updateRow(row.key, { effectiveAt: event.target.value })}
                    placeholder="2026-10-22T14:00:00Z"
                    className="font-mono text-xs"
                    required
                  />
                </Field>
                <Field label="Stop loss" hint="Blank = no stop">
                  <Input
                    value={row.stopLoss}
                    onChange={(event) => updateRow(row.key, { stopLoss: event.target.value })}
                    inputMode="decimal"
                    placeholder="95.00"
                  />
                </Field>
                <Field label="Take profit" hint="Blank = no target">
                  <Input
                    value={row.takeProfit}
                    onChange={(event) => updateRow(row.key, { takeProfit: event.target.value })}
                    inputMode="decimal"
                    placeholder="110.00"
                  />
                </Field>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <Field label="Reason / note">
                    <Input
                      value={row.notes}
                      onChange={(event) => updateRow(row.key, { notes: event.target.value })}
                      maxLength={500}
                      placeholder="Moved after structure break"
                    />
                  </Field>
                </div>
                <Button type="button" variant="ghost" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
                  Remove
                </Button>
              </div>
            </div>
          ))}
          {!rows.length ? <p className="card-quiet p-4 text-sm text-[var(--muted)]">No snapshot rows. Add one to build the manual history.</p> : null}
        </div>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRows((current) => [...current, {
              key: `draft-${nextKey.current++}`,
              effectiveAt: "",
              stopLoss: "",
              takeProfit: "",
              notes: "",
            }])}
          >
            Add snapshot
          </Button>
          <Button type="submit" loading={saving}>Save history</Button>
          <Button type="button" variant="ghost" onClick={clear} loading={clearing} disabled={clearing || (!levels.length && !rows.length)}>Clear history</Button>
        </div>
      </form>
    </section>
  );
}
