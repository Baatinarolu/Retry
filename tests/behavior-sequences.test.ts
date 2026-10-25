import assert from "node:assert/strict";
import test from "node:test";
import { buildBehaviorSequences, type BehaviorTrade } from "../src/lib/behavior-sequences";

function trade(
  id: string,
  result: "win" | "loss",
  netPnl: string,
  rMultiple: string,
  index: number,
  flags: Partial<BehaviorTrade> = {},
): BehaviorTrade {
  const realizedAt = new Date(Date.UTC(2026, 0, index + 1));
  return {
    id,
    result,
    netPnl,
    grossPnl: netPnl,
    rMultiple,
    status: "closed",
    followedPlan: true,
    entryAt: new Date(realizedAt.getTime() - 60_000),
    exitAt: realizedAt,
    realizedAt,
    ...flags,
  };
}

test("behavior sequences use the next realization and compare complementary samples", () => {
  const sequences = buildBehaviorSequences([
    trade("a", "loss", "-10", "-1", 0, { followedPlan: false }),
    trade("b", "win", "20", "2", 1),
    trade("c", "loss", "-5", "-0.5", 2),
    trade("d", "win", "10", "1", 3),
    trade("e", "win", "5", "0.5", 4),
  ]);
  const afterLoss = sequences.find((sequence) => sequence.key === "after-loss");
  assert.ok(afterLoss);
  assert.equal(afterLoss.sampleSize, 2);
  assert.equal(afterLoss.averagePnl, "15.0000");
  assert.equal(afterLoss.averageR, 1.5);
  assert.equal(afterLoss.comparison?.sampleSize, 2);
  assert.equal(afterLoss.comparison?.averagePnl, "0.0000");
  assert.equal(afterLoss.comparison?.averageR, 0);
  const afterWin = sequences.find((sequence) => sequence.key === "after-win");
  assert.equal(afterWin?.sampleSize, 2);
  assert.equal(afterWin?.averageR, 0);
  const afterBreak = sequences.find((sequence) => sequence.key === "after-plan-break");
  assert.equal(afterBreak?.sampleSize, 1);
  assert.equal(afterBreak?.averageR, 2);
});

test("open trades are excluded and tagged sequences remain explicit", () => {
  const sequences = buildBehaviorSequences([
    trade("a", "loss", "-10", "-1", 0, { fomo: true }),
    { ...trade("open", "win", "1000", "10", 1), status: "open", exitAt: null, realizedAt: null },
    trade("b", "win", "20", "2", 2),
    trade("c", "loss", "-5", "-0.5", 3, { revenge: true }),
    trade("d", "win", "10", "1", 4),
  ]);
  assert.equal(sequences.find((sequence) => sequence.key === "after-fomo")?.averagePnl, "20.0000");
  assert.equal(sequences.find((sequence) => sequence.key === "after-revenge")?.averagePnl, "10.0000");
  assert.equal(sequences.find((sequence) => sequence.key === "after-early-exit"), undefined);
  assert.deepEqual(buildBehaviorSequences([trade("only", "win", "1", "1", 0)]), []);
});
