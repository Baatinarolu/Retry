"use client";

import { Banner, Button, Field, Input, Textarea } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReverseTradePanel({
  tradeId,
  direction,
  remainingQuantity,
}: {
  tradeId: string;
  direction: "long" | "short";
  remainingQuantity: string;
}) {
  const router = useRouter();
  const [executedAt, setExecutedAt] = useState("");
  const [closePrice, setClosePrice] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [quantity, setQuantity] = useState(remainingQuantity);
  const [closeFees, setCloseFees] = useState("0");
  const [entryFees, setEntryFees] = useState("0");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiJson<{ reversalTrade: { id: string } }>(`/api/trades/${tradeId}/reverse`, {
        method: "POST",
        body: JSON.stringify({
          executedAt: executedAt.trim(),
          closePrice: closePrice.trim(),
          entryPrice: entryPrice.trim(),
          quantity: quantity.trim(),
          closeFees: closeFees.trim() || "0",
          entryFees: entryFees.trim() || "0",
          stopLoss: stopLoss.trim() || null,
          takeProfit: takeProfit.trim() || null,
          notes,
        }),
      });
      router.push(`/trades/${data.reversalTrade.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not reverse trade");
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Position action / Linked round trips</p>
          <h2>Reverse this position</h2>
        </div>
        <span className="capitalize">{direction} → {direction === "long" ? "short" : "long"}</span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
        Close all {remainingQuantity} remaining and open a separate opposite-direction trade. The original keeps its own realized P&amp;L and risk; the new trade starts a new round trip. Close and entry prices may differ.
      </p>
      <form className="mt-5 space-y-4" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Reversal time" hint="ISO timestamp; later than the last fill">
            <Input value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} placeholder="2026-10-22T14:00:00Z" className="font-mono text-xs" required />
          </Field>
          <Field label="Close price" hint="Original position exit">
            <Input value={closePrice} onChange={(event) => setClosePrice(event.target.value)} inputMode="decimal" required />
          </Field>
          <Field label="New entry price" hint="Opposite position entry">
            <Input value={entryPrice} onChange={(event) => setEntryPrice(event.target.value)} inputMode="decimal" required />
          </Field>
          <Field label="New opposite quantity" hint="Original remainder is always closed">
            <Input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" required />
          </Field>
          <Field label="Close fees">
            <Input value={closeFees} onChange={(event) => setCloseFees(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="New entry fees">
            <Input value={entryFees} onChange={(event) => setEntryFees(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="New stop loss" hint="Optional; does not copy old direction">
            <Input value={stopLoss} onChange={(event) => setStopLoss(event.target.value)} inputMode="decimal" />
          </Field>
          <Field label="New take profit" hint="Optional; does not copy old direction">
            <Input value={takeProfit} onChange={(event) => setTakeProfit(event.target.value)} inputMode="decimal" />
          </Field>
        </div>
        <Field label="Reversal note">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Why did the original thesis invalidate?" />
        </Field>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        <Button type="submit" loading={saving}>Record linked reversal</Button>
      </form>
    </section>
  );
}
