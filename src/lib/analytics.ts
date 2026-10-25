import { MIN_SAMPLE_FOR_CONCLUSION } from "./constants";
import { computePerformanceStats, equitySeries, type ClosedTradeStatsInput, type PerformanceStats } from "./calculations";

export type TradeRow = ClosedTradeStatsInput & {
  id: string;
  displayId: string;
  instrument: string;
  strategyId: string | null;
  strategyName?: string | null;
  session: string;
  direction: string;
  tradeType: string;
  entryTimeframe: string;
  followedPlan: boolean;
  newsRelated: boolean;
  notes: string;
  emotionBefore?: string;
  emotionAfter?: string;
  fomo?: boolean;
  revenge?: boolean;
  earlyExit?: boolean;
  movedStop?: boolean;
  brokeRiskRules?: boolean;
  impulsive?: boolean;
  weekday?: number;
  hour?: number;
};

export type BreakdownRow = {
  key: string;
  label: string;
  stats: PerformanceStats;
  sampleWarning: boolean;
};

function group(trades: TradeRow[], keyFn: (t: TradeRow) => string, startingBalance: string): BreakdownRow[] {
  const map = new Map<string, TradeRow[]>();
  for (const t of trades) {
    const k = keyFn(t) || "Unspecified";
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      const stats = computePerformanceStats(list, startingBalance);
      return { key, label: key, stats, sampleWarning: list.length < MIN_SAMPLE_FOR_CONCLUSION };
    })
    .sort((a, b) => Number(b.stats.netPnl) - Number(a.stats.netPnl));
}

export function weekdayName(d: Date) {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
}

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type Insight = {
  title: string;
  body: string;
  severity: "info" | "warn" | "good";
};

export function buildInsights(trades: TradeRow[], stats: PerformanceStats): Insight[] {
  const insights: Insight[] = [];
  if (!trades.length) {
    insights.push({
      title: "No trades yet",
      body: "Record live trades to generate expectancy, drawdown, and psychology insights. Demo mode is available if you want to explore the interface first.",
      severity: "info",
    });
    return insights;
  }
  if (stats.sampleWarning) {
    insights.push({
      title: "Small sample size",
      body: `These statistics are based on ${stats.totalTrades} trades. Treat patterns as hypotheses until you have at least ${MIN_SAMPLE_FOR_CONCLUSION} closed trades.`,
      severity: "warn",
    });
  }
  if (stats.profitFactor !== null && stats.profitFactor < 1) {
    insights.push({
      title: "Profit factor below 1",
      body: "Gross losses exceed gross profits over this sample. This is a descriptive statistic, not a forecast.",
      severity: "warn",
    });
  } else if (stats.profitFactor !== null && stats.profitFactor >= 1.5) {
    insights.push({
      title: "Profit factor is constructive",
      body: `Profit factor is ${stats.profitFactor.toFixed(2)} on this sample. Keep risk constant and avoid increasing size solely because of a hot streak.`,
      severity: "good",
    });
  }

  const planBreaks = trades.filter((t) => t.followedPlan === false);
  if (planBreaks.length >= 3) {
    const broken = computePerformanceStats(planBreaks);
    const followed = computePerformanceStats(trades.filter((t) => t.followedPlan));
    insights.push({
      title: "Plan adherence vs. outcome",
      body: `Trades that broke the plan (n=${planBreaks.length}) averaged ${broken.expectancyCurrency ?? "n/a"} vs ${followed.expectancyCurrency ?? "n/a"} when the plan was followed. This is a correlation in your journal, not proof of causation.`,
      severity: "warn",
    });
  }

  const revenge = trades.filter((t) => t.revenge);
  if (revenge.length >= 2) {
    const r = computePerformanceStats(revenge);
    insights.push({
      title: "Revenge trading cluster",
      body: `${revenge.length} trades were tagged as revenge. Net P&L on those trades: ${r.netPnl}. Consider a hard stop after a loss rather than immediately re-entering.`,
      severity: "warn",
    });
  }

  const early = trades.filter((t) => t.earlyExit);
  if (early.length >= 3) {
    const e = computePerformanceStats(early);
    insights.push({
      title: "Early exits",
      body: `Early-exit trades (n=${early.length}) show average R of ${e.averageRr ?? "n/a"}. If winners are cut short, realized R can lag planned R even when the read is correct.`,
      severity: "info",
    });
  }

  const sorted = [...trades].sort((a, b) => (a.exitAt ?? a.entryAt).getTime() - (b.exitAt ?? b.entryAt).getTime());
  let afterLoss = 0;
  let afterLossPnl = 0;
  let afterWin = 0;
  let afterWinPnl = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const pnl = Number(cur.netPnl);
    if (prev.result === "loss") {
      afterLoss += 1;
      afterLossPnl += pnl;
    }
    if (prev.result === "win") {
      afterWin += 1;
      afterWinPnl += pnl;
    }
  }
  if (afterLoss >= 5) {
    insights.push({
      title: "Performance after a loss",
      body: `The next trade after a loss (n=${afterLoss}) averaged ${(afterLossPnl / afterLoss).toFixed(2)} vs ${(afterWin / Math.max(afterWin, 1) ? afterWinPnl / Math.max(afterWin, 1) : 0).toFixed(2)} after a win. Correlation only — review whether size or rules change after red trades.`,
      severity: "info",
    });
  }

  return insights.slice(0, 8);
}

