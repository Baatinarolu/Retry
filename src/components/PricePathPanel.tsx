"use client";

import { PricePathChart } from "@/components/Charts";
import { Banner, Button, Field, Textarea } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { parsePricePathDraft, serializePricePath } from "@/lib/price-path";
import { useState } from "react";

export type PricePathPoint = {
  id?: string;
  observedAt: string;
  price: string;
  notes?: string;
};

export function PricePathPanel({
  tradeId,
  points,
  onSaved,
}: {
  tradeId: string;
  points: PricePathPoint[];
  onSaved: (points: PricePathPoint[]) => void;
}) {
  const [draft, setDraft] = useState(serializePricePath(points));
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiJson<{ points: PricePathPoint[] }>(`/api/trades/${tradeId}/price-path`, {
        method: "POST",
        body: JSON.stringify({ points: parsePricePathDraft(draft) }),
      });
      setDraft(serializePricePath(data.points));
      onSaved(data.points);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save price path");
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!confirm("Clear every recorded price point for this trade?")) return;
    setClearing(true);
    setError("");
    try {
      await apiJson(`/api/trades/${tradeId}/price-path`, { method: "DELETE" });
      setDraft("");
      onSaved([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear price path");
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Market record / Manual observations</p>
          <h2>Recorded price path</h2>
        </div>
        <span>{points.length} points</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Add prices you actually recorded during this execution-led trade. This is not a live feed; unrecorded ticks are never inferred. Timestamps must be within the trade’s entry/exit range.
      </p>
      <form className="mt-5 space-y-4" onSubmit={save}>
        <Field label="Price rows" hint="One CSV row per observation: ISO timestamp, price, optional note. The header observed_at,price,notes is implied.">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-40 font-mono text-xs"
            placeholder={'2026-10-22T14:00:00Z,100,"Entry observation"\n2026-10-22T14:10:00Z,120,"Recorded high"'}
            spellCheck={false}
          />
        </Field>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving}>Save price path</Button>
          <Button type="button" variant="ghost" onClick={clear} loading={clearing} disabled={clearing || (!points.length && !draft.trim())}>Clear path</Button>
        </div>
      </form>
      {points.length ? (
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--muted)]">
            <span>Recorded market prices</span>
            <span>Lines connect observations, not market ticks</span>
          </div>
          <PricePathChart data={points.map((point) => ({ observedAt: point.observedAt, price: point.price }))} />
        </div>
      ) : null}
    </section>
  );
}
