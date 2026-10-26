import assert from "node:assert/strict";
import test from "node:test";
import { buildTradeTimeline } from "../src/lib/trade-timeline";

test("trade timeline combines evidence chronologically without duplicating execution-led summaries", () => {
  const events = buildTradeTimeline({
    entryAt: "2026-10-01T09:00:00Z",
    exitAt: "2026-10-01T12:00:00Z",
    entryPrice: "100",
    exitPrice: "110",
    executions: [
      { id: "fill-exit", type: "exit", executedAt: "2026-10-01T12:00:00Z", price: "110", quantity: "1", fees: "1" },
      { id: "fill-entry", type: "entry", executedAt: "2026-10-01T09:00:00Z", price: "100", quantity: "2", fees: "0.5" },
    ],
    pricePath: [
      { observedAt: "2026-10-01T10:00:00Z", price: "105", notes: "Recorded high" },
    ],
    riskLevels: [
      { effectiveAt: "2026-10-01T09:30:00Z", stopLoss: "95", takeProfit: null, notes: "Target removed" },
    ],
    screenshots: [
      { id: "shot-1", category: "annotated", caption: "Management note", createdAt: "2026-10-01T11:00:00Z" },
    ],
  }, "USD");

  assert.deepEqual(events.map((event) => event.id), [
    "execution-fill-entry",
    "risk-2026-10-01T09:30:00.000Z",
    "price-2026-10-01T10:00:00.000Z",
    "screenshot-shot-1",
    "execution-fill-exit",
  ]);
  assert.equal(events.some((event) => event.id.startsWith("summary-")), false);
  assert.equal(events[1].detail, "Stop 95 · Target none");
  assert.equal(events[2].notes, "Recorded high");
  assert.equal(events[3].detail, "Chart image · shown at upload time");
  assert.match(events[0].detail, /Fees \$0\.50/);
});

test("summary-only trades still receive entry and exit timeline records", () => {
  const events = buildTradeTimeline({
    entryAt: "2026-10-02T09:00:00Z",
    exitAt: "2026-10-02T10:00:00Z",
    entryPrice: "50",
    exitPrice: "49",
    positionSize: "3",
  });
  assert.deepEqual(events.map((event) => event.id), ["summary-entry", "summary-exit"]);
  assert.equal(events[0].detail, "Price 50 · Quantity 3");
  assert.equal(events[1].detail, "Price 49");
  assert.match(events[0].notes, /no individual fills/i);
});

test("equal timeline timestamps have deterministic source and within-source ordering", () => {
  const at = "2026-10-03T09:00:00Z";
  const events = buildTradeTimeline({
    entryAt: at,
    executions: [
      { id: "b", type: "entry", executedAt: at, price: "100", quantity: "1", fees: "0" },
      { id: "a", type: "scale_in", executedAt: at, price: "101", quantity: "1", fees: "0" },
    ],
    pricePath: [{ observedAt: at, price: "102" }],
    riskLevels: [{ effectiveAt: at, stopLoss: null, takeProfit: "110" }],
    screenshots: [{ id: "shot", category: "entry", caption: "", createdAt: at }],
  });
  assert.deepEqual(events.map((event) => event.id), [
    "execution-b",
    "execution-a",
    `price-${new Date(at).toISOString()}`,
    `risk-${new Date(at).toISOString()}`,
    "screenshot-shot",
  ]);
});

test("timeline ignores invalid dates rather than producing unsortable events", () => {
  const events = buildTradeTimeline({
    entryAt: "not-a-date",
    exitAt: "2026-10-04T10:00:00Z",
    exitPrice: "101",
    screenshots: [{ id: "bad-shot", category: "entry", caption: "", createdAt: "also-invalid" }],
  });
  assert.deepEqual(events.map((event) => event.id), ["summary-exit"]);
});
