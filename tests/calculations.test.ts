import assert from "node:assert/strict";
import test from "node:test";
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

test("equitySeries does not mutate the caller's trade order", () => {
  const trades = [
    row({ netPnl: "20", exitAt: new Date("2026-01-03T00:00:00Z") }),
    row({ netPnl: "10", exitAt: new Date("2026-01-01T00:00:00Z") }),
  ];
  const originalFirst = trades[0];
  equitySeries(trades, "100");
  assert.equal(trades[0], originalFirst);
});
