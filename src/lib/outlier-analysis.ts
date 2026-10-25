import Decimal from "decimal.js";
import { computePerformanceStats, realizationDate, type ClosedTradeStatsInput } from "@/lib/calculations";

export type OutlierTrade = ClosedTradeStatsInput & {
  id: string;
  displayId: string;
  instrument: string;
};

export type OutlierSide = {
  id: string;
  displayId: string;
  instrument: string;
  netPnl: string;
  share: number | null;
};

export type SensitivitySummary = {
  totalTrades: number;
  netPnl: string;
  expectancyR: number | null;
  profitFactor: number | null;
};

function sensitivity(trades: OutlierTrade[], startingBalance: string): SensitivitySummary {
  const stats = computePerformanceStats(trades, startingBalance);
  return {
    totalTrades: stats.totalTrades,
    netPnl: stats.netPnl,
    expectancyR: stats.expectancyR,
    profitFactor: stats.profitFactor,
  };
}

function side(trade: OutlierTrade, share: number | null): OutlierSide {
  return {
    id: trade.id,
    displayId: trade.displayId,
    instrument: trade.instrument,
    netPnl: new Decimal(trade.netPnl).toFixed(4),
    share,
  };
}

function shareOf(value: Decimal, total: string) {
  const denominator = new Decimal(total);
  return denominator.gt(0) ? Number(value.div(denominator).toFixed(6)) : null;
}

/** Descriptive leave-one-out sensitivity; it does not imply that an outlier caused the result. */
export function buildOutlierDependence(trades: OutlierTrade[], startingBalance = "0") {
  const closed = trades.filter((trade) => !trade.status || trade.status === "closed");
  if (!closed.length) return { best: null, worst: null, withoutBest: null, withoutWorst: null };
  const stats = computePerformanceStats(closed, startingBalance);
  const byNetDesc = [...closed].sort((a, b) =>
    new Decimal(b.netPnl).comparedTo(new Decimal(a.netPnl)) ||
    realizationDate(a).getTime() - realizationDate(b).getTime() ||
    a.id.localeCompare(b.id),
  );
  const best = byNetDesc[0];
  const worst = byNetDesc[byNetDesc.length - 1];
  const bestShare = new Decimal(best.netPnl).gt(0) ? shareOf(new Decimal(best.netPnl), stats.grossProfit) : null;
  const worstShare = new Decimal(worst.netPnl).lt(0) ? shareOf(new Decimal(worst.netPnl).abs(), new Decimal(stats.grossLoss).abs().toFixed(4)) : null;
  return {
    best: side(best, bestShare),
    worst: side(worst, worstShare),
    withoutBest: sensitivity(closed.filter((trade) => trade.id !== best.id), startingBalance),
    withoutWorst: sensitivity(closed.filter((trade) => trade.id !== worst.id), startingBalance),
  };
}
