import assert from "node:assert/strict";
import test from "node:test";
import { applyImportMapping } from "../src/lib/import-mapping";
import { prepareImport } from "../src/lib/import-preparation";
import { importColumnMappingSchema, importMappingPresetSchema } from "../src/lib/validations";

const accountId = "00000000-0000-4000-8000-000000000001";

test("explicit broker mappings override aliases without mutating source rows", () => {
  const row = {
    deal_id: "broker-9",
    ticket_asset: "EURUSD",
    side_raw: "buy",
    opened: "2026-01-02T10:00:00Z",
    closed_at: "2026-01-02T11:00:00Z",
    entry: "1.1000",
    exit: "1.1100",
    result: "100",
    symbol: "WRONG",
  };
  const mapping = importColumnMappingSchema.parse({
    sourceId: " Deal ID ",
    instrument: "Ticket Asset",
    direction: "Side Raw",
    entryAt: "opened",
    exitAt: "closed_at",
    entryPrice: "entry",
    exitPrice: "exit",
    netPnl: "result",
  });
  const headers = Object.keys(row);
  const mapped = applyImportMapping([row], headers, mapping);
  const prepared = prepareImport(mapped, [2], accountId, []);

  assert.equal(Object.hasOwn(row, "instrument"), false);
  assert.equal(prepared.valid, 1, prepared.preview[0].errors.join("; "));
  assert.equal(prepared.payloads[0].payload.instrument, "EURUSD");
  assert.equal(prepared.payloads[0].payload.sourceKey, "id:broker-9");
  assert.equal(prepared.payloads[0].payload.overrideNetPnl, "100");
  assert.equal(prepared.preview[0].data.instrument, "EURUSD");

  const blank = applyImportMapping([{ ...row, ticket_asset: "" }], headers, mapping);
  const blankPrepared = prepareImport(blank, [2], accountId, []);
  assert.equal(blankPrepared.valid, 0);
  assert.match(blankPrepared.preview[0].errors.join(" "), /instrument/);
});

test("mapped execution columns trigger the same grouped execution import path", () => {
  const rows = [
    { parent: "position-7", asset: "EURUSD", side_raw: "buy", action: "entry", fill: "1.1000", amount: "1", at: "2026-01-02T10:00:00Z" },
    { parent: "position-7", asset: "EURUSD", side_raw: "buy", action: "exit", fill: "1.1100", amount: "1", at: "2026-01-02T11:00:00Z" },
  ];
  const mapping = importColumnMappingSchema.parse({
    sourceId: "parent",
    instrument: "asset",
    direction: "side_raw",
    executionType: "action",
    executionPrice: "fill",
    executionQuantity: "amount",
    executedAt: "at",
  });
  const mapped = applyImportMapping(rows, Object.keys(rows[0]), mapping);
  const prepared = prepareImport(mapped, [2, 3], accountId, []);

  assert.equal(prepared.executionMode, true);
  assert.equal(prepared.preview.length, 1);
  assert.equal(prepared.valid, 1, prepared.preview[0].errors.join("; "));
  assert.equal(prepared.payloads[0].payload.executions?.length, 2);
  assert.equal(prepared.payloads[0].payload.status, "closed");
});

test("mapping validation rejects unknown fields, missing CSV columns, and empty presets", () => {
  assert.equal(importColumnMappingSchema.safeParse({ instrument: "asset", unknown: "value" }).success, false);
  assert.equal(importMappingPresetSchema.safeParse({ name: "Empty", mapping: {} }).success, false);
  assert.equal(importMappingPresetSchema.safeParse({ name: "Broker", mapping: { instrument: "Asset" } }).success, true);
  assert.throws(
    () => applyImportMapping([{ asset: "EURUSD" }], ["asset"], { instrument: "missing" }),
    /missing from this CSV/,
  );
});
