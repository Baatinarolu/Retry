import Decimal from "decimal.js";
import {
  calculateInitialRisk,
  calculatePlannedRr,
  calculateRMultiple,
  classifyResult,
  holdingMinutes,
  priceToMonetaryMove,
  type CalcInput,
  type ComputedTradeMetrics,
  type Direction,
} from "./calculations";

export type ExecutionFill = {
  type: "entry" | "scale_in" | "scale_out" | "exit";
  price: string | number;
  quantity: string | number;
  executedAt: string | Date;
  fees?: string | number;
  notes?: string;
};

export type ExecutionLedgerInput = Omit<CalcInput, "entryPrice" | "exitPrice" | "positionSize" | "lotSize"> & {
  direction: Direction;
  status: "open" | "closed";
  executions: ExecutionFill[];
  overrideNetPnl?: string | number | null;
};

export type NormalizedExecutionFill = {
  type: ExecutionFill["type"];
  price: string;
  quantity: string;
  executedAt: Date;
  fees: string;
  notes: string;
};

export type ExecutionLedger = {
  entryAt: Date;
  exitAt: Date | null;
  /** Latest partial or final reduction, used for realization-date reporting. */
  realizedAt: Date | null;
  lastExecutionAt: Date;
  entryPrice: string;
  exitPrice: string | null;
  positionSize: string;
  lotSize: string;
  remainingQuantity: string;
  totalEntryQuantity: string;
  totalExitQuantity: string;
  status: "open" | "closed";
  executions: NormalizedExecutionFill[];
  metrics: ComputedTradeMetrics;
};

function decimal(value: string | number | null | undefined, label: string, fallback?: string) {
  if ((value === null || value === undefined || value === "") && fallback !== undefined) {
    return new Decimal(fallback);
  }
  try {
    const result = new Decimal(value as string | number);
    if (!result.isFinite()) throw new Error(`${label} must be a finite number`);
    return result;
  } catch {
    throw new Error(`${label} must be a finite number`);
  }
}

function normalizeFill(fill: ExecutionFill, index: number): NormalizedExecutionFill {
  const line = index + 1;
  const executedAt = fill.executedAt instanceof Date ? new Date(fill.executedAt) : new Date(fill.executedAt);
  if (Number.isNaN(executedAt.getTime())) throw new Error(`Execution ${line} has an invalid date/time`);

  const price = decimal(fill.price, `Execution ${line} price`).toFixed(8);
  const quantity = decimal(fill.quantity, `Execution ${line} quantity`).toFixed(6);
  const fees = decimal(fill.fees, `Execution ${line} fees`, "0").toFixed(4);
  if (new Decimal(price).lte(0)) throw new Error(`Execution ${line} price must be greater than zero`);
  if (new Decimal(quantity).lte(0)) throw new Error(`Execution ${line} quantity must be greater than zero`);
  if (new Decimal(fees).lt(0)) throw new Error(`Execution ${line} fees cannot be negative`);

  return {
    type: fill.type,
    price,
    quantity,
    executedAt,
    fees,
    notes: fill.notes || "",
  };
}

function monetaryMove(
  direction: Direction,
  fromPrice: Decimal,
  toPrice: Decimal,
  quantity: Decimal,
  input: ExecutionLedgerInput,
) {
  return priceToMonetaryMove({
    direction,
    fromPrice,
    toPrice,
    positionSize: quantity,
    lotSize: quantity,
    contractSize: decimal(input.contractSize, "Contract size", "1"),
    tickSize: decimal(input.tickSize, "Tick size", "0"),
    tickValue: decimal(input.tickValue, "Tick value", "0"),
    pipSize: decimal(input.pipSize, "Pip size", "0"),
    pipValue: decimal(input.pipValue, "Pip value", "0"),
  });
}

/**
 * Reconciles one same-direction trade using weighted-average cost.
 *
 * Entry/scale-in fills increase the position; scale-out/exit fills reduce it.
 * A flat position cannot be reopened inside the same trade because that is a
 * new round trip and needs its own journal record. All quantities and prices
 * are normalized to the database's precision before calculating P&L.
 */
