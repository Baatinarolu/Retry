import assert from "node:assert/strict";
import test from "node:test";
import { buildAccountBalanceSnapshots, type AccountLedgerRow } from "../src/lib/accounting";

const date = (day: number, hour = 0) => new Date(`2026-01-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`);

function row(id: string, netPnl: string, realizedDay: number, createdHour = 0): AccountLedgerRow {
  return {
    id,
    netPnl,
    entryAt: date(realizedDay - 1),
    exitAt: date(realizedDay),
    createdAt: date(realizedDay, createdHour),
  };
}

test("balance rebuilding is deterministic for shuffled history", () => {
  const rows = [row("c", "50", 3), row("a", "100", 1), row("b", "-30", 2)];
  const result = buildAccountBalanceSnapshots("1000", rows);

  assert.deepEqual(result, {
    snapshots: [
      { id: "a", balanceBefore: "1000.00", balanceAfter: "1100.00" },
      { id: "b", balanceBefore: "1100.00", balanceAfter: "1070.00" },
      { id: "c", balanceBefore: "1070.00", balanceAfter: "1120.00" },
    ],
    currentBalance: "1120.00",
  });
  assert.equal(rows[0].id, "c", "caller input must not be reordered");
});

test("historical edits and deletions rebuild every subsequent snapshot", () => {
  const edited = buildAccountBalanceSnapshots("1000", [row("a", "200", 1), row("b", "-30", 2), row("c", "50", 3)]);
  assert.deepEqual(edited.snapshots.map(({ id, balanceBefore, balanceAfter }) => ({ id, balanceBefore, balanceAfter })), [
    { id: "a", balanceBefore: "1000.00", balanceAfter: "1200.00" },
    { id: "b", balanceBefore: "1200.00", balanceAfter: "1170.00" },
    { id: "c", balanceBefore: "1170.00", balanceAfter: "1220.00" },
  ]);

  const deleted = buildAccountBalanceSnapshots("1000", [row("a", "200", 1), row("c", "50", 3)]);
  assert.equal(deleted.snapshots[1].balanceBefore, "1200.00");
  assert.equal(deleted.currentBalance, "1250.00");
});

test("open partial realizations affect the account ledger and timestamp ties have stable ordering", () => {
  const partial: AccountLedgerRow = {
    id: "partial",
    netPnl: "25",
    entryAt: date(1),
    exitAt: null,
    realizedAt: date(3),
    createdAt: date(1),
  };
  const sameTimeA = row("a", "10", 2, 1);
  const sameTimeB = row("b", "10", 2, 1);
  const result = buildAccountBalanceSnapshots("1000", [partial, sameTimeB, sameTimeA]);

  assert.deepEqual(result.snapshots.map((snapshot) => snapshot.id), ["a", "b", "partial"]);
  assert.deepEqual(result.snapshots[2], { id: "partial", balanceBefore: "1020.00", balanceAfter: "1045.00" });
  assert.equal(result.currentBalance, "1045.00");
});

test("Decimal running totals do not accumulate binary floating-point drift", () => {
  const result = buildAccountBalanceSnapshots("1000", [row("a", "0.10", 1), row("b", "0.20", 2)]);
  assert.equal(result.currentBalance, "1000.30");
});
