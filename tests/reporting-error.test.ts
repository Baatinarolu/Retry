import assert from "node:assert/strict";
import test from "node:test";
import { isFxReportingError } from "../src/lib/reporting-error";

test("FX reporting errors are distinguished from unrelated failures", () => {
  assert.equal(isFxReportingError("Primary account starting balance (report time): Missing FX rate for USD → NGN effective on or before 2026-10-28T12:47:15.808Z"), true);
  assert.equal(isFxReportingError("Select one account for reporting. Cross-currency totals require explicit FX conversion."), true);
  assert.equal(isFxReportingError("Conflicting direct and inverse FX rates for USD → NGN; keep one consistent quote"), true);
  assert.equal(isFxReportingError("Account not found"), false);
  assert.equal(isFxReportingError("Could not load workspace"), false);
});
