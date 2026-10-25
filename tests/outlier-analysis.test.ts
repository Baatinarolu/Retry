import assert from "node:assert/strict";
import test from "node:test";
import { buildOutlierDependence, type OutlierTrade } from "../src/lib/outlier-analysis";

function trade(id: string, netPnl: string, index: number, status: "open" | "closed" = "closed"): OutlierTrade {
  const at = new Date(Date.UTC(2026, 0, index + 1));
  return {
    id,
    displayId: `TM-2026-${String(index + 1).padStart(4, "0")}`,
    instrument: "EURUSD",
    netPnl,
    grossPnl: netPnl,
    rMultiple: netPnl === "0" ? "0" : netPnl.startsWith("-") ? "-1" : "1",
    result: netPnl === "0" ? "be" : netPnl.startsWith("-") ? "loss" : "win",
    status,
    entryAt: at,
    exitAt: status === "closed" ? at : null,
    realizedAt: status === "closed" ? at : null,
  };
}

test("outlier dependence reports shares and recalculates leave-one-out samples", () => {
  const result = buildOutlierDependence([
    trade("a", "100", 0),
    trade("b", "50", 1),
    trade("c", "-25", 2),
    trade("d", "-25", 3),
  ]);
  assert.equal(result.best?.displayId, "TM-2026-0001");
  assert.equal(result.best?.share, 0.666667);
  assert.equal(result.worst?.share, 0.5);
  assert.equal(result.withoutBest?.totalTrades, 3);
  assert.equal(result.withoutBest?.netPnl, "0.0000");
  assert.equal(result.withoutWorst?.totalTrades, 3);
  assert.equal(result.withoutWorst?.netPnl, "125.0000");
});

test("outlier analysis excludes open trades and handles an empty remaining sample", () => {
  const result = buildOutlierDependence([
    trade("open", "1000", 0, "open"),
    trade("closed", "10", 1),
  ]);
  assert.equal(result.best?.id, "closed");
  assert.equal(result.withoutBest?.totalTrades, 0);
  assert.equal(result.withoutBest?.netPnl, "0.0000");
  assert.deepEqual(buildOutlierDependence([]), { best: null, worst: null, withoutBest: null, withoutWorst: null });
});
