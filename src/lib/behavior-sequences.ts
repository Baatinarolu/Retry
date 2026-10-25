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

/** Compares the next closed trade after a tagged event with next trades after other events. */
export function buildBehaviorSequences(trades: BehaviorTrade[], startingBalance = "0"): BehaviorSequence[] {
  const sorted = trades
    .filter((trade) => !trade.status || trade.status === "closed")
    .sort((a, b) => realizationDate(a).getTime() - realizationDate(b).getTime() || a.id.localeCompare(b.id));
  if (sorted.length < 2) return [];
  const nextTrades = sorted.slice(1);
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
    return [{
      key: definition.key,
      label: definition.label,
      ...summary,
      comparison: otherNext.length ? summarize(otherNext, startingBalance) : null,
      sampleWarning: summary.sampleSize < MIN_SAMPLE_FOR_CONCLUSION,
    }];
  });
}
