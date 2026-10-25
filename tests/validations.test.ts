import assert from "node:assert/strict";
import test from "node:test";
import { cashFlowSchema, journalSchema, riskSchema, savedViewSchema, settingsSchema, signupSchema, tradeReviewSchema, tradeSchema } from "../src/lib/validations";

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
  assert.equal(settingsSchema.safeParse({ timezone: "America/New_York" }).success, true);
  assert.equal(settingsSchema.safeParse({ timezone: "not/a-timezone" }).success, false);
});

test("review status requires an actionable follow-up and bounds next-action text", () => {
  assert.equal(tradeReviewSchema.safeParse({ reviewStatus: "reviewed", nextAction: "Wait for confirmation" }).success, true);
  assert.equal(tradeReviewSchema.safeParse({ reviewStatus: "needs_follow_up", nextAction: "" }).success, false);
  assert.equal(tradeReviewSchema.safeParse({ reviewStatus: "needs_follow_up", nextAction: "Reduce size" }).success, true);
  assert.equal(tradeReviewSchema.safeParse({ reviewStatus: "reviewed", nextAction: "x".repeat(2001) }).success, false);
});

test("saved views accept only bounded, known filter fields", () => {
  const valid = savedViewSchema.safeParse({
    name: "  London review  ",
    filters: { from: "2026-01-01", direction: "long", reviewStatus: "unreviewed" },
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.name, "London review");
    assert.equal(valid.data.filters.to, "");
    assert.equal(valid.data.filters.reviewStatus, "unreviewed");
  }
  assert.equal(savedViewSchema.safeParse({ name: "Bad", filters: { direction: "sideways" } }).success, false);
  assert.equal(savedViewSchema.safeParse({ name: "Bad", filters: { from: "2026-02-29" } }).success, false);
  assert.equal(savedViewSchema.safeParse({ name: "Bad", filters: { unknown: "value" } }).success, false);
  assert.equal(savedViewSchema.safeParse({ name: "Bad", filters: { accountId: "not-a-uuid" } }).success, false);
});

test("cash-flow validation separates positive cash events from signed adjustments", () => {
  const base = {
    accountId: validTrade.accountId,
    type: "deposit",
    amount: "100",
    occurredAt: "2026-01-01T10:00:00.000Z",
  };
  assert.equal(cashFlowSchema.safeParse(base).success, true);
  assert.equal(cashFlowSchema.safeParse({ ...base, amount: "-100" }).success, false);
  assert.equal(cashFlowSchema.safeParse({ ...base, type: "adjustment", amount: "-100" }).success, true);
  assert.equal(cashFlowSchema.safeParse({ ...base, type: "adjustment", amount: "0" }).success, false);
});

test("passwords cannot exceed bcrypt's 72-byte input boundary", () => {
  const base = { name: "Trader", email: "trader@example.com" };
  assert.equal(signupSchema.safeParse({ ...base, password: "a".repeat(72) }).success, true);
  assert.equal(signupSchema.safeParse({ ...base, password: "a".repeat(73) }).success, false);
  assert.equal(signupSchema.safeParse({ ...base, password: "🔐".repeat(19) }).success, false);
});
