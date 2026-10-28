import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defaultPropPlan, evaluatePropRisk, phaseBaselineIsStale, type PropPlan, type PropRiskTrade } from "../src/lib/prop-risk";

const dayStart = new Date("2026-01-10T00:00:00.000Z");
const dayEnd = new Date("2026-01-11T00:00:00.000Z");

function trade(id: string, netPnl: string, at: string): PropRiskTrade {
  const date = new Date(at);
  return { id, netPnl, entryAt: date, exitAt: date, realizedAt: date, createdAt: date };
}

function evaluate(plan: PropPlan, overrides: Partial<Parameters<typeof evaluatePropRisk>[0]> = {}) {
  return evaluatePropRisk({
    plan,
    startingBalance: "100000",
    currentBalance: "100000",
    trades: [],
    cashFlows: [],
    dayStart,
    dayEnd,
    plannedRisk: "0",
    ...overrides,
  });
}

function partial(actual: unknown, expected: Record<string, unknown>) {
  assert.ok(actual && typeof actual === "object");
  for (const [key, value] of Object.entries(expected)) assert.deepEqual((actual as Record<string, unknown>)[key], value);
}

describe("prop firm risk rules", () => {
  it("requires a fresh baseline when the active phase changes", () => {
    const previous = {
      ...defaultPropPlan(),
      phases: [{ id: "phase-1", name: "Phase 1", targetPercent: "8" }, { id: "phase-2", name: "Phase 2", targetPercent: "5" }],
      currentPhaseId: "phase-1",
      phaseStartedAt: "2026-01-01T00:00:00.000Z",
      phaseStartBalance: "100000",
    };
    assert.equal(phaseBaselineIsStale(previous, { ...previous, currentPhaseId: "phase-2" }), true);
    assert.equal(phaseBaselineIsStale(previous, { ...previous, currentPhaseId: "phase-2", phaseStartedAt: "2026-01-10T00:00:00.000Z" }), false);
    assert.equal(phaseBaselineIsStale(previous, previous), false);
    assert.equal(phaseBaselineIsStale(previous, { ...previous, currentPhaseId: "" }), false);
  });

  it("starts each phase at its explicit baseline and excludes earlier profits and cash flows", () => {
    const plan = {
      ...defaultPropPlan(),
      phases: [
        { id: "phase-1", name: "Phase 1", targetPercent: "8" },
        { id: "phase-2", name: "Phase 2", targetPercent: "10" },
      ],
      currentPhaseId: "phase-2",
      phaseStartedAt: "2026-01-10T00:00:00.000Z",
      phaseStartBalance: "110000",
    };
    const result = evaluate(plan, {
      currentBalance: "260000",
      trades: [
        trade("phase-1-profit", "10000", "2026-01-02T12:00:00.000Z"),
        trade("phase-2-a", "5000", "2026-01-10T01:00:00.000Z"),
        trade("phase-2-b", "5000", "2026-01-10T02:00:00.000Z"),
      ],
      cashFlows: [{ id: "deposit", amount: "140000", occurredAt: new Date("2026-01-10T03:00:00.000Z"), createdAt: new Date("2026-01-10T03:00:00.000Z") }],
    });

    partial(result.phase, {
      name: "Phase 2",
      targetAmount: "11000.0000",
      realizedPnl: "10000.0000",
      remaining: "1000.0000",
      progressPercent: "90.91",
      achieved: false,
    });
    assert.deepEqual(result.warnings, []);
  });

  it("resets initial and trailing drawdown to the active phase baseline", () => {
    const plan = {
      ...defaultPropPlan(),
      phases: [{ id: "phase-2", name: "Phase 2", targetPercent: "0" }],
      currentPhaseId: "phase-2",
      phaseStartedAt: "2026-01-10T00:00:00.000Z",
      phaseStartBalance: "200000",
      dailyDrawdownPercent: "5",
      maxDrawdownPercent: "10",
      maxDrawdownMode: "trailing_balance" as const,
    };
    const result = evaluate(plan, {
      currentBalance: "190000",
      trades: [
        trade("phase-1", "50000", "2026-01-02T00:00:00.000Z"),
        trade("phase-2", "-10000", "2026-01-10T00:00:00.000Z"),
      ],
    });
    partial(result.overall, {
      currentTradingBalance: "190000.0000",
      peakTradingBalance: "200000.0000",
      currentDrawdown: "10000.0000",
      floor: "180000.0000",
    });
    partial(result.daily, { limit: "10000.0000", remaining: "0.0000", dayStartBalance: "200000.0000" });
    const staticResult = evaluate({ ...plan, maxDrawdownMode: "initial_balance" }, {
      currentBalance: "190000",
      trades: [
        trade("phase-1", "50000", "2026-01-02T00:00:00.000Z"),
        trade("phase-2", "-10000", "2026-01-10T00:00:00.000Z"),
      ],
    });
    assert.equal(staticResult.overall?.floor, "180000.0000");
  });

  it("warns when the active recorded phase target is reached", () => {
    const plan = {
      ...defaultPropPlan(),
      phases: [{ id: "funded", name: "Funded", targetPercent: "5" }],
      currentPhaseId: "funded",
      phaseStartedAt: "2026-01-01T00:00:00.000Z",
      phaseStartBalance: "100000",
    };
    const result = evaluate(plan, { trades: [trade("win", "5000", "2026-01-02T00:00:00.000Z")] });
    assert.equal(result.phase?.achieved, true);
    assert.equal(result.phase?.remaining, "0.0000");
    assert.ok(result.warnings.includes("Funded profit target reached. Your prop rules say to protect the completed phase."));
  });

  it("checks hypothetical planned risk against an initial-balance daily percentage", () => {
    const plan = { ...defaultPropPlan(), dailyDrawdownPercent: "5" };
    const result = evaluate(plan, {
      currentBalance: "96000",
      trades: [trade("loss", "-4000", "2026-01-10T08:00:00.000Z")],
      plannedRisk: "2000",
    });
    partial(result.daily, { limit: "5000.0000", remaining: "1000.0000" });
    assert.ok(result.warnings.includes("This idea may exceed the initial-balance daily drawdown allowance of 5%."));
  });

  it("derives day-start balance from recorded cash and trading changes without putting cash in trading P&L", () => {
    const plan = {
      ...defaultPropPlan(),
      dailyDrawdownPercent: "10",
      dailyDrawdownBasis: "day_start_balance" as const,
      maxDrawdownPercent: "10",
    };
    const result = evaluate(plan, {
      currentBalance: "260000",
      trades: [
        trade("prior", "10000", "2026-01-09T08:00:00.000Z"),
        trade("today", "10000", "2026-01-10T08:00:00.000Z"),
      ],
      cashFlows: [{ id: "deposit", amount: "140000", occurredAt: new Date("2026-01-10T09:00:00.000Z"), createdAt: new Date("2026-01-10T09:00:00.000Z") }],
    });
    partial(result.daily, { dayStartBalance: "110000.0000", limit: "11000.0000", remaining: "21000.0000" });
    assert.equal(result.overall?.currentTradingBalance, "120000.0000");
    assert.deepEqual(result.warnings, []);
  });

  it("trails the recorded trading-balance peak and warns before the hypothetical loss crosses the floor", () => {
    const plan = { ...defaultPropPlan(), maxDrawdownPercent: "10", maxDrawdownMode: "trailing_balance" as const };
    const trades = [trade("peak", "20000", "2026-01-01T00:00:00.000Z"), trade("pullback", "-5000", "2026-01-02T00:00:00.000Z")];
    const result = evaluate(plan, { currentBalance: "115000", trades, plannedRisk: "8000" });
    partial(result.overall, {
      peakTradingBalance: "120000.0000",
      currentTradingBalance: "115000.0000",
      floor: "108000.0000",
      currentDrawdown: "5000.0000",
      prospectiveDrawdown: "13000.0000",
    });
    assert.ok(result.warnings.includes("This idea may exceed the trailing recorded-peak maximum drawdown allowance of 10%."));

    const initial = evaluate({ ...plan, maxDrawdownMode: "initial_balance" }, { currentBalance: "115000", trades, plannedRisk: "8000" });
    assert.equal(initial.overall?.floor, "90000.0000");
    assert.deepEqual(initial.warnings, []);
  });

  it("does not count a withdrawal as trading drawdown", () => {
    const plan = { ...defaultPropPlan(), maxDrawdownPercent: "10" };
    const result = evaluate(plan, {
      currentBalance: "50000",
      cashFlows: [{ id: "withdrawal", amount: "-50000", occurredAt: new Date("2026-01-05T00:00:00.000Z"), createdAt: new Date("2026-01-05T00:00:00.000Z") }],
    });
    assert.equal(result.overall?.currentTradingBalance, "100000.0000");
    assert.equal(result.overall?.currentDrawdown, "0.0000");
    assert.deepEqual(result.warnings, []);
  });

  it("fails closed with an explicit warning when a percentage balance basis is not positive", () => {
    const plan = { ...defaultPropPlan(), dailyDrawdownPercent: "5", dailyDrawdownBasis: "day_start_balance" as const };
    const result = evaluate(plan, { startingBalance: "0", currentBalance: "0" });
    assert.equal(result.daily, null);
    assert.equal(result.warnings.length, 1);
    assert.ok(result.warnings[0].includes("cannot be evaluated safely"));
  });
});
