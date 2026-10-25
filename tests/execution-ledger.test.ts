import assert from "node:assert/strict";
import test from "node:test";
import { calculateExecutionLedger, type ExecutionFill } from "../src/lib/execution-ledger";

const at = (hour: number) => `2026-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`;

function fill(overrides: Partial<ExecutionFill> = {}): ExecutionFill {
  return {
    type: "entry",
    price: "100",
    quantity: "1",
    executedAt: at(10),
    fees: "0",
    ...overrides,
  };
}

const spec = {
  contractSize: "0",
  tickSize: "1",
  tickValue: "1",
  pipSize: "0",
  pipValue: "0",
};

test("scaled long trade reconciles blended prices, P&L, costs, risk, and time from out-of-order fills", () => {
  const executions = [
    fill({ type: "exit", price: "110", executedAt: at(13), fees: "1" }),
    fill({ price: "100", executedAt: at(10), fees: "1" }),
    fill({ type: "scale_out", price: "120", executedAt: at(12), fees: "1" }),
    fill({ type: "scale_in", price: "110", executedAt: at(11), fees: "1" }),
  ];
  const originalFirst = executions[0];
  const ledger = calculateExecutionLedger({
    direction: "long",
    status: "closed",
    executions,
    stopLoss: "95",
    commission: "2",
    ...spec,
  });

  assert.equal(executions[0], originalFirst, "caller input must not be reordered");
  assert.equal(ledger.entryPrice, "105.00000000");
  assert.equal(ledger.exitPrice, "115.00000000");
  assert.equal(ledger.positionSize, "2.000000");
  assert.equal(ledger.remainingQuantity, "0.000000");
  assert.equal(ledger.totalEntryQuantity, "2.000000");
  assert.equal(ledger.totalExitQuantity, "2.000000");
  assert.equal(ledger.metrics.grossPnl, "20.0000");
  assert.equal(ledger.metrics.netPnl, "14.0000");
  assert.equal(ledger.metrics.initialRisk, "20.0000");
  assert.equal(ledger.metrics.rMultiple, "0.7000");
  assert.equal(ledger.metrics.holdingMinutes, 180);
  assert.equal(ledger.entryAt.toISOString(), at(10));
  assert.equal(ledger.exitAt?.toISOString(), at(13));
  assert.deepEqual(ledger.executions.map((execution) => execution.type), ["entry", "scale_in", "scale_out", "exit"]);
});

test("partially closed short trade retains open quantity and realized P&L", () => {
  const ledger = calculateExecutionLedger({
    direction: "short",
    status: "open",
    executions: [
      fill({ price: "200", quantity: "2", executedAt: at(10) }),
      fill({ type: "scale_out", price: "180", quantity: "1", executedAt: at(11) }),
    ],
    stopLoss: "210",
    ...spec,
  });

  assert.equal(ledger.status, "open");
  assert.equal(ledger.remainingQuantity, "1.000000");
  assert.equal(ledger.positionSize, "1.000000");
  assert.equal(ledger.entryPrice, "200.00000000");
  assert.equal(ledger.exitPrice, "180.00000000");
  assert.equal(ledger.metrics.grossPnl, "20.0000");
  assert.equal(ledger.metrics.netPnl, "20.0000");
  assert.equal(ledger.metrics.initialRisk, "20.0000");
  assert.equal(ledger.metrics.rMultiple, "1.0000");
  assert.equal(ledger.metrics.holdingMinutes, null);
  assert.equal(ledger.exitAt, null);
  assert.equal(ledger.realizedAt?.toISOString(), at(11));
});

test("weighted-average cost remains correct across a partial exit and later scale-in", () => {
  const ledger = calculateExecutionLedger({
    direction: "long",
    status: "closed",
    executions: [
      fill({ price: "100", quantity: "1", executedAt: at(10) }),
      fill({ type: "scale_out", price: "110", quantity: "0.5", executedAt: at(11) }),
      fill({ type: "scale_in", price: "200", quantity: "1", executedAt: at(12) }),
      fill({ type: "exit", price: "190", quantity: "1.5", executedAt: at(13) }),
    ],
    ...spec,
  });

  assert.equal(ledger.entryPrice, "150.00000000");
  assert.equal(ledger.exitPrice, "170.00000000");
  assert.equal(ledger.metrics.grossPnl, "40.0000");
  assert.equal(ledger.metrics.netPnl, "40.0000");
});

test("manual net override is preserved for broker reconciliation", () => {
  const ledger = calculateExecutionLedger({
    direction: "long",
    status: "closed",
    executions: [
      fill({ price: "100", fees: "1" }),
      fill({ type: "exit", price: "110", executedAt: at(11) }),
    ],
    commission: "1",
    overrideNetPnl: "9.5",
    ...spec,
  });

  assert.equal(ledger.metrics.grossPnl, "10.0000");
  assert.equal(ledger.metrics.netPnl, "9.5000");
});

test("execution lifecycle rejects over-exits, early exits, reopening, and status mismatches", () => {
  const base = { direction: "long" as const, ...spec };
  assert.throws(
    () => calculateExecutionLedger({
      ...base,
      status: "closed",
      executions: [fill(), fill({ type: "exit", quantity: "2", executedAt: at(11) })],
    }),
    /exceeds the open quantity/,
  );
  assert.throws(
    () => calculateExecutionLedger({
      ...base,
      status: "open",
      executions: [fill({ type: "scale_out" })],
    }),
    /before any entry/,
  );
  assert.throws(
    () => calculateExecutionLedger({
      ...base,
      status: "closed",
      executions: [
        fill(),
        fill({ type: "exit", executedAt: at(11) }),
        fill({ type: "entry", executedAt: at(12) }),
      ],
    }),
    /reopens a flat trade/,
  );
  assert.throws(
    () => calculateExecutionLedger({
      ...base,
      status: "closed",
      executions: [fill({ quantity: "2" }), fill({ type: "exit", quantity: "1", executedAt: at(11) })],
    }),
    /leave 1\.000000 open/,
  );
  assert.throws(
    () => calculateExecutionLedger({
      ...base,
      status: "open",
      executions: [fill(), fill({ type: "exit", executedAt: at(11) })],
    }),
    /fully close this trade/,
  );
});

test("execution normalization rejects invalid dates and quantities rounded to zero", () => {
  assert.throws(
    () => calculateExecutionLedger({
      direction: "long",
      status: "open",
      executions: [fill({ executedAt: "not-a-date" })],
      ...spec,
    }),
    /invalid date\/time/,
  );
  assert.throws(
    () => calculateExecutionLedger({
      direction: "long",
      status: "open",
      executions: [fill({ quantity: "0.0000004" })],
      ...spec,
    }),
    /quantity must be greater than zero/,
  );
});