export function buildAnalytics(trades: TradeRow[], startingBalance: string) {
  // Open trades have no realized outcome and must not dilute win rate, expectancy, or drawdown.
  trades = trades.filter((t) => !t.status || t.status === "closed");
  const stats = computePerformanceStats(trades, startingBalance);
  const equity = equitySeries(trades, startingBalance);
  const byInstrument = group(trades, (t) => t.instrument, startingBalance);
  const byStrategy = group(trades, (t) => t.strategyName || "Unlinked", startingBalance);
  const bySession = group(trades, (t) => t.session, startingBalance);
  const byDirection = group(trades, (t) => t.direction, startingBalance);
  const byWeekday = group(trades, (t) => weekdayName(t.exitAt ?? t.entryAt), startingBalance);
  const byMonth = group(trades, (t) => monthKey(t.exitAt ?? t.entryAt), startingBalance);
  const byTimeframe = group(trades, (t) => t.entryTimeframe, startingBalance);
  const byEmotion = group(trades, (t) => t.emotionBefore || "Unspecified", startingBalance);
  const byPlan = group(trades, (t) => (t.followedPlan ? "Followed plan" : "Broke plan"), startingBalance);
  const byNews = group(trades, (t) => (t.newsRelated ? "News-related" : "No news tag"), startingBalance);

  const dailyMap = new Map<string, { pnl: number; trades: number; wins: number; r: number }>();
  for (const t of trades) {
    const day = (t.exitAt ?? t.entryAt).toISOString().slice(0, 10);
    const cur = dailyMap.get(day) ?? { pnl: 0, trades: 0, wins: 0, r: 0 };
    cur.pnl += Number(t.netPnl);
    cur.trades += 1;
    if (t.result === "win") cur.wins += 1;
    cur.r += Number(t.rMultiple || 0);
    dailyMap.set(day, cur);
  }
  const daily = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v, winRate: v.trades ? v.wins / v.trades : 0 }));

  const mistakes: { label: string; count: number; netPnl: number }[] = [
    { label: "FOMO", count: 0, netPnl: 0 },
    { label: "Revenge", count: 0, netPnl: 0 },
    { label: "Early exit", count: 0, netPnl: 0 },
    { label: "Moved stop", count: 0, netPnl: 0 },
    { label: "Broke risk rules", count: 0, netPnl: 0 },
    { label: "Impulsive", count: 0, netPnl: 0 },
  ];
  for (const t of trades) {
    const add = (label: string) => {
      const row = mistakes.find((m) => m.label === label);
      if (row) {
        row.count += 1;
        row.netPnl += Number(t.netPnl);
      }
    };
    if (t.fomo) add("FOMO");
    if (t.revenge) add("Revenge");
    if (t.earlyExit) add("Early exit");
    if (t.movedStop) add("Moved stop");
    if (t.brokeRiskRules) add("Broke risk rules");
    if (t.impulsive) add("Impulsive");
  }

  const best = [...trades].sort((a, b) => Number(b.netPnl) - Number(a.netPnl)).slice(0, 5);
  const worst = [...trades].sort((a, b) => Number(a.netPnl) - Number(b.netPnl)).slice(0, 5);
  const insights = buildInsights(trades, stats);

  return {
    stats,
    equity,
    daily,
    byInstrument,
    byStrategy,
    bySession,
    byDirection,
    byWeekday,
    byMonth,
    byTimeframe,
    byEmotion,
    byPlan,
    byNews,
    mistakes: mistakes.filter((m) => m.count > 0).sort((a, b) => a.netPnl - b.netPnl),
    best,
    worst,
    insights,
  };
}

