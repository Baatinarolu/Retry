import Decimal from "decimal.js";

export type AccountLedgerRow = {
  id: string;
  netPnl: string | number;
  entryAt: Date;
  exitAt?: Date | null;
  /** Latest scale-out for an open execution-led trade; otherwise the final exit. */
  realizedAt?: Date | null;
  createdAt: Date;
};

export type AccountBalanceSnapshot = {
  id: string;
  balanceBefore: string;
  balanceAfter: string;
};

function timestamp(value: Date) {
  const time = value.getTime();
  if (Number.isNaN(time)) throw new Error("Account ledger contains an invalid timestamp");
  return time;
}

/**
 * Rebuilds display snapshots from the account's immutable starting balance and
 * stored realized trade P&L. Running totals retain Decimal precision; only the
 * numeric(18,2) presentation values are rounded.
 */
export function buildAccountBalanceSnapshots(startingBalance: string | number, rows: AccountLedgerRow[]) {
  const ordered = [...rows].sort((a, b) => {
    const realizationDiff = timestamp(a.realizedAt ?? a.exitAt ?? a.entryAt) - timestamp(b.realizedAt ?? b.exitAt ?? b.entryAt);
    if (realizationDiff) return realizationDiff;
    const createdDiff = timestamp(a.createdAt) - timestamp(b.createdAt);
    if (createdDiff) return createdDiff;
    return a.id.localeCompare(b.id);
  });

  let running = new Decimal(startingBalance);
  const snapshots: AccountBalanceSnapshot[] = ordered.map((row) => {
    const balanceBefore = running;
    running = running.plus(row.netPnl);
    return {
      id: row.id,
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: running.toFixed(2),
    };
  });

  return { snapshots, currentBalance: running.toFixed(2) };
}
