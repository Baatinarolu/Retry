import { MIN_SAMPLE_FOR_CONCLUSION } from "@/lib/constants";
import { computePerformanceStats, realizationDate, type ClosedTradeStatsInput } from "@/lib/calculations";

export type BehaviorTrade = ClosedTradeStatsInput & {
  id: string;
  fomo?: boolean;
  revenge?: boolean;
  earlyExit?: boolean;
};

export type SequenceSummary = {
  sampleSize: number;
  netPnl: string;
  averagePnl: string | null;
  averageR: number | null;
  expectancyR: number | null;
  winRate: number | null;
};

export type BehaviorSequence = SequenceSummary & {
  key: string;
  label: string;
  comparison: SequenceSummary | null;
  sampleWarning: boolean;
  /** Next newly opened closed position after the event's realization. */
  nextPosition: SequenceSummary | null;
  nextPositionComparison: SequenceSummary | null;
  nextPositionSampleWarning: boolean;
};

function summarize(trades: BehaviorTrade[], startingBalance: string): SequenceSummary {
  const stats = computePerformanceStats(trades, startingBalance);
  return {
    sampleSize: stats.totalTrades,
    netPnl: stats.netPnl,
    averagePnl: stats.expectancyCurrency,
    averageR: stats.averageRr,
    expectancyR: stats.expectancyR,
    winRate: stats.winRate,
  };
}

function comparePositionOrder(a: BehaviorTrade, b: BehaviorTrade) {
  return a.entryAt.getTime() - b.entryAt.getTime()
    || realizationDate(a).getTime() - realizationDate(b).getTime()
    || a.id.localeCompare(b.id);
}

/** Exclude positions entered before/at the event's realization; equal timestamps are ambiguous. */
function nextPositionAfter(event: BehaviorTrade, entrySorted: BehaviorTrade[]) {
  const eventRealizedAt = realizationDate(event).getTime();
  let low = 0;
  let high = entrySorted.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (entrySorted[middle].entryAt.getTime() <= eventRealizedAt) low = middle + 1;
    else high = middle;
  }
  for (let index = low; index < entrySorted.length; index++) {
    if (entrySorted[index].id !== event.id) return entrySorted[index];
  }
  return null;
}

/** Compares the next closed trade after a tagged event with next trades after other events. */
export function buildBehaviorSequences(trades: BehaviorTrade[], startingBalance = "0"): BehaviorSequence[] {
  const sorted = trades
    .filter((trade) => !trade.status || trade.status === "closed")
    .sort((a, b) => realizationDate(a).getTime() - realizationDate(b).getTime() || a.id.localeCompare(b.id));
  if (sorted.length < 2) return [];
  const nextTrades = sorted.slice(1);
  const entrySorted = [...sorted].sort(comparePositionOrder);
  const positionPairs = sorted.flatMap((event) => {
    const next = nextPositionAfter(event, entrySorted);
    return next ? [{ event, next }] : [];
  });
  const definitions: Array<{ key: string; label: string; matches: (trade: BehaviorTrade) => boolean }> = [
    { key: "after-loss", label: "After a loss", matches: (trade) => trade.result === "loss" },
    { key: "after-win", label: "After a win", matches: (trade) => trade.result === "win" },
    { key: "after-plan-break", label: "After a plan break", matches: (trade) => trade.followedPlan === false },
    { key: "after-fomo", label: "After FOMO", matches: (trade) => trade.fomo === true },
    { key: "after-revenge", label: "After revenge tag", matches: (trade) => trade.revenge === true },
    { key: "after-early-exit", label: "After early-exit tag", matches: (trade) => trade.earlyExit === true },
  ];

  return definitions.flatMap((definition) => {
    const matchingNext = nextTrades.filter((_, index) => definition.matches(sorted[index]));
    if (!matchingNext.length) return [];
    const otherNext = nextTrades.filter((_, index) => !definition.matches(sorted[index]));
    const summary = summarize(matchingNext, startingBalance);
    const matchingPositions = positionPairs.filter((pair) => definition.matches(pair.event)).map((pair) => pair.next);
    const otherPositions = positionPairs.filter((pair) => !definition.matches(pair.event)).map((pair) => pair.next);
    const nextPosition = matchingPositions.length ? summarize(matchingPositions, startingBalance) : null;
    return [{
      key: definition.key,
      label: definition.label,
      ...summary,
      comparison: otherNext.length ? summarize(otherNext, startingBalance) : null,
      sampleWarning: summary.sampleSize < MIN_SAMPLE_FOR_CONCLUSION,
      nextPosition,
      nextPositionComparison: otherPositions.length ? summarize(otherPositions, startingBalance) : null,
      nextPositionSampleWarning: nextPosition ? nextPosition.sampleSize < MIN_SAMPLE_FOR_CONCLUSION : false,
    }];
  });
}
