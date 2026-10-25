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

export type AccountCashFlowRow = {
  id: string;
  /** Signed amount in the account currency. */
  amount: string | number;
  occurredAt: Date;
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
 * Rebuilds display snapshots from the account's starting balance, realized
 * trade P&L, and separate signed cash movements. Running totals retain Decimal
 * precision; only numeric(18,2) presentation values are rounded.
 */
export function buildAccountBalanceSnapshots(
  startingBalance: string | number,
  rows: AccountLedgerRow[],
  cashFlows: AccountCashFlowRow[] = [],
) {
  const events = [
    ...rows.map((row) => ({
      kind: "trade" as const,
      id: row.id,
      at: row.realizedAt ?? row.exitAt ?? row.entryAt,
      createdAt: row.createdAt,
      row,
    })),
    ...cashFlows.map((flow) => ({
      kind: "cash" as const,
      id: flow.id,
      at: flow.occurredAt,
      createdAt: flow.createdAt,
      flow,
    })),
  ].sort((a, b) => {
    const realizationDiff = timestamp(a.at) - timestamp(b.at);
    if (realizationDiff) return realizationDiff;
    const createdDiff = timestamp(a.createdAt) - timestamp(b.createdAt);
    if (createdDiff) return createdDiff;
    return a.id.localeCompare(b.id) || a.kind.localeCompare(b.kind);
  });

  let running = new Decimal(startingBalance);
  const snapshots: AccountBalanceSnapshot[] = [];
  for (const event of events) {
    if (event.kind === "cash") {
      running = running.plus(event.flow.amount);
      continue;
    }
    const balanceBefore = running;
    running = running.plus(event.row.netPnl);
    snapshots.push({
      id: event.row.id,
      balanceBefore: balanceBefore.toFixed(2),
      balanceAfter: running.toFixed(2),
    });
  }

  return { snapshots, currentBalance: running.toFixed(2) };
}
