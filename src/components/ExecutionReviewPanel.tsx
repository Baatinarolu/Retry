"use client";

import { ExecutionReviewChart } from "@/components/Charts";
import { Stat } from "@/components/ui";
import type { ExecutionReview } from "@/lib/execution-review";
import { formatMoney, formatPct, formatR } from "@/lib/format";

export function ExecutionReviewPanel({ review, currency }: { review: ExecutionReview; currency: string }) {
  return (
    <section className="card overflow-hidden">
      <div className="card-heading px-5 pt-5">
        <div>
          <p className="eyebrow mb-2">Execution review</p>
          <h2>What the fills can prove</h2>
        </div>
        <span>{review.points.length} ordered fills</span>
      </div>
      <div className="stats-grid mx-5 mt-5 grid-cols-2 lg:grid-cols-4">
        <Stat label="Realized net" value={formatMoney(review.finalNetPnl, currency)} tone={Number(review.finalNetPnl) >= 0 ? "up" : "down"} />
        <Stat
          label="Target attainment"
          value={review.targetAttainment === null ? "—" : formatPct(Number(review.targetAttainment))}
          hint="Actual blended exit versus planned target"
        />
        <Stat
          label="Observed MAE"
          value={review.observedMae ? formatMoney(-Number(review.observedMae.money), currency) : "—"}
          hint={review.observedMae ? `${formatR(review.observedMae.r)} · execution prices only` : "Needs a second fill"}
        />
        <Stat
          label="Observed MFE"
          value={review.observedMfe ? formatMoney(review.observedMfe.money, currency) : "—"}
          hint={review.observedMfe ? `${formatR(review.observedMfe.r)} · execution prices only` : "Needs a second fill"}
        />
      </div>
      <div className="mt-5 border-t border-[var(--line)] px-5 pt-4">
        <div className="mb-2 flex flex-wrap justify-between gap-2 text-xs text-[var(--muted)]">
          <span>Price and running realized P&amp;L</span>
          <span>Lines connect fills, not market ticks</span>
        </div>
        <ExecutionReviewChart data={review.points} currency={currency} />
      </div>
      <ul className="space-y-1 border-t border-[var(--line)] px-5 py-4 text-xs leading-5 text-[var(--muted)]">
        {review.notes.map((note) => <li key={note}>• {note}</li>)}
      </ul>
    </section>
  );
}
