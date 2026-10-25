import Decimal from "decimal.js";
import { priceToMonetaryMove, type Direction } from "@/lib/calculations";
import {
  calculateExecutionLedger,
  type ExecutionLedgerInput,
} from "@/lib/execution-ledger";
import { normalizePricePath, type PricePathPointInput } from "@/lib/price-path";

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

export type MarketPathExcursion = ObservedExcursion & {
  observedAt: string;
};

export type ExecutionReview = {
  points: ExecutionReviewPoint[];
  finalGrossPnl: string;
  finalNetPnl: string;
  targetAttainment: string | null;
  observedMae: ObservedExcursion | null;
  observedMfe: ObservedExcursion | null;
  marketMae: MarketPathExcursion | null;
  marketMfe: MarketPathExcursion | null;
  /** Actual gross / best recorded gross; null when no positive benchmark exists. */
  bestExitEfficiency: string | null;
  bestExitGrossPnl: string | null;
  bestExitAt: string | null;
  bestExitPrice: string | null;
  pricePathPoints: number;
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

type MarketPathAnalysis = Pick<
  ExecutionReview,
  "marketMae" | "marketMfe" | "bestExitEfficiency" | "bestExitGrossPnl" | "bestExitAt" | "bestExitPrice" | "pricePathPoints"
>;

function analyzePricePath(input: ExecutionLedgerInput, ledger: ReturnType<typeof calculateExecutionLedger>, path: PricePathPointInput[]): MarketPathAnalysis {
  const points = normalizePricePath(path, { entryAt: ledger.entryAt, exitAt: ledger.exitAt });
  const empty: MarketPathAnalysis = {
    marketMae: null,
    marketMfe: null,
    bestExitEfficiency: null,
    bestExitGrossPnl: null,
    bestExitAt: null,
    bestExitPrice: null,
    pricePathPoints: points.length,
  };
  if (!points.length) return empty;

  const initialRisk = decimal(ledger.metrics.initialRisk);
  let fillIndex = 0;
  let openQuantity = new Decimal(0);
  let averageCost = new Decimal(0);
  let grossPnl = new Decimal(0);
  let hasExposure = false;
  let firstExposureAt: Date | null = null;
  let maePrice = new Decimal(0);
  let maeMoney = new Decimal(0);
  let maeAt: Date | null = null;
  let mfePrice = new Decimal(0);
  let mfeMoney = new Decimal(0);
  let mfeAt: Date | null = null;
  let bestGross: Decimal | null = null;
  let bestPoint: (typeof points)[number] | null = null;

  for (const point of points) {
    const time = point.observedAt.getTime();
    // Entries are effective at the same timestamp before the observation; reductions
    // are applied afterward, so an exit-timestamp observation can value the open position.
    while (fillIndex < ledger.executions.length) {
      const fill = ledger.executions[fillIndex];
      const fillTime = fill.executedAt.getTime();
      const isEntry = fill.type === "entry" || fill.type === "scale_in";
      if (fillTime > time || (fillTime === time && !isEntry)) break;
      const price = new Decimal(fill.price);
      const quantity = new Decimal(fill.quantity);
      if (isEntry) {
        const nextQuantity = openQuantity.plus(quantity);
        averageCost = averageCost.mul(openQuantity).plus(price.mul(quantity)).div(nextQuantity);
        openQuantity = nextQuantity;
      } else {
        grossPnl = grossPnl.plus(monetaryMove(input, averageCost, price, quantity));
        openQuantity = openQuantity.minus(quantity);
        if (openQuantity.eq(0)) averageCost = new Decimal(0);
      }
      fillIndex++;
    }

    if (openQuantity.lte(0)) continue;
    hasExposure = true;
    firstExposureAt ??= point.observedAt;
    const price = new Decimal(point.price);
    const move = signedPriceMove(input.direction, averageCost, price);
    const money = monetaryMove(input, averageCost, price, openQuantity);
    if (move.lt(0) && money.abs().gt(maeMoney)) {
      maePrice = move.abs();
      maeMoney = money.abs();
      maeAt = point.observedAt;
    } else if (move.gt(0) && money.gt(mfeMoney)) {
      mfePrice = move;
      mfeMoney = money;
      mfeAt = point.observedAt;
    }

    if (input.status === "closed") {
      const hypotheticalGross = grossPnl.plus(money);
      if (bestGross === null || hypotheticalGross.gt(bestGross)) {
        bestGross = hypotheticalGross;
        bestPoint = point;
      }
    }
  }

  const actualGross = decimal(ledger.metrics.grossPnl);
  return {
    marketMae: hasExposure
      ? { ...excursionValue(maePrice, maeMoney, initialRisk), observedAt: (maeAt ?? firstExposureAt)!.toISOString() }
      : null,
    marketMfe: hasExposure
      ? { ...excursionValue(mfePrice, mfeMoney, initialRisk), observedAt: (mfeAt ?? firstExposureAt)!.toISOString() }
      : null,
    bestExitEfficiency: bestGross && bestGross.gt(0) ? actualGross.div(bestGross).toFixed(6) : null,
    bestExitGrossPnl: bestGross?.toFixed(4) ?? null,
    bestExitAt: bestPoint?.observedAt.toISOString() ?? null,
    bestExitPrice: bestPoint?.price ?? null,
    pricePathPoints: points.length,
  };
}

/**
 * Replays the same weighted-average execution model as the ledger for review UI.
 * Fill-only excursions remain separate from optional recorded-market-path analysis.
 */
export function buildExecutionReview(input: ExecutionLedgerInput, pricePath: PricePathPointInput[] = []): ExecutionReview {
  const ledger = calculateExecutionLedger(input);
  const marketPath = analyzePricePath(input, ledger, pricePath);
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

  const notes = [
    "Running P&L includes realized fills and fees; it excludes unrealized P&L on any remaining position.",
    "Observed MAE/MFE use execution prices only and are not intratrade market-path excursions.",
  ];
  if (marketPath.pricePathPoints) {
    notes.push("Market MAE/MFE use only the recorded price path; unrecorded ticks are not inferred.");
    notes.push("Best recorded exit is a gross counterfactual using realized prior exits and the open quantity at each path point; no extra fees or slippage are invented.");
    notes.push("At equal timestamps, entries apply before the price observation and reductions afterward. The actual-gross/best-recorded-gross ratio can exceed 100% when the path is incomplete.");
  } else {
    notes.push("Add a time-ordered price path for market MAE/MFE and recorded-path exit analysis; neither is inferred from fills.");
  }

  return {
    points,
    finalGrossPnl: ledger.metrics.grossPnl,
    finalNetPnl: ledger.metrics.netPnl,
    targetAttainment,
    observedMae: hasExcursionObservation ? excursionValue(maePrice, maeMoney, initialRisk) : null,
    observedMfe: hasExcursionObservation ? excursionValue(mfePrice, mfeMoney, initialRisk) : null,
    ...marketPath,
    notes,
  };
}
