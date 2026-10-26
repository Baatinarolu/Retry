"use client";

import { Banner, Button, Field, Select, Textarea } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { useState } from "react";

type ReviewStatus = "unreviewed" | "reviewed" | "needs_follow_up";

export function BulkReviewBar({
  selectedIds,
  onCompleted,
  onClear,
}: {
  selectedIds: string[];
  onCompleted: (count: number) => void;
  onClear: () => void;
}) {
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("reviewed");
  const [nextAction, setNextAction] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIds.length || saving) return;
    setSaving(true);
    setError("");
    try {
      const data = await apiJson<{ reviews: Array<{ id: string }> }>("/api/trades", {
        method: "PATCH",
        body: JSON.stringify({
          ids: selectedIds,
          reviewStatus,
          ...(reviewStatus === "needs_follow_up" ? { nextAction } : {}),
        }),
      });
      setNextAction("");
      onCompleted(data.reviews.length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update selected reviews");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="border-b border-[var(--line-strong)] bg-[var(--accent-wash)] p-4" onSubmit={apply}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-48 flex-1">
          <Field label={`${selectedIds.length} selected on this page`}>
            <Select value={reviewStatus} disabled={saving} onChange={(event) => setReviewStatus(event.target.value as ReviewStatus)}>
              <option value="reviewed">Mark reviewed</option>
              <option value="unreviewed">Mark unreviewed</option>
              <option value="needs_follow_up">Needs follow-up</option>
            </Select>
          </Field>
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={saving} disabled={!selectedIds.length}>Apply to selected</Button>
          <Button type="button" variant="ghost" disabled={saving} onClick={onClear}>Clear selection</Button>
        </div>
      </div>
      {reviewStatus === "needs_follow_up" ? (
        <div className="mt-3">
          <Field label="Shared next-time action" hint="This exact action will replace the next-action text on every selected trade.">
            <Textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} maxLength={2000} required disabled={saving} placeholder="Next time, I will…" />
          </Field>
        </div>
      ) : (
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Existing next-action text is preserved on each trade. Only review status and review timestamp change.</p>
      )}
      {error ? <div className="mt-3"><Banner tone="warn">{error}</Banner></div> : null}
    </form>
  );
}
