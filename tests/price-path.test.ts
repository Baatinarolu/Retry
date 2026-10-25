import assert from "node:assert/strict";
import test from "node:test";
import { buildExecutionReview } from "../src/lib/execution-review";
import type { ExecutionLedgerInput } from "../src/lib/execution-ledger";
import { normalizePricePath, parsePricePathDraft, serializePricePath } from "../src/lib/price-path";

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
    stopLoss: "90",
    executions: [
      { type: "entry", price: "100", quantity: "1", executedAt: "2026-10-22T14:00:00Z" },
      { type: "exit", price: "110", quantity: "1", executedAt: "2026-10-22T14:20:00Z" },
    ],
    ...overrides,
  };
}

test("recorded price paths calculate separate market excursions and best recorded gross exit", () => {
  const review = buildExecutionReview(input(), [
    { observedAt: "2026-10-22T14:00:00Z", price: "100" },
    { observedAt: "2026-10-22T14:05:00Z", price: "95" },
    { observedAt: "2026-10-22T14:10:00Z", price: "120" },
    { observedAt: "2026-10-22T14:15:00Z", price: "105" },
    { observedAt: "2026-10-22T14:20:00Z", price: "110" },
  ]);
  assert.equal(review.pricePathPoints, 5);
  assert.equal(review.marketMae?.money, "5.0000");
  assert.equal(review.marketMae?.r, "0.5000");
  assert.equal(review.marketMfe?.money, "20.0000");
  assert.equal(review.marketMfe?.r, "2.0000");
  assert.equal(review.bestExitGrossPnl, "20.0000");
  assert.equal(review.bestExitPrice, "120.00000000");
  assert.equal(review.bestExitAt, "2026-10-22T14:10:00.000Z");
  assert.equal(review.bestExitEfficiency, "0.500000");
  assert.equal(review.observedMfe?.money, "10.0000");
  assert.equal(review.observedMae?.money, "0.0000");
});

test("exit-timestamp observations value the position before same-time reductions", () => {
  const review = buildExecutionReview(input(), [
    { observedAt: "2026-10-22T14:00:00Z", price: "100" },
    { observedAt: "2026-10-22T14:20:00Z", price: "110" },
  ]);
  assert.equal(review.marketMfe?.money, "10.0000");
  assert.equal(review.bestExitGrossPnl, "10.0000");
  assert.equal(review.bestExitEfficiency, "1.000000");
});

test("short paths preserve direction and open trades do not get a final-exit counterfactual", () => {
  const short = buildExecutionReview(input({
    direction: "short",
    stopLoss: "110",
    executions: [
      { type: "entry", price: "100", quantity: "1", executedAt: "2026-10-22T14:00:00Z" },
      { type: "exit", price: "95", quantity: "1", executedAt: "2026-10-22T14:20:00Z" },
    ],
  }), [
    { observedAt: "2026-10-22T14:05:00Z", price: "105" },
    { observedAt: "2026-10-22T14:10:00Z", price: "90" },
  ]);
  assert.equal(short.marketMae?.money, "5.0000");
  assert.equal(short.marketMfe?.money, "10.0000");
  assert.equal(short.bestExitGrossPnl, "10.0000");
  assert.equal(short.bestExitEfficiency, "0.500000");

  const open = buildExecutionReview(input({
    status: "open",
    executions: [
      { type: "entry", price: "100", quantity: "2", executedAt: "2026-10-22T14:00:00Z" },
      { type: "scale_out", price: "105", quantity: "1", executedAt: "2026-10-22T14:10:00Z" },
    ],
  }), [{ observedAt: "2026-10-22T14:15:00Z", price: "120" }]);
  assert.equal(open.marketMfe?.money, "20.0000");
  assert.equal(open.bestExitGrossPnl, null);
  assert.equal(open.bestExitEfficiency, null);
});

test("price path validation bounds timestamps and the editor round-trips rows", () => {
  const bounds = { entryAt: new Date("2026-10-22T14:00:00Z"), exitAt: new Date("2026-10-22T14:20:00Z") };
  assert.throws(() => normalizePricePath([{ observedAt: "2026-10-22T13:59:00Z", price: "100" }], bounds), /before the trade entry/);
  assert.throws(() => normalizePricePath([{ observedAt: "2026-10-22T14:21:00Z", price: "100" }], bounds), /after the trade exit/);
  assert.throws(() => normalizePricePath([
    { observedAt: "2026-10-22T14:05:00Z", price: "100" },
    { observedAt: "2026-10-22T14:05:00Z", price: "101" },
  ], bounds), /distinct timestamp/);
  assert.throws(() => normalizePricePath([{ observedAt: "2026-10-22T14:05:00Z", price: "0" }], bounds), /greater than zero/);
  assert.throws(() => normalizePricePath(
    [{ observedAt: "2026-10-22T14:11:00Z", price: "100" }],
    { ...bounds, now: new Date("2026-10-22T14:10:00Z") },
  ), /cannot be in the future/);

  const source = [
    { observedAt: "2026-10-22T14:05:00Z", price: "100.25", notes: "quoted, note" },
    { observedAt: "2026-10-22T14:10:00Z", price: "101", notes: "=preserve-editor-text" },
  ];
  const draft = serializePricePath(source);
  assert.deepEqual(parsePricePathDraft(draft), source);
});
