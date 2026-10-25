import assert from "node:assert/strict";
import test from "node:test";
import { calculateExecutionLedger, type ExecutionLedgerInput } from "../src/lib/execution-ledger";
import { buildExecutionReview } from "../src/lib/execution-review";

function input(overrides: Partial<ExecutionLedgerInput> = {}): ExecutionLedgerInput {
  return {
    direction: "long",
    status: "closed",
    contractSize: "1",
    tickSize: "0",
    tickValue: "0",
    pipSize: "0",
    pipValue: "0",
    commission: "0",
    swap: "0",
    slippage: "0",
    executions: [],
    ...overrides,
  };
}

test("execution review reconciles scaled fills, running realized P&L, and final ledger net", () => {
  const payload = input({
    commission: "1",
    takeProfit: "130",
    executions: [
      { type: "exit", price: "90", quantity: "2", executedAt: "2026-10-22T14:20:00Z", fees: "0.5" },
      { type: "entry", price: "100", quantity: "2", executedAt: "2026-10-22T14:00:00Z", fees: "1" },
      { type: "scale_out", price: "120", quantity: "1", executedAt: "2026-10-22T14:10:00Z", fees: "0.5" },
      { type: "scale_in", price: "110", quantity: "1", executedAt: "2026-10-22T14:03:00Z", fees: "0" },
    ],
  });
  const review = buildExecutionReview(payload);
  const ledger = calculateExecutionLedger(payload);
  assert.deepEqual(review.points.map((point) => point.netPnl), ["-1.0000", "-1.0000", "15.1667", "-13.0000"]);
  assert.equal(review.points.at(-1)?.openQuantity, "0.000000");
  assert.equal(review.finalNetPnl, ledger.metrics.netPnl);
  assert.equal(review.finalGrossPnl, ledger.metrics.grossPnl);
  assert.equal(review.targetAttainment, "-0.125000");
  assert.equal(review.observedMfe?.money, "50.0000");
  assert.equal(review.observedMae?.money, "26.6667");
  assert.equal(review.bestExitEfficiency, null);
});

test("short execution excursions and target attainment preserve direction", () => {
  const review = buildExecutionReview(input({
    direction: "short",
    stopLoss: "110",
    takeProfit: "80",
    executions: [
      { type: "entry", price: "100", quantity: "1", executedAt: "2026-10-22T14:00:00Z" },
      { type: "exit", price: "90", quantity: "1", executedAt: "2026-10-22T14:20:00Z" },
    ],
  }));
  assert.equal(review.finalNetPnl, "10.0000");
  assert.equal(review.targetAttainment, "0.500000");
  assert.equal(review.observedMfe?.money, "10.0000");
  assert.equal(review.observedMfe?.r, "1.0000");
  assert.equal(review.observedMae?.money, "0.0000");
});

test("open partial executions keep unrealized P&L out of the series and honor manual net override", () => {
  const review = buildExecutionReview(input({
    status: "open",
    overrideNetPnl: "7",
    takeProfit: "110",
    executions: [
      { type: "entry", price: "100", quantity: "2", executedAt: "2026-10-22T14:00:00Z", fees: "0.5" },
      { type: "scale_out", price: "105", quantity: "1", executedAt: "2026-10-22T14:10:00Z", fees: "0.5" },
    ],
  }));
  assert.equal(review.points[0].netPnl, "-0.5000");
  assert.equal(review.points[1].netPnl, "7.0000");
  assert.equal(review.points[1].openQuantity, "1.000000");
  assert.equal(review.points[1].grossPnl, "5.0000");
  assert.equal(review.finalNetPnl, "7.0000");
  assert.equal(review.targetAttainment, "0.500000");
});
