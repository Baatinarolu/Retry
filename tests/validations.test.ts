import assert from "node:assert/strict";
import test from "node:test";
import { bulkTradeReviewSchema, cashFlowSchema, journalSchema, riskSchema, savedViewSchema, settingsSchema, signupSchema, tradeReviewSchema, tradeSchema } from "../src/lib/validations";

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

test("bulk review validates bounded unique IDs and explicit shared follow-ups", () => {
  const ids = [validTrade.accountId, "123e4567-e89b-42d3-a456-426614174001"];
  const reviewed = bulkTradeReviewSchema.safeParse({ ids, reviewStatus: "reviewed" });
  assert.equal(reviewed.success, true);
  if (reviewed.success) assert.equal(reviewed.data.nextAction, undefined, "omission preserves each trade's existing next action");
  assert.equal(bulkTradeReviewSchema.safeParse({ ids, reviewStatus: "needs_follow_up" }).success, false);
  const followUp = bulkTradeReviewSchema.safeParse({ ids, reviewStatus: "needs_follow_up", nextAction: "  Wait for confirmation  " });
  assert.equal(followUp.success, true);
  if (followUp.success) assert.equal(followUp.data.nextAction, "Wait for confirmation");
  assert.equal(bulkTradeReviewSchema.safeParse({ ids: [ids[0], ids[0]], reviewStatus: "reviewed" }).success, false);
  assert.equal(bulkTradeReviewSchema.safeParse({ ids: [], reviewStatus: "reviewed" }).success, false);
  const tooMany = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`);
  assert.equal(bulkTradeReviewSchema.safeParse({ ids: tooMany.slice(0, 100), reviewStatus: "reviewed" }).success, true);
  assert.equal(bulkTradeReviewSchema.safeParse({ ids: tooMany, reviewStatus: "reviewed" }).success, false);
  assert.equal(bulkTradeReviewSchema.safeParse({ ids: ["not-a-uuid"], reviewStatus: "reviewed" }).success, false);
  assert.equal(bulkTradeReviewSchema.safeParse({ ids, reviewStatus: "reviewed", unexpected: true }).success, false);
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

const validPropPlan = {
  firmName: "Example Futures",
  phases: [
    { id: "phase-1", name: "Phase 1", targetPercent: "8" },
    { id: "phase-2", name: "Phase 2", targetPercent: "5" },
  ],
  currentPhaseId: "phase-2",
  phaseStartedAt: "2026-01-10T00:00:00.000Z",
  phaseStartBalance: "100000",
  dailyDrawdownPercent: "4",
  dailyDrawdownBasis: "day_start_balance",
  maxDrawdownPercent: "10",
  maxDrawdownMode: "trailing_balance",
};

test("prop plans validate phase baselines, percentages, and phase ownership", () => {
  assert.equal(riskSchema.safeParse({ propPlan: validPropPlan }).success, true);
  assert.equal(riskSchema.safeParse({ maxDailyLoss: "100" }).success, true);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, phaseStartedAt: "" } }).success, false);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, phaseStartedAt: "2026-01-10" } }).success, false);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, phaseStartedAt: "2026-01-10T01:00:00+01:00" } }).success, true);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, phaseStartBalance: "0" } }).success, false);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, currentPhaseId: "unknown" } }).success, false);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, dailyDrawdownPercent: "101" } }).success, false);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, maxDrawdownPercent: "1e2" } }).success, false);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, unexpected: true } }).success, false);
});

test("prop plans reject duplicate phase IDs and bound request-sized stage lists", () => {
  const duplicate = { ...validPropPlan, phases: [validPropPlan.phases[0], validPropPlan.phases[0]] };
  assert.equal(riskSchema.safeParse({ propPlan: duplicate }).success, false);
  const makePhases = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `phase-${index}`, name: `Phase ${index}`, targetPercent: "0" }));
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, phases: makePhases(13), currentPhaseId: "" } }).success, true);
  assert.equal(riskSchema.safeParse({ propPlan: { ...validPropPlan, phases: makePhases(101), currentPhaseId: "" } }).success, false);
});
