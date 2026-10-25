import assert from "node:assert/strict";
import test from "node:test";
import { prepareImport } from "../src/lib/import-preparation";
import { hashImportFile, importSource, sourceConflict } from "../src/lib/import-trust";

const accountId = "00000000-0000-4000-8000-000000000001";

function summaryRow(overrides: Record<string, string> = {}) {
  return {
    symbol: "EURUSD",
    side: "buy",
    open_time: "2026-01-02T10:00:00Z",
    close_time: "2026-01-02T11:00:00Z",
    open: "1.1000",
    close: "1.1100",
    volume: "1",
    pnl: "100",
    ...overrides,
  };
}

test("source hashes are stable and explicit source conflicts are never silently overwritten", () => {
  const first = importSource({ symbol: " EURUSD ", side: "buy" });
  const reordered = importSource({ side: "buy", symbol: "EURUSD" });
  assert.equal(first.sourceKey, reordered.sourceKey);
  assert.equal(first.sourceHash, reordered.sourceHash);
  const explicit = importSource({ symbol: "EURUSD" }, "broker-42");
  assert.equal(explicit.sourceKey, "id:broker-42");
  assert.equal(sourceConflict(explicit, explicit), "duplicate");
  assert.match(sourceConflict(explicit, importSource({ symbol: "GBPUSD" }, "broker-42")) || "", /different content/);
  assert.notEqual(hashImportFile("a\n"), hashImportFile("b\n"));
});

test("look-alike summary trades with different economics remain importable", () => {
  const prepared = prepareImport([
    summaryRow(),
    summaryRow({ open: "1.2000", close: "1.2100", pnl: "50" }),
  ], [2, 3], accountId, []);
  assert.equal(prepared.valid, 2);
  assert.equal(prepared.rejected, 0);
  assert.equal(prepared.payloads[0].payload.sourceKey?.startsWith("hash:"), true);
  assert.notEqual(prepared.payloads[0].payload.sourceKey, prepared.payloads[1].payload.sourceKey);
});

test("summary rows without exits remain open and saved instrument/strategy settings apply", () => {
  const prepared = prepareImport([
    { symbol: "NAS100", side: "buy", open_time: "2026-01-02T10:00:00Z", open: "20000", volume: "2", strategy: "London" },
  ], [2], accountId, [], {
    instrumentMap: new Map([["NAS100", { category: "indices", contractSize: "10", tickSize: "1", tickValue: "1", pipSize: "1", pipValue: "1" }]]),
    strategyMap: new Map([["london", "00000000-0000-4000-8000-000000000002"]]),
  });
  assert.equal(prepared.valid, 1, prepared.preview[0].errors.join("; "));
  assert.equal(prepared.payloads[0].payload.status, "open");
  assert.equal(prepared.payloads[0].payload.contractSize, "10");
  assert.equal(prepared.payloads[0].payload.strategyId, "00000000-0000-4000-8000-000000000002");

  const unknown = prepareImport([summaryRow({ strategy: "Missing" })], [2], accountId, [], { strategyMap: new Map() });
  assert.equal(unknown.valid, 0);
  assert.match(unknown.preview[0].errors.join(" "), /Strategy not found/);
});

test("exact retries are duplicates and a changed explicit source ID requires reconciliation", () => {
  const exact = prepareImport([summaryRow(), summaryRow()], [2, 3], accountId, []);
  assert.equal(exact.valid, 1);
  assert.equal(exact.rejected, 1);
  assert.equal(exact.preview[1].duplicate, true);

  const distinctIds = prepareImport([
    summaryRow({ trade_id: "ticket-a" }),
    summaryRow({ trade_id: "ticket-b" }),
  ], [2, 3], accountId, []);
  assert.equal(distinctIds.valid, 2);

  const saved = prepareImport([summaryRow({ trade_id: "saved-ticket" })], [2], accountId, []);
  const retry = prepareImport([summaryRow({ trade_id: "saved-ticket" })], [2], accountId, [
    { sourceKey: saved.payloads[0].payload.sourceKey!, sourceHash: saved.payloads[0].payload.sourceHash! },
  ]);
  assert.equal(retry.valid, 0);
  assert.equal(retry.preview[0].duplicate, true);

  const changed = prepareImport([
    summaryRow({ trade_id: "ticket-1" }),
    summaryRow({ trade_id: "ticket-1", pnl: "99" }),
  ], [2, 3], accountId, []);
  assert.equal(changed.valid, 1);
  assert.equal(changed.rejected, 1);
  assert.equal(changed.preview[1].duplicate, false);
  assert.match(changed.preview[1].errors.join(" "), /different content/);
});

test("execution CSV groups fills into one canonical execution-led trade", () => {
  const rows = [
    { trade_id: "position-7", symbol: "EURUSD", side: "buy", execution_type: "entry", price: "1.1000", quantity: "1", executed_at: "2026-01-02T10:00:00Z" },
    { trade_id: "position-7", symbol: "EURUSD", side: "buy", execution_type: "scale_in", price: "1.1050", quantity: "1", executed_at: "2026-01-02T10:10:00Z" },
    { trade_id: "position-7", symbol: "EURUSD", side: "buy", execution_type: "scale_out", price: "1.1100", quantity: "1", executed_at: "2026-01-02T11:00:00Z" },
    { trade_id: "position-7", symbol: "EURUSD", side: "buy", execution_type: "exit", price: "1.1200", quantity: "1", executed_at: "2026-01-02T11:10:00Z" },
  ];
  const prepared = prepareImport(rows, [2, 3, 4, 5], accountId, []);
  assert.equal(prepared.executionMode, true);
  assert.equal(prepared.sourceRows, 4);
  assert.equal(prepared.preview.length, 1);
  assert.equal(prepared.valid, 1, prepared.preview[0].errors.join("; "));
  assert.equal(prepared.payloads[0].payload.executions?.length, 4);
  assert.equal(prepared.payloads[0].payload.status, "closed");
  assert.equal(prepared.payloads[0].payload.sourceKey, "id:position-7");

  const reordered = prepareImport([rows[3], rows[1], rows[0], rows[2]], [5, 3, 2, 4], accountId, []);
  assert.equal(reordered.valid, 1, reordered.preview[0].errors.join("; "));
  assert.equal(reordered.payloads[0].payload.sourceHash, prepared.payloads[0].payload.sourceHash);
});

test("execution rows without a stable parent ID are rejected explicitly", () => {
  const prepared = prepareImport([
    { symbol: "EURUSD", side: "buy", execution_type: "entry", price: "1.1", quantity: "1", executed_at: "2026-01-02T10:00:00Z" },
  ], [2], accountId, []);
  assert.equal(prepared.valid, 0);
  assert.match(prepared.preview[0].errors.join(" "), /trade_id or position_id/);
});
