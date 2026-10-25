import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCsv } from "../src/lib/csv";
import { prepareImport } from "../src/lib/import-preparation";

const accountId = "00000000-0000-4000-8000-000000000001";

for (const name of ["summary-golden", "execution-golden"]) {
  test(`${name} CSV matches its committed canonical import snapshot`, () => {
    const parsed = parseCsv(readFileSync(`tests/fixtures/import/${name}.csv`, "utf8"));
    const prepared = prepareImport(parsed.rows, parsed.lineMap, accountId, []);
    const actual = JSON.parse(JSON.stringify(prepared));
    const expected = JSON.parse(readFileSync(`tests/fixtures/import/${name}.json`, "utf8"));
    assert.deepEqual(actual, expected);
  });
}
