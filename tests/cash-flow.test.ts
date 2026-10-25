import assert from "node:assert/strict";
import test from "node:test";
import { cashFlowLabel, signedCashFlowAmount } from "../src/lib/cash-flow";

test("cash-flow types determine signed account movements", () => {
  assert.equal(signedCashFlowAmount("deposit", "100"), "100.00");
  assert.equal(signedCashFlowAmount("dividend", "12.5"), "12.50");
  assert.equal(signedCashFlowAmount("withdrawal", "100"), "-100.00");
  assert.equal(signedCashFlowAmount("fee", "3.5"), "-3.50");
  assert.equal(signedCashFlowAmount("payout", "250"), "-250.00");
  assert.equal(signedCashFlowAmount("adjustment", "-2.75"), "-2.75");
  assert.equal(signedCashFlowAmount("adjustment", "2.75"), "2.75");
  assert.equal(cashFlowLabel("payout"), "Prop payout (cash out)");
});

test("cash-flow amounts reject ambiguous or invalid directions", () => {
  assert.throws(() => signedCashFlowAmount("deposit", "-1"), /positive amount/);
  assert.throws(() => signedCashFlowAmount("withdrawal", "0"), /positive amount/);
  assert.throws(() => signedCashFlowAmount("adjustment", "0"), /non-zero/);
  assert.throws(() => signedCashFlowAmount("deposit", "0.001"), /at least 0.01/);
  assert.throws(() => signedCashFlowAmount("adjustment", "0.001"), /at least 0.01/);
  assert.throws(() => signedCashFlowAmount("deposit", "not-a-number"), /finite number/);
});
