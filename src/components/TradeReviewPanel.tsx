"use client";

import { Banner, Button, Field, Select, Textarea } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatWhen } from "@/lib/format";
import { useState } from "react";

export type TradeReviewState = {
  id: string;
  reviewStatus: "unreviewed" | "reviewed" | "needs_follow_up";
  reviewedAt: string | null;
  nextAction: string;
};

export function TradeReviewPanel({ trade, onSaved }: { trade: TradeReviewState; onSaved: (review: TradeReviewState) => void }) {
  const [reviewStatus, setReviewStatus] = useState(trade.reviewStatus || "unreviewed");
  const [nextAction, setNextAction] = useState(trade.nextAction || "");
  const [reviewedAt, setReviewedAt] = useState(trade.reviewedAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await apiJson<{ review: TradeReviewState }>(`/api/trades/${trade.id}/review`, {
        method: "PATCH",
        body: JSON.stringify({ reviewStatus, nextAction }),
      });
      setReviewedAt(data.review.reviewedAt);
      onSaved(data.review);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save review");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-5">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Close the loop</p>
          <h2>Review &amp; next time</h2>
        </div>
        <span>{reviewedAt ? `Reviewed ${formatWhen(reviewedAt)}` : "Not reviewed"}</span>
      </div>
      <form className="mt-5 space-y-4" onSubmit={save}>
        <Field label="Review status">
          <Select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as TradeReviewState["reviewStatus"])}>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="needs_follow_up">Needs follow-up</option>
          </Select>
        </Field>
        <Field label="Next-time action" hint="Make it observable: what will you do differently on the next comparable setup?">
          <Textarea
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            maxLength={2000}
            placeholder="Next time, I will wait for the second confirmation and reduce size after the first scale-out."
          />
        </Field>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        <Button type="submit" loading={saving}>Save review</Button>
      </form>
    </section>
  );
}
