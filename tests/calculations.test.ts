import assert from "node:assert/strict";
import test from "node:test";
import Decimal from "decimal.js";
import {
  computePerformanceStats,
  computeTradeMetrics,
  equitySeries,
  verifyCalculationInvariants,
  type ClosedTradeStatsInput,
} from "../src/lib/calculations";

function row(overrides: Partial<ClosedTradeStatsInput> = {}): ClosedTradeStatsInput {
  return {
    netPnl: "0",
    grossPnl: "0",
    rMultiple: "0",
    result: "be",
    status: "closed",
    entryAt: new Date("2026-01-01T00:00:00Z"),
    exitAt: new Date("2026-01-01T01:00:00Z"),
    ...overrides,
  };
}

test("built-in trading calculation invariants pass", () => {
  assert.deepEqual(verifyCalculationInvariants(), { ok: true, failures: [] });
});

test("long trade computes gross, costs, risk, R, and holding time", () => {
  const result = computeTradeMetrics({
    direction: "long",
    entryPrice: "1.1000",
    exitPrice: "1.1050",
    stopLoss: "1.0975",
    takeProfit: "1.1050",
    positionSize: "2",
    pipSize: "0.0001",
    pipValue: "10",
    tickSize: "0",
    tickValue: "0",
    commission: "7",
    swap: "1",
    slippage: "2",
    entryAt: new Date("2026-01-01T10:00:00Z"),
    exitAt: new Date("2026-01-01T11:30:00Z"),
  });
  assert.equal(result.grossPnl, "1000.0000");
  assert.equal(result.netPnl, "990.0000");
  assert.equal(result.initialRisk, "500.0000");
  assert.equal(result.plannedRr, "2.0000");
  assert.equal(result.rMultiple, "1.9800");
  assert.equal(result.holdingMinutes, 90);
  assert.equal(result.result, "win");
});

test("AUDCHF short statement example stays a win with an NGN-denominated pip value", () => {
  const chfNgn = new Decimal("1656.589743589743589743589743589");
  const chfPerPipPerLot = new Decimal("100000").mul("0.0001");
  const pipValue = chfPerPipPerLot.mul(chfNgn);
  const quoteGross = new Decimal("0.58423").minus("0.58384").div("0.0001").mul(chfPerPipPerLot).mul("0.01");
  assert.equal(quoteGross.toFixed(4), "0.3900");
  assert.equal(quoteGross.mul(chfNgn).toFixed(4), "646.0700");

  const input = {
    direction: "short" as const,
    entryPrice: "0.58423",
    exitPrice: "0.58384",
    stopLoss: "0.58467",
    takeProfit: "0.58359",
    positionSize: "0.01",
    lotSize: "0.01",
    contractSize: "100000",
    tickSize: "0",
    tickValue: "0",
    pipSize: "0.0001",
    // 10 CHF per pip per lot × statement-equivalent CHF/NGN conversion.
    pipValue: pipValue.toString(),
    commission: "0",
    swap: "0",
    slippage: "0",
    entryAt: new Date("2026-10-28T09:04:06Z"),
    exitAt: new Date("2026-10-28T09:42:43Z"),
  };
  const result = computeTradeMetrics(input);
  const conflictingTickResult = computeTradeMetrics({ ...input, tickSize: "0.00001", tickValue: "1" });
  assert.equal(result.grossPnl, "646.0700");
  // Starting capital is irrelevant; a non-zero tick method takes priority over pips.
  assert.equal(conflictingTickResult.grossPnl, "0.3900");
  assert.equal(result.netPnl, "646.0700");
  assert.equal(result.initialRisk, "728.8995");
  assert.equal(result.plannedRr, "1.4545");
  assert.equal(result.rMultiple, "0.8864");
  assert.equal(result.result, "win");
  assert.equal(result.holdingMinutes, 39);
});

test("open trades do not dilute realized statistics or the equity curve", () => {
  const closedWin = row({ netPnl: "100", grossPnl: "100", result: "win", rMultiple: "1" });
  const open = row({
    netPnl: "0",
    result: "be",
    status: "open",
    entryAt: new Date("2026-01-02T00:00:00Z"),
    exitAt: null,
  });
  const stats = computePerformanceStats([closedWin, open], "1000");
  assert.equal(stats.totalTrades, 1);
  assert.equal(stats.winRate, 1);
  assert.equal(stats.breakEvenTrades, 0);
  assert.equal(stats.netPnl, "100.0000");
  assert.equal(equitySeries([closedWin, open], "1000").length, 1);
});

test("drawdown percent uses the peak at the historical drawdown, not a later peak", () => {
  const stats = computePerformanceStats(
    [
      row({ netPnl: "100", result: "win", exitAt: new Date("2026-01-01T01:00:00Z") }),
      row({ netPnl: "-550", result: "loss", exitAt: new Date("2026-01-02T01:00:00Z") }),
      row({ netPnl: "1000", result: "win", exitAt: new Date("2026-01-03T01:00:00Z") }),
    ],
    "1000",
  );
  assert.equal(stats.maxDrawdown, "550.0000");
  assert.equal(stats.maxDrawdownPercent, 50);
});

test("currency and percentage maximum drawdowns are tracked independently", () => {
  const stats = computePerformanceStats(
    [
      row({ netPnl: "-50", result: "loss", exitAt: new Date("2026-01-01T01:00:00Z") }),
      row({ netPnl: "150", result: "win", exitAt: new Date("2026-01-02T01:00:00Z") }),
      row({ netPnl: "-70", result: "loss", exitAt: new Date("2026-01-03T01:00:00Z") }),
    ],
    "100",
  );
  assert.equal(stats.maxDrawdown, "70.0000");
  assert.equal(stats.maxDrawdownPercent, 50);
});

test("expectancy R uses one R-known population and reports its coverage", () => {
  const stats = computePerformanceStats([
    row({ netPnl: "100", result: "win", rMultiple: "2" }),
    row({ netPnl: "50", result: "win", rMultiple: null }),
    row({ netPnl: "-25", result: "loss", rMultiple: "-1" }),
    row({ netPnl: "0", result: "be", rMultiple: null }),
  ]);
  assert.equal(stats.rSampleSize, 2);
  assert.equal(stats.rMissing, 2);
  assert.equal(stats.averageRr, 0.5);
  assert.equal(stats.expectancyR, 0.5);

  const winsOnly = computePerformanceStats([
    row({ netPnl: "100", result: "win", rMultiple: "2" }),
    row({ netPnl: "200", result: "win", rMultiple: "4" }),
  ]);
  assert.equal(winsOnly.expectancyR, 3);
  assert.equal(winsOnly.rMissing, 0);
});

test("profit factor includes non-zero money classified as break-even", () => {
  const stats = computePerformanceStats([
    row({ netPnl: "100", result: "win" }),
    row({ netPnl: "-50", result: "loss" }),
    row({ netPnl: "0.005", result: "be" }),
  ]);
  assert.equal(stats.breakEvenTrades, 1);
  assert.equal(stats.grossProfit, "100.0050");
  assert.equal(stats.grossLoss, "-50.0000");
  assert.equal(stats.profitFactor, 2.0001);
  assert.equal(stats.averageWin, "100.0000");
});

test("equitySeries does not mutate the caller's trade order", () => {
  const trades = [
    row({ netPnl: "20", exitAt: new Date("2026-01-03T00:00:00Z") }),
    row({ netPnl: "10", exitAt: new Date("2026-01-01T00:00:00Z") }),
  ];
  const originalFirst = trades[0];
  equitySeries(trades, "100");
  assert.equal(trades[0], originalFirst);
});
