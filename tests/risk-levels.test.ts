import assert from "node:assert/strict";
import test from "node:test";
import { MAX_RISK_LEVEL_SNAPSHOTS, normalizeRiskLevels, summarizeRiskLevels } from "../src/lib/risk-levels";

const bounds = {
  entryAt: new Date("2026-10-22T14:00:00Z"),
  exitAt: new Date("2026-10-22T14:20:00Z"),
};

test("risk snapshots sort by effective time and count additions, removals, and changes", () => {
  const snapshots = normalizeRiskLevels([
    { effectiveAt: "2026-10-22T14:10:00Z", stopLoss: null, takeProfit: "120", notes: "Stop removed" },
    { effectiveAt: "2026-10-22T14:00:00Z", stopLoss: "95", takeProfit: "110" },
    { effectiveAt: "2026-10-22T14:05:00Z", stopLoss: "100", takeProfit: "110.0" },
  ], bounds);
  assert.deepEqual(snapshots.map((snapshot) => snapshot.effectiveAt.toISOString()), [
    "2026-10-22T14:00:00.000Z",
    "2026-10-22T14:05:00.000Z",
    "2026-10-22T14:10:00.000Z",
  ]);
  assert.equal(snapshots[2].stopLoss, null);
  assert.equal(snapshots[2].takeProfit, "120.00000000");
  assert.deepEqual(summarizeRiskLevels(snapshots), { snapshots: 3, stopChanges: 2, targetChanges: 1 });
});

test("complete snapshots can explicitly contain neither stop nor target", () => {
  const [snapshot] = normalizeRiskLevels([
    { effectiveAt: "2026-10-22T14:00:00Z", stopLoss: "", takeProfit: null, notes: "No orders recorded" },
  ], bounds);
  assert.equal(snapshot.stopLoss, null);
  assert.equal(snapshot.takeProfit, null);
  assert.equal(snapshot.notes, "No orders recorded");
});

test("risk snapshot validation rejects duplicate, out-of-range, future, and invalid levels", () => {
  const duplicate = [
    { effectiveAt: "2026-10-22T14:05:00Z", stopLoss: "95" },
    { effectiveAt: "2026-10-22T14:05:00Z", stopLoss: "96" },
  ];
  assert.throws(() => normalizeRiskLevels(duplicate, bounds), /distinct timestamp/);
  assert.throws(() => normalizeRiskLevels([{ effectiveAt: "2026-10-22T13:59:00Z" }], bounds), /before the trade entry/);
  assert.throws(() => normalizeRiskLevels([{ effectiveAt: "2026-10-22T14:21:00Z" }], bounds), /after the trade exit/);
  assert.throws(() => normalizeRiskLevels(
    [{ effectiveAt: "2026-10-22T14:11:00Z" }],
    { ...bounds, now: new Date("2026-10-22T14:10:00Z") },
  ), /cannot be in the future/);
  assert.throws(() => normalizeRiskLevels([{ effectiveAt: "2026-10-22T14:05:00Z", stopLoss: "0" }], bounds), /greater than zero/);
  assert.throws(() => normalizeRiskLevels(
    Array.from({ length: MAX_RISK_LEVEL_SNAPSHOTS + 1 }, () => ({ effectiveAt: "2026-10-22T14:05:00Z" })),
    bounds,
  ), /limited to 200 snapshots/);
});

test("numerically equivalent levels do not inflate change counts", () => {
  assert.deepEqual(summarizeRiskLevels([
    { effectiveAt: "2026-10-22T14:00:00Z", stopLoss: "95", takeProfit: "110" },
    { effectiveAt: "2026-10-22T14:05:00Z", stopLoss: "95.00000000", takeProfit: "110.0" },
  ]), { snapshots: 2, stopChanges: 0, targetChanges: 0 });
});