export function calculateExecutionLedger(input: ExecutionLedgerInput): ExecutionLedger {
  if (!input.executions.length) throw new Error("At least one execution is required");

  const executions = input.executions
    .map(normalizeFill)
    .map((fill, index) => ({ fill, index }))
    .sort((a, b) => a.fill.executedAt.getTime() - b.fill.executedAt.getTime() || a.index - b.index)
    .map(({ fill }) => fill);

  let openQuantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let totalEntryQuantity = new Decimal(0);
  let totalExitQuantity = new Decimal(0);
  let entryNotional = new Decimal(0);
  let exitNotional = new Decimal(0);
  let grossPnl = new Decimal(0);
  let executionFees = new Decimal(0);
  let peakOpenQuantity = new Decimal(0);
  let peakAverageCost = new Decimal(0);
  let entryAt: Date | null = null;
  let lastExitAt: Date | null = null;
  let flattened = false;

  for (const [index, fill] of executions.entries()) {
    const price = new Decimal(fill.price);
    const quantity = new Decimal(fill.quantity);
    const isEntry = fill.type === "entry" || fill.type === "scale_in";
    executionFees = executionFees.plus(fill.fees);

    if (isEntry) {
      if (flattened) {
        throw new Error(`Execution ${index + 1} reopens a flat trade. Create a new trade for the next round trip.`);
      }
      const nextQuantity = openQuantity.plus(quantity);
      averageCost = averageCost.mul(openQuantity).plus(price.mul(quantity)).div(nextQuantity);
      openQuantity = nextQuantity;
      if (openQuantity.gt(peakOpenQuantity)) {
        peakOpenQuantity = openQuantity;
        peakAverageCost = averageCost;
      }
      totalEntryQuantity = totalEntryQuantity.plus(quantity);
      entryNotional = entryNotional.plus(price.mul(quantity));
      entryAt ??= fill.executedAt;
      continue;
    }

    if (openQuantity.lte(0)) {
      throw new Error(`Execution ${index + 1} reduces a position before any entry fill`);
    }
    if (quantity.gt(openQuantity)) {
      throw new Error(
        `Execution ${index + 1} quantity ${quantity.toFixed(6)} exceeds the open quantity ${openQuantity.toFixed(6)}`,
      );
    }

    grossPnl = grossPnl.plus(monetaryMove(input.direction, averageCost, price, quantity, input));
    openQuantity = openQuantity.minus(quantity);
    totalExitQuantity = totalExitQuantity.plus(quantity);
    exitNotional = exitNotional.plus(price.mul(quantity));
    lastExitAt = fill.executedAt;
    if (openQuantity.eq(0)) {
      averageCost = new Decimal(0);
      flattened = true;
    }
  }

  if (!entryAt || totalEntryQuantity.lte(0)) throw new Error("The trade needs at least one entry execution");

  const status = openQuantity.gt(0) ? "open" : "closed";
  if (status !== input.status) {
    if (input.status === "closed") {
      throw new Error(
        `Executions leave ${openQuantity.toFixed(6)} open. Add enough exit quantity or change the trade status to open.`,
      );
    }
    throw new Error("Executions fully close this trade. Change the trade status to closed.");
  }

  const closed = status === "closed";
  const exitAt = closed ? lastExitAt : null;
  if (closed && !exitAt) throw new Error("A closed execution ledger needs an exit execution");

  const entryPrice = (closed
    ? entryNotional.div(totalEntryQuantity)
    : averageCost).toFixed(8);
  const exitPrice = totalExitQuantity.gt(0) ? exitNotional.div(totalExitQuantity).toFixed(8) : null;
  const positionSize = (closed ? totalEntryQuantity : openQuantity).toFixed(6);
  // R is measured against the maximum simultaneous exposure, not the smaller
  // quantity left after a partial exit. Stop/target changes are not versioned yet.
  const calcBase = {
    direction: input.direction,
    entryPrice: peakAverageCost.toFixed(8),
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    positionSize: peakOpenQuantity.toFixed(6),
    lotSize: peakOpenQuantity.toFixed(6),
    contractSize: input.contractSize,
    tickSize: input.tickSize,
    tickValue: input.tickValue,
    pipSize: input.pipSize,
    pipValue: input.pipValue,
  };
  const initialRisk = calculateInitialRisk(calcBase);
  const plannedRr = calculatePlannedRr(calcBase);
  const commission = decimal(input.commission, "Commission", "0");
  const swap = decimal(input.swap, "Swap / funding", "0");
  const slippage = decimal(input.slippage, "Slippage cost", "0");
  const calculatedNet = grossPnl.minus(executionFees).minus(commission).minus(swap).minus(slippage);
  const hasOverride = input.overrideNetPnl !== null && input.overrideNetPnl !== undefined && input.overrideNetPnl !== "";
  const netPnl = hasOverride ? decimal(input.overrideNetPnl, "Manual net P&L") : calculatedNet;
  const rMultiple = calculateRMultiple(netPnl, initialRisk);
  const lastExecutionAt = executions[executions.length - 1].executedAt;

  return {
    entryAt,
    exitAt,
    realizedAt: lastExitAt,
    lastExecutionAt,
    entryPrice,
    exitPrice,
    positionSize,
    lotSize: positionSize,
    remainingQuantity: openQuantity.toFixed(6),
    totalEntryQuantity: totalEntryQuantity.toFixed(6),
    totalExitQuantity: totalExitQuantity.toFixed(6),
    status,
    executions,
    metrics: {
      grossPnl: grossPnl.toFixed(4),
      netPnl: netPnl.toFixed(4),
      initialRisk: initialRisk.toFixed(4),
      plannedRr: plannedRr?.toFixed(4) ?? null,
      actualRr: rMultiple?.toFixed(4) ?? null,
      rMultiple: rMultiple?.toFixed(4) ?? null,
      result: classifyResult(netPnl),
      holdingMinutes: closed ? holdingMinutes(entryAt, exitAt) : null,
    },
  };
}
