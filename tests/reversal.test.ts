import assert from "node:assert/strict";
import test from "node:test";
import { calculateReversal } from "../src/lib/reversal";
import type { ExecutionLedgerInput } from "../src/lib/execution-ledger";

const at = (hour: number) => `2026-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`;
const spec = {
  contractSize: "0",
  tickSize: "1",
  tickValue: "1",
  pipSize: "0",
  pipValue: "0",
};

function openLong(): ExecutionLedgerInput {
  return {
    direction: "long",
    status: "open",
    executions: [
      { type: "entry", price: "100", quantity: "2", executedAt: at(10) },
      { type: "scale_out", price: "110", quantity: "1", executedAt: at(11) },
    ],
    stopLoss: "90",
    takeProfit: "130",
    ...spec,
  };
}

test("reversal closes only the original remainder and opens an independent short ledger", () => {
  const input = openLong();
  const result = calculateReversal(input, {
    executedAt: at(12),
    closePrice: "120",
    entryPrice: "121",
    quantity: "3",
    closeFees: "1",
    entryFees: "2",
    stopLoss: "130",
    takeProfit: "100",
  });

  assert.equal(result.current.remainingQuantity, "1.000000");
  assert.equal(result.closed.status, "closed");
  assert.equal(result.closed.remainingQuantity, "0.000000");
  assert.equal(result.closed.metrics.grossPnl, "30.0000");
  assert.equal(result.closed.metrics.netPnl, "29.0000");
  assert.equal(result.closed.exitPrice, "115.00000000");
  assert.equal(result.closeExecution.quantity, "1.000000");
  assert.equal(result.closeExecution.fees, "1.0000");
  assert.equal(result.opened.status, "open");
  assert.equal(result.opened.remainingQuantity, "3.000000");
  assert.equal(result.opened.entryPrice, "121.00000000");
  assert.equal(result.opened.metrics.grossPnl, "0.0000");
  assert.equal(result.opened.metrics.netPnl, "-2.0000");
  assert.equal(result.opened.metrics.initialRisk, "27.0000");
  assert.equal(result.opened.metrics.plannedRr, "2.3333");
  assert.equal(result.entryExecution.quantity, "3.000000");
  assert.equal(result.entryExecution.fees, "2.0000");
  assert.equal(input.executions.length, 2, "caller fills are not mutated");
});

test("short-to-long reversal preserves direction-aware realized P&L", () => {
  const result = calculateReversal({
    direction: "short",
    status: "open",
    executions: [{ type: "entry", price: "200", quantity: "2", executedAt: at(10) }],
    stopLoss: "210",
    ...spec,
  }, {
    executedAt: at(11),
    closePrice: "180",
    entryPrice: "181",
    quantity: "1",
  });
  assert.equal(result.closed.metrics.grossPnl, "40.0000");
  assert.equal(result.closed.metrics.netPnl, "40.0000");
  assert.equal(result.opened.entryPrice, "181.00000000");
  assert.equal(result.opened.remainingQuantity, "1.000000");
});

test("reversal requires a later timestamp and rejects closed positions", () => {
  assert.throws(() => calculateReversal(openLong(), {
    executedAt: at(11),
    closePrice: "110",
    entryPrice: "111",
    quantity: "1",
  }), /later than the trade's last execution/);
  assert.throws(() => calculateReversal(openLong(), {
    executedAt: at(10),
    closePrice: "110",
    entryPrice: "111",
    quantity: "1",
  }), /later than the trade's last execution/);
  assert.throws(() => calculateReversal({
    direction: "long",
    status: "closed",
    executions: [
      { type: "entry", price: "100", quantity: "1", executedAt: at(10) },
      { type: "exit", price: "110", quantity: "1", executedAt: at(11) },
    ],
    ...spec,
  }, { executedAt: at(12), closePrice: "120", entryPrice: "121", quantity: "1" }), /Only an open execution-led trade/);
});

test("manual net override stays on the original and is not copied to the new trade", () => {
  const result = calculateReversal({ ...openLong(), overrideNetPnl: "7" }, {
    executedAt: at(12),
    closePrice: "120",
    entryPrice: "121",
    quantity: "1",
    entryFees: "2",
  });
  assert.equal(result.closed.metrics.netPnl, "7.0000");
  assert.equal(result.opened.metrics.netPnl, "-2.0000");
});
