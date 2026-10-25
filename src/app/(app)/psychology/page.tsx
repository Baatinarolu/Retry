"use client";

import { FxConversionNotice } from "@/components/FxConversionNotice";
import { Banner, Button, Card, Spinner, Stat } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { formatMoney, pnlClass } from "@/lib/format";
import { useEffect, useState } from "react";

export default function PsychologyPage() {
  const ws = useWorkspace();
  const { loading: workspaceLoading, loadAnalytics } = ws;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [sequenceMode, setSequenceMode] = useState<"realization" | "position">("realization");
  useEffect(() => {
    if (workspaceLoading) return;
    const controller = new AbortController();
    loadAnalytics(controller.signal)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load psychology analytics");
        }
      });
    return () => controller.abort();
  }, [workspaceLoading, loadAnalytics]);
  if (workspaceLoading || !data) return ws.error || error ? <Banner tone="warn">{ws.error || error}</Banner> : <Spinner />;
  const a = data.analytics;

  return (
    <div className="space-y-7">
      <FxConversionNotice conversion={data.conversion} />
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Behavior / Process review</p>
          <h1>Psychology</h1>
          <p className="page-description">Emotional tags versus outcomes. These are journal correlations, not diagnoses or market predictions.</p>
        </div>
      </div>
      <div className="stats-grid grid-cols-1 md:grid-cols-3">
        <Stat label="Rule following" value={a.stats.ruleFollowingPct === null ? "—" : `${a.stats.ruleFollowingPct}%`} />
        <Stat label="Plan-break trades" value={a.byPlan.find((p: any) => p.key.startsWith("Broke"))?.stats.totalTrades ?? 0} />
        <Stat label="Tagged mistakes" value={a.mistakes.reduce((s: number, m: any) => s + m.count, 0)} />
      </div>
      <Card>
        <h2 className="mb-3 font-semibold">Emotion before entry</h2>
        <ul className="grid gap-2 md:grid-cols-2">
          {a.byEmotion.map((r: any) => (
            <li key={r.key} className="flex justify-between card-quiet p-3 text-sm">
              <span>{r.label} n={r.stats.totalTrades}{r.sampleWarning ? " · small n" : ""}</span>
              <span className={pnlClass(r.stats.netPnl)}>{formatMoney(r.stats.netPnl, ws.currency)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Costliest process tags</h2>
        {a.mistakes.length === 0 ? <p className="text-sm text-[var(--muted)]">Tag mistakes on the trade form to populate this view.</p> : null}
        <ul className="space-y-2">
          {a.mistakes.map((m: any) => (
            <li key={m.label} className="flex justify-between text-sm">
              <span>{m.label} × {m.count}</span>
              <span className={pnlClass(m.netPnl)}>{formatMoney(m.netPnl, ws.currency)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <div className="card-heading"><div><p className="eyebrow mb-2">Sequences, not causes</p><h2>What happens next?</h2></div><span>{sequenceMode === "realization" ? "Realization order" : "Entry after realization"}</span></div>
        <div className="mb-3 flex flex-wrap gap-2" aria-label="Behavior sequence mode">
          <Button type="button" variant={sequenceMode === "realization" ? "primary" : "ghost"} aria-pressed={sequenceMode === "realization"} onClick={() => setSequenceMode("realization")}>Next closed trade</Button>
          <Button type="button" variant={sequenceMode === "position" ? "primary" : "ghost"} aria-pressed={sequenceMode === "position"} onClick={() => setSequenceMode("position")}>Next new position</Button>
        </div>
        {a.behaviorSequences.length === 0 ? <p className="text-sm text-[var(--muted)]">Record at least two closed trades to compare next-trade sequences.</p> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Previous trade</th><th>n</th><th>Next avg P&amp;L</th><th>Next avg R</th><th>Other avg R</th></tr></thead>
              <tbody>
                {a.behaviorSequences.map((sequence: any) => {
                  const summary = sequenceMode === "position" ? sequence.nextPosition : sequence;
                  const comparison = sequenceMode === "position" ? sequence.nextPositionComparison : sequence.comparison;
                  const warning = sequenceMode === "position" ? sequence.nextPositionSampleWarning : sequence.sampleWarning;
                  return (
                    <tr key={sequence.key}>
                      <td>{sequence.label}{summary && warning ? " *" : ""}</td>
                      <td>{summary?.sampleSize ?? 0}</td>
                      <td className={pnlClass(summary?.averagePnl ?? null)}>{formatMoney(summary?.averagePnl ?? null, ws.currency)}</td>
                      <td>{summary?.averageR ?? "—"}</td>
                      <td>{comparison?.averageR ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          {sequenceMode === "realization"
            ? "Realization mode examines the next closed trade after the tagged event. Concurrent positions can overlap in this view."
            : "New-position mode chooses the earliest closed trade entered strictly after the event's realization; equal timestamps are excluded as ambiguous. A following position can be shared by multiple events."}
          {" "}Other avg R is the complementary sample. * Fewer than 20 observations. Open trades are excluded; these are correlations, not causal findings.
        </p>
      </Card>
      <Banner>
        After a losing streak, review size and rules before the next click. Revenge size and martingale are never part of this coach.
      </Banner>
    </div>
  );
}