export function ruleBasedCoach(params: {
  question?: string;
  stats: PerformanceStats;
  insights: Insight[];
  byInstrument: BreakdownRow[];
  bySession: BreakdownRow[];
  byStrategy: BreakdownRow[];
  mistakes: { label: string; count: number; netPnl: number }[];
  sampleSize: number;
  dateFrom?: string | null;
  dateTo?: string | null;
}): string {
  const { stats, insights, byInstrument, bySession, byStrategy, mistakes, sampleSize, dateFrom, dateTo, question } =
    params;
  const lines: string[] = [];
  lines.push(`TradeMind Coach — rule-based review (not a live-market signal).`);
  lines.push(`Sample: ${sampleSize} closed trades${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}.`);
  lines.push(`Facts: net P&L ${stats.netPnl}, win rate ${stats.winRate === null ? "n/a" : (stats.winRate * 100).toFixed(1) + "%"}, profit factor ${stats.profitFactor ?? "undefined (no losses)"}, expectancy ${stats.expectancyR ?? "n/a"}R, max drawdown ${stats.maxDrawdown}.`);
  lines.push("");
  if (sampleSize < MIN_SAMPLE_FOR_CONCLUSION) {
    lines.push(`Hypothesis caution: sample size ${sampleSize} is below ${MIN_SAMPLE_FOR_CONCLUSION}. Do not treat any pattern as a durable edge.`);
  }
  for (const i of insights) lines.push(`• ${i.title}: ${i.body}`);
  if (byInstrument[0]) {
    lines.push(
      `Instrument with highest net P&L in-sample: ${byInstrument[0].label} (n=${byInstrument[0].stats.totalTrades}, net ${byInstrument[0].stats.netPnl}). This is not a recommendation to concentrate risk.`,
    );
  }
  const worstInst = [...byInstrument].sort((a, b) => Number(a.stats.netPnl) - Number(b.stats.netPnl))[0];
  if (worstInst && Number(worstInst.stats.netPnl) < 0) {
    lines.push(
      `Instrument with weakest net P&L: ${worstInst.label} (n=${worstInst.stats.totalTrades}, net ${worstInst.stats.netPnl}). Review process quality before changing the playbook.`,
    );
  }
  if (bySession[0]) {
    lines.push(`Best session by net P&L: ${bySession[0].label} (n=${bySession[0].stats.totalTrades}).`);
  }
  if (byStrategy[0]) {
    lines.push(`Best tagged strategy by net P&L: ${byStrategy[0].label} (n=${byStrategy[0].stats.totalTrades}).`);
  }
  if (mistakes[0]) {
    lines.push(
      `Costliest tagged mistake: ${mistakes[0].label} (n=${mistakes[0].count}, net ${mistakes[0].netPnl.toFixed(2)}).`,
    );
  }
  lines.push("");
  lines.push("Improvement focus for the next 20 trades:");
  lines.push("1. Keep risk per idea constant; never average down or martingale.");
  lines.push("2. Pre-commit stop, target, and invalidation in the journal before entry.");
  lines.push("3. Stop trading for the day after max daily loss or consecutive-loss limit.");
  lines.push("4. Separate process grade from P&L — a green trade that broke rules is still a process fail.");
  if (question) {
    lines.push("");
    lines.push(`Your question: ${question}`);
    const q = question.toLowerCase();
    if (q.includes("us30") || q.includes("nas") || q.includes("gold") || q.includes("xau") || q.includes("eur")) {
      const inst = byInstrument.find((i) => q.includes(i.label.toLowerCase()));
      if (inst) {
        lines.push(
          `In this journal, ${inst.label} has n=${inst.stats.totalTrades}, win rate ${inst.stats.winRate === null ? "n/a" : (inst.stats.winRate * 100).toFixed(1) + "%"}, net ${inst.stats.netPnl}. Insufficient data is still possible.`,
        );
      } else {
        lines.push("No matching instrument label was found in this sample. I will not invent trades.");
      }
    }
    if (q.includes("london") || q.includes("new york") || q.includes("asian") || q.includes("session")) {
      lines.push(
        `Session breakdown is computed from your tags. Best net session: ${bySession[0]?.label ?? "n/a"}. This is not a prediction of future session edge.`,
      );
    }
    if (q.includes("stop")) {
      const moved = mistakes.find((m) => m.label === "Moved stop");
      lines.push(
        moved
          ? `You tagged ${moved.count} trades as moved stop, net ${moved.netPnl.toFixed(2)}.`
          : "No trades in this sample are tagged as moved stop.",
      );
    }
  }
  lines.push("");
  lines.push("This review cannot predict markets, promise profitability, or replace a risk plan.");
  return lines.join("\n");
}
