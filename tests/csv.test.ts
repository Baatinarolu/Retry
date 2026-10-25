import assert from "node:assert/strict";
import test from "node:test";
import { csvCell, csvLine, parseCsv } from "../src/lib/csv";

test("CSV parser handles BOM, commas, escaped quotes, and quoted newlines", () => {
  const parsed = parseCsv(
    '\uFEFFsymbol,side,notes,open\r\nEURUSD,buy,"first line\nsecond ""quote"", still notes",1.1000\r\nGBPUSD,sell,plain,1.2500',
  );
  assert.deepEqual(parsed.headers, ["symbol", "side", "notes", "open"]);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].symbol, "EURUSD");
  assert.equal(parsed.rows[0].notes, 'first line\nsecond "quote", still notes');
  assert.equal(parsed.rows[1].open, "1.2500");
  assert.deepEqual(parsed.lineMap, [2, 4]);
});

test("CSV parser rejects malformed headers and unclosed quotes", () => {
  assert.throws(() => parseCsv("symbol,symbol\nEURUSD,EURUSD"), /duplicate headers/);
  assert.throws(() => parseCsv('symbol,notes\nEURUSD,"unclosed'), /Unclosed quoted field/);
  assert.throws(() => parseCsv("symbol,\nEURUSD,x"), /empty header/);
});

test("CSV output preserves cells and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('hello, "world"'), '"hello, ""world"""');
  assert.equal(csvCell("=HYPERLINK(\"bad\")"), "\"'=HYPERLINK(\"\"bad\"\")\"");
  assert.equal(csvCell("+2+3"), '"\'+2+3"');
  assert.equal(csvCell("-2+3"), '"\'-2+3"');
  assert.equal(csvCell("-123.45"), '"-123.45"');
  assert.equal(csvLine(["EURUSD", "line 1\nline 2", -10]), '"EURUSD","line 1\nline 2","-10"');
});
