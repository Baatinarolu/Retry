import assert from "node:assert/strict";
import test from "node:test";
import { journalSchema, riskSchema, signupSchema, tradeSchema } from "../src/lib/validations";

const validTrade = {
  accountId: "123e4567-e89b-42d3-a456-426614174000",
  instrument: "EURUSD",
  direction: "long",
  entryAt: "2026-01-01T10:00:00.000Z",
  exitAt: "2026-01-01T11:00:00.000Z",
  entryPrice: "1.1000",
  exitPrice: "1.1050",
  status: "closed",
};

test("valid closed and open trades pass", () => {
  assert.equal(tradeSchema.safeParse(validTrade).success, true);
  assert.equal(
    tradeSchema.safeParse({ ...validTrade, status: "open", exitAt: null, exitPrice: null }).success,
    true,
  );
});

test("closed trades require real exit data", () => {
  assert.equal(tradeSchema.safeParse({ ...validTrade, exitAt: null }).success, false);
  assert.equal(tradeSchema.safeParse({ ...validTrade, exitPrice: "" }).success, false);
});

test("trade validation rejects non-finite numbers and reversed dates", () => {
  assert.equal(tradeSchema.safeParse({ ...validTrade, entryPrice: "NaN" }).success, false);
  assert.equal(tradeSchema.safeParse({ ...validTrade, entryPrice: "Infinity" }).success, false);
  assert.equal(
    tradeSchema.safeParse({ ...validTrade, exitAt: "2025-12-31T11:00:00.000Z" }).success,
    false,
  );
  assert.equal(tradeSchema.safeParse({ ...validTrade, entryAt: "not-a-date" }).success, false);
});

test("manual P&L override must include a finite value", () => {
  assert.equal(tradeSchema.safeParse({ ...validTrade, pnlOverridden: true }).success, false);
  assert.equal(
    tradeSchema.safeParse({ ...validTrade, pnlOverridden: true, overrideNetPnl: "-25.50" }).success,
    true,
  );
});

test("execution-led trades do not require duplicate summary prices or exit fields", () => {
  const result = tradeSchema.safeParse({
    ...validTrade,
    entryPrice: "",
    exitPrice: "",
    exitAt: null,
    executions: [
      { type: "entry", price: "100", quantity: "1", executedAt: "2026-01-01T10:00:00.000Z" },
      { type: "exit", price: "105", quantity: "1", executedAt: "2026-01-01T11:00:00.000Z" },
    ],
  });
  assert.equal(result.success, true);
  assert.equal(tradeSchema.safeParse({ ...validTrade, entryPrice: "" }).success, false);
});

test("calendar dates and zero-valued risk limits validate correctly", () => {
  assert.equal(journalSchema.safeParse({ journalDate: "2026-02-29" }).success, false);
  assert.equal(journalSchema.safeParse({ journalDate: "2026-02-28" }).success, true);
  const risk = riskSchema.safeParse({ maxDailyLoss: 0, maxTradesPerDay: 0, maxConsecutiveLosses: 0 });
  assert.equal(risk.success, true);
});

test("passwords cannot exceed bcrypt's 72-byte input boundary", () => {
  const base = { name: "Trader", email: "trader@example.com" };
  assert.equal(signupSchema.safeParse({ ...base, password: "a".repeat(72) }).success, true);
  assert.equal(signupSchema.safeParse({ ...base, password: "a".repeat(73) }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, password: "🔐".repeat(19) }).success, false);
});
