"use client";

import { ExecutionReviewChart } from "@/components/Charts";
import { Stat } from "@/components/ui";
import type { ExecutionReview } from "@/lib/execution-review";
import { formatMoney, formatPct, formatR, formatWhen } from "@/lib/format";

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
      {review.pricePathPoints ? (
        <div className="stats-grid mx-5 mt-4 grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Recorded-path MAE"
            value={review.marketMae ? formatMoney(-Number(review.marketMae.money), currency) : "—"}
            hint={review.marketMae ? `${formatR(review.marketMae.r)} · recorded path only` : "No in-position path observation"}
          />
          <Stat
            label="Recorded-path MFE"
            value={review.marketMfe ? formatMoney(review.marketMfe.money, currency) : "—"}
            hint={review.marketMfe ? `${formatR(review.marketMfe.r)} · recorded path only` : "No in-position path observation"}
          />
          <Stat
            label="Best recorded gross"
            value={formatMoney(review.bestExitGrossPnl, currency)}
            hint={review.bestExitAt ? `Recorded at ${formatWhen(review.bestExitAt)}` : "Closed-trade counterfactual only"}
          />
          <Stat
            label="Actual / best gross"
            value={review.bestExitEfficiency === null ? "—" : formatPct(Number(review.bestExitEfficiency))}
            hint="Recorded-path ratio; not a complete market replay"
          />
        </div>
      ) : null}
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
