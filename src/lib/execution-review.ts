import Decimal from "decimal.js";
import { priceToMonetaryMove, type Direction } from "@/lib/calculations";
import {
  calculateExecutionLedger,
  type ExecutionLedgerInput,
} from "@/lib/execution-ledger";

export type ExecutionReviewPoint = {
  index: number;
  type: "entry" | "scale_in" | "scale_out" | "exit";
  executedAt: string;
  price: string;
  quantity: string;
  openQuantity: string;
  realizedQuantity: string;
  averageCost: string;
  grossPnl: string;
  cumulativeFees: string;
  netPnl: string;
};

export type ObservedExcursion = {
  price: string;
  money: string;
  r: string | null;
};

export type ExecutionReview = {
  points: ExecutionReviewPoint[];
  finalGrossPnl: string;
  finalNetPnl: string;
  targetAttainment: string | null;
  observedMae: ObservedExcursion | null;
  observedMfe: ObservedExcursion | null;
  /** A best permissible exit cannot be inferred from fills alone. */
  bestExitEfficiency: null;
  notes: string[];
};

function decimal(value: string | number | null | undefined, fallback = "0") {
  if (value === null || value === undefined || value === "") return new Decimal(fallback);
  return new Decimal(value);
}

function signedPriceMove(direction: Direction, from: Decimal, to: Decimal) {
  return direction === "long" ? to.minus(from) : from.minus(to);
}

function monetaryMove(input: ExecutionLedgerInput, from: Decimal, to: Decimal, quantity: Decimal) {
  return priceToMonetaryMove({
    direction: input.direction,
    fromPrice: from,
    toPrice: to,
    positionSize: quantity,
    lotSize: quantity,
    contractSize: decimal(input.contractSize, "1"),
    tickSize: decimal(input.tickSize),
    tickValue: decimal(input.tickValue),
    pipSize: decimal(input.pipSize),
    pipValue: decimal(input.pipValue),
  });
}

function excursionValue(price: Decimal, money: Decimal, initialRisk: Decimal): ObservedExcursion {
  return {
    price: price.toFixed(8),
    money: money.toFixed(4),
    r: initialRisk.gt(0) ? money.div(initialRisk).toFixed(4) : null,
  };
}

/**
 * Replays the same weighted-average execution model as the ledger for review UI.
 * This is deliberately not a market-data MAE/MFE or best-exit calculator: only
 * prices at recorded fills are observed, and running P&L is realized P&L.
 */
export function buildExecutionReview(input: ExecutionLedgerInput): ExecutionReview {
  const ledger = calculateExecutionLedger(input);
  const tradeCosts = decimal(input.commission).plus(decimal(input.swap)).plus(decimal(input.slippage));
  const hasOverride = input.overrideNetPnl !== null && input.overrideNetPnl !== undefined && input.overrideNetPnl !== "";
  const initialRisk = decimal(ledger.metrics.initialRisk);
  let openQuantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let realizedQuantity = new Decimal(0);
  let grossPnl = new Decimal(0);
  let cumulativeFees = new Decimal(0);
  let maePrice = new Decimal(0);
  let maeMoney = new Decimal(0);
  let mfePrice = new Decimal(0);
  let mfeMoney = new Decimal(0);
  let hasExcursionObservation = false;

  const points = ledger.executions.map((fill, index) => {
    const price = new Decimal(fill.price);
    const quantity = new Decimal(fill.quantity);
    const isEntry = fill.type === "entry" || fill.type === "scale_in";

    if (openQuantity.gt(0)) {
      const move = signedPriceMove(input.direction, averageCost, price);
      const money = monetaryMove(input, averageCost, price, openQuantity);
      hasExcursionObservation = true;
      if (move.lt(0)) {
        if (move.abs().gt(maePrice)) maePrice = move.abs();
        if (money.abs().gt(maeMoney)) maeMoney = money.abs();
      } else if (move.gt(0)) {
        if (move.gt(mfePrice)) mfePrice = move;
        if (money.gt(mfeMoney)) mfeMoney = money;
      }
    }

    if (isEntry) {
      const nextQuantity = openQuantity.plus(quantity);
      averageCost = averageCost.mul(openQuantity).plus(price.mul(quantity)).div(nextQuantity);
      openQuantity = nextQuantity;
    } else {
      grossPnl = grossPnl.plus(monetaryMove(input, averageCost, price, quantity));
      openQuantity = openQuantity.minus(quantity);
      realizedQuantity = realizedQuantity.plus(quantity);
      if (openQuantity.eq(0)) averageCost = new Decimal(0);
    }
    cumulativeFees = cumulativeFees.plus(fill.fees);
    const isFinal = index === ledger.executions.length - 1;
    const calculatedNet = grossPnl.minus(cumulativeFees).minus(isFinal ? tradeCosts : 0);
    const netPnl = isFinal && hasOverride ? decimal(input.overrideNetPnl) : calculatedNet;

    return {
      index: index + 1,
      type: fill.type,
      executedAt: fill.executedAt.toISOString(),
      price: fill.price,
      quantity: fill.quantity,
      openQuantity: openQuantity.toFixed(6),
      realizedQuantity: realizedQuantity.toFixed(6),
      averageCost: averageCost.toFixed(8),
      grossPnl: grossPnl.toFixed(4),
      cumulativeFees: cumulativeFees.toFixed(4),
      netPnl: netPnl.toFixed(4),
    };
  });

  let targetAttainment: string | null = null;
  if (ledger.exitPrice && input.takeProfit !== null && input.takeProfit !== undefined && input.takeProfit !== "") {
    const entry = decimal(ledger.entryPrice);
    const target = decimal(input.takeProfit);
    const exit = decimal(ledger.exitPrice);
    const plannedMove = signedPriceMove(input.direction, entry, target);
    if (plannedMove.gt(0)) {
      targetAttainment = signedPriceMove(input.direction, entry, exit).div(plannedMove).toFixed(6);
    }
  }

  return {
    points,
    finalGrossPnl: ledger.metrics.grossPnl,
    finalNetPnl: ledger.metrics.netPnl,
    targetAttainment,
    observedMae: hasExcursionObservation ? excursionValue(maePrice, maeMoney, initialRisk) : null,
    observedMfe: hasExcursionObservation ? excursionValue(mfePrice, mfeMoney, initialRisk) : null,
    bestExitEfficiency: null,
    notes: [
      "Running P&L includes realized fills and fees; it excludes unrealized P&L on any remaining position.",
      "MAE/MFE are execution-observed excursions, not intratrade market-path excursions.",
      "Best-exit efficiency needs a time-ordered market price path and is not inferred from fills.",
    ],
  };
}
