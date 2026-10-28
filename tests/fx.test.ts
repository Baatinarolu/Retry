import assert from "node:assert/strict";
import test from "node:test";
import { computePerformanceStats } from "../src/lib/calculations";
import { ruleBasedCoach } from "../src/lib/analytics";
import {
  convertCurrency,
  convertStartingBalancesToCurrency,
  convertTradeRowsToCurrency,
  normalizeFxRate,
} from "../src/lib/fx";

const rates = [
  { fromCurrency: "USD", toCurrency: "NGN", rate: "1500", effectiveAt: "2026-01-01T00:00:00Z" },
  { fromCurrency: "USD", toCurrency: "NGN", rate: "1600", effectiveAt: "2026-02-01T00:00:00Z" },
];

test("dated direct and reciprocal FX conversion uses the latest effective rate", () => {
  assert.equal(convertCurrency("100", "USD", "NGN", "2026-01-15T00:00:00Z", rates).toFixed(2), "150000.00");
  assert.equal(convertCurrency("100", "USD", "NGN", "2026-02-15T00:00:00Z", rates).toFixed(2), "160000.00");
  assert.equal(convertCurrency("150000", "NGN", "USD", "2026-01-15T00:00:00Z", rates).toFixed(2), "100.00");
  assert.equal(convertCurrency("25", "USD", "USD", "2020-01-01T00:00:00Z", []).toFixed(2), "25.00");
});

test("reporting rows convert at realization, preserve native metadata, and leave R unchanged", () => {
  const [row] = convertTradeRowsToCurrency([{
    displayId: "TM-1",
    accountCurrency: "USD",
    netPnl: "10",
    grossPnl: "12",
    rMultiple: "2",
    entryAt: new Date("2026-01-01T00:00:00Z"),
    exitAt: new Date("2026-01-14T00:00:00Z"),
    realizedAt: new Date("2026-01-15T00:00:00Z"),
  }], "NGN", rates);
  assert.equal(row.netPnl, "15000.0000");
  assert.equal(row.grossPnl, "18000.0000");
  assert.equal(row.rMultiple, "2");
  assert.equal(row.accountCurrency, "USD");
  assert.equal(row.reportingCurrency, "NGN");
});

test("starting balances convert at the explicit report timestamp before summing", () => {
  const result = convertStartingBalancesToCurrency([
    { name: "USD account", currency: "USD", startingBalance: "100" },
    { name: "NGN account", currency: "NGN", startingBalance: "150000" },
  ], "USD", "2026-01-15T00:00:00Z", rates);
  assert.equal(result, "200.00");
});

test("missing historical rates and inconsistent reciprocal quotes fail closed", () => {
  assert.throws(
    () => convertCurrency("100", "USD", "NGN", "2025-12-31T00:00:00Z", rates),
    /Missing FX rate/,
  );
  assert.throws(
    () => convertCurrency("100", "USD", "NGN", "2026-01-15T00:00:00Z", [
      rates[0],
      { fromCurrency: "NGN", toCurrency: "USD", rate: "0.001", effectiveAt: "2026-01-02T00:00:00Z" },
    ]),
    /Conflicting direct and inverse/,
  );
  assert.throws(
    () => convertCurrency("100", "USD", "NGN", "2026-01-15T00:00:00Z", [
      rates[0],
      { fromCurrency: "USD", toCurrency: "NGN", rate: "1400", effectiveAt: "2026-01-01T00:00:00Z" },
    ]),
    /Conflicting FX rates/,
  );
});

test("starting-balance FX errors identify the account and report-time conversion", () => {
  assert.throws(
    () => convertStartingBalancesToCurrency([
      { name: "Primary account", currency: "USD", startingBalance: "100" },
    ], "NGN", "2026-10-28T12:10:20.706Z", []),
    /Primary account starting balance \(report time\): Missing FX rate for USD → NGN/,
  );
});

test("FX rate normalization validates direction, positivity, precision, and metadata", () => {
  const normalized = normalizeFxRate({
    fromCurrency: "usd",
    toCurrency: "ngn",
    rate: "1500",
    effectiveAt: "2026-01-01T00:00:00Z",
    source: " broker statement ",
  });
  assert.equal(normalized.fromCurrency, "USD");
  assert.equal(normalized.toCurrency, "NGN");
  assert.equal(normalized.rate, "1500.000000000000");
  assert.equal(normalized.source, "broker statement");
  assert.throws(() => normalizeFxRate({ ...normalized, toCurrency: "USD" }), /must differ/);
  assert.throws(() => normalizeFxRate({ ...normalized, rate: "0" }), /greater than zero/);
  assert.throws(() => normalizeFxRate({ ...normalized, rate: "0.0000000000001" }), /too small/);
  assert.throws(() => normalizeFxRate({ ...normalized, rate: "1000000000000" }), /too large/);
});

test("AI facts disclose when mixed-account money was converted", () => {
  const review = ruleBasedCoach({
    stats: computePerformanceStats([]),
    insights: [],
    byInstrument: [],
    bySession: [],
    byStrategy: [],
    mistakes: [],
    sampleSize: 0,
    currency: "NGN",
    conversion: { enabled: true, targetCurrency: "NGN", method: "dated manual rates" },
  });
  assert.match(review, /FX disclosure: mixed-account money facts are converted to NGN/);
  assert.match(review, /Native account ledgers and R multiples are unchanged/);
});
