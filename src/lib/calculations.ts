import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type Direction = "long" | "short";

export type CalcInput = {
  direction: Direction;
  entryPrice: string | number;
  exitPrice?: string | number | null;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
  positionSize?: string | number | null;
  lotSize?: string | number | null;
  contractSize?: string | number | null;
  tickSize?: string | number | null;
  tickValue?: string | number | null;
  pipSize?: string | number | null;
  pipValue?: string | number | null;
  commission?: string | number | null;
  swap?: string | number | null;
  slippage?: string | number | null;
};

function d(v: string | number | null | undefined, fallback = "0"): Decimal {
  if (v === null || v === undefined || v === "") return new Decimal(fallback);
  try {
    return new Decimal(v);
  } catch {
    return new Decimal(fallback);
  }
}

function signedMove(direction: Direction, from: Decimal, to: Decimal): Decimal {
  return direction === "long" ? to.minus(from) : from.minus(to);
}

export function priceToMonetaryMove(params: {
  direction: Direction;
  fromPrice: Decimal;
  toPrice: Decimal;
  positionSize: Decimal;
  lotSize: Decimal;
  contractSize: Decimal;
  tickSize: Decimal;
  tickValue: Decimal;
  pipSize: Decimal;
  pipValue: Decimal;
}): Decimal {
  const move = signedMove(params.direction, params.fromPrice, params.toPrice);
  const qty = params.positionSize.gt(0) ? params.positionSize : params.lotSize;

  if (params.tickSize.gt(0) && params.tickValue.gt(0)) {
    return move.div(params.tickSize).mul(params.tickValue).mul(qty);
  }
  if (params.pipSize.gt(0) && params.pipValue.gt(0)) {
    return move.div(params.pipSize).mul(params.pipValue).mul(qty);
  }
  if (params.contractSize.gt(0)) {
    return move.mul(params.contractSize).mul(qty);
  }
  return move.mul(qty);
}

export function calculateGrossPnl(input: CalcInput): Decimal {
  if (input.exitPrice === null || input.exitPrice === undefined || input.exitPrice === "") {
    return new Decimal(0);
  }
  return priceToMonetaryMove({
    direction: input.direction,
    fromPrice: d(input.entryPrice),
    toPrice: d(input.exitPrice),
    positionSize: d(input.positionSize, "0"),
    lotSize: d(input.lotSize, "1"),
    contractSize: d(input.contractSize, "1"),
    tickSize: d(input.tickSize, "0"),
    tickValue: d(input.tickValue, "0"),
    pipSize: d(input.pipSize, "0"),
    pipValue: d(input.pipValue, "0"),
  });
}

export function calculateNetPnl(input: CalcInput, gross?: Decimal): Decimal {
  const g = gross ?? calculateGrossPnl(input);
  return g.minus(d(input.commission)).minus(d(input.swap)).minus(d(input.slippage));
}

export function calculateInitialRisk(input: CalcInput): Decimal {
  if (input.stopLoss === null || input.stopLoss === undefined || input.stopLoss === "") {
    return new Decimal(0);
  }
  const risk = priceToMonetaryMove({
    direction: input.direction,
    fromPrice: d(input.entryPrice),
    toPrice: d(input.stopLoss),
    positionSize: d(input.positionSize, "0"),
    lotSize: d(input.lotSize, "1"),
    contractSize: d(input.contractSize, "1"),
    tickSize: d(input.tickSize, "0"),
    tickValue: d(input.tickValue, "0"),
    pipSize: d(input.pipSize, "0"),
    pipValue: d(input.pipValue, "0"),
  });
  return Decimal.max(risk.abs(), new Decimal(0));
}

export function calculatePlannedRr(input: CalcInput): Decimal | null {
  if (
    input.stopLoss === null ||
    input.stopLoss === undefined ||
    input.stopLoss === "" ||
    input.takeProfit === null ||
    input.takeProfit === undefined ||
    input.takeProfit === ""
  ) {
    return null;
  }
  const risk = calculateInitialRisk(input);
  if (risk.lte(0)) return null;
  const reward = priceToMonetaryMove({
    direction: input.direction,
    fromPrice: d(input.entryPrice),
    toPrice: d(input.takeProfit),
    positionSize: d(input.positionSize, "0"),
    lotSize: d(input.lotSize, "1"),
    contractSize: d(input.contractSize, "1"),
    tickSize: d(input.tickSize, "0"),
    tickValue: d(input.tickValue, "0"),
    pipSize: d(input.pipSize, "0"),
    pipValue: d(input.pipValue, "0"),
  }).abs();
  return reward.div(risk);
}

export function calculateRMultiple(netPnl: Decimal, initialRisk: Decimal): Decimal | null {
  if (initialRisk.lte(0)) return null;
  return netPnl.div(initialRisk);
}

export function classifyResult(netPnl: Decimal, beThreshold = new Decimal("0.01")): "win" | "loss" | "be" {
  if (netPnl.abs().lte(beThreshold)) return "be";
  return netPnl.gt(0) ? "win" : "loss";
}

export function holdingMinutes(entryAt: Date, exitAt: Date | null | undefined): number | null {
  if (!exitAt) return null;
  return Math.max(0, Math.round((exitAt.getTime() - entryAt.getTime()) / 60000));
}

export type ComputedTradeMetrics = {
  grossPnl: string;
  netPnl: string;
  initialRisk: string;
  plannedRr: string | null;
  actualRr: string | null;
  rMultiple: string | null;
  result: "win" | "loss" | "be";
  holdingMinutes: number | null;
};

export function computeTradeMetrics(
  input: CalcInput & { entryAt: Date; exitAt?: Date | null; overrideNetPnl?: string | number | null },
): ComputedTradeMetrics {
  const gross = calculateGrossPnl(input);
  const net = input.overrideNetPnl !== null && input.overrideNetPnl !== undefined && input.overrideNetPnl !== ""
    ? d(input.overrideNetPnl)
    : calculateNetPnl(input, gross);
  const risk = calculateInitialRisk(input);
  const planned = calculatePlannedRr(input);
  const r = calculateRMultiple(net, risk);
  return {
    grossPnl: gross.toFixed(4),
    netPnl: net.toFixed(4),
    initialRisk: risk.toFixed(4),
    plannedRr: planned ? planned.toFixed(4) : null,
    actualRr: r ? r.toFixed(4) : null,
    rMultiple: r ? r.toFixed(4) : null,
    result: classifyResult(net),
    holdingMinutes: holdingMinutes(input.entryAt, input.exitAt),
  };
}

export type ClosedTradeStatsInput = {
  netPnl: string | number;
  grossPnl: string | number;
  rMultiple?: string | number | null;
  result: string;
  /** Optional so simulated/backtest rows can use the same statistics engine. */
  status?: string;
  followedPlan?: boolean | null;
  holdingMinutes?: number | null;
  entryAt: Date;
  exitAt?: Date | null;
  /** Final exit or latest partial reduction; legacy rows fall back to exit/entry. */
  realizedAt?: Date | null;
};

export function realizationDate(trade: Pick<ClosedTradeStatsInput, "entryAt" | "exitAt" | "realizedAt">) {
  return trade.realizedAt ?? trade.exitAt ?? trade.entryAt;
}

export type PerformanceStats = {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number | null;
  lossRate: number | null;
  beRate: number | null;
  netPnl: string;
  grossProfit: string;
  grossLoss: string;
  profitFactor: number | null;
  averageWin: string | null;
  averageLoss: string | null;
  averageRr: number | null;
  averageWinR: number | null;
  averageLossR: number | null;
  expectancyR: number | null;
  expectancyCurrency: string | null;
  maxDrawdown: string;
  maxDrawdownPercent: number | null;
  recoveryFactor: number | null;
  averageHoldingMinutes: number | null;
  ruleFollowingPct: number | null;
  currentLosingStreak: number;
  maxLosingStreak: number;
  currentWinningStreak: number;
  maxWinningStreak: number;
  largestWin: string;
  largestLoss: string;
  returnOnStarting: number | null;
  sampleWarning: boolean;
};

export function computePerformanceStats(
  trades: ClosedTradeStatsInput[],
  startingBalance = "0",
): PerformanceStats {
  const closed = trades.filter((t) => t.result && (!t.status || t.status === "closed"));
  const n = closed.length;
  const wins = closed.filter((t) => t.result === "win");
  const losses = closed.filter((t) => t.result === "loss");
  const bes = closed.filter((t) => t.result === "be");

  const net = closed.reduce((acc, t) => acc.plus(d(t.netPnl)), new Decimal(0));
  const grossProfit = wins.reduce((acc, t) => acc.plus(Decimal.max(d(t.netPnl), 0)), new Decimal(0));
  const grossLossAbs = losses.reduce((acc, t) => acc.plus(d(t.netPnl).abs()), new Decimal(0));

  const profitFactor = grossLossAbs.eq(0) ? null : Number(grossProfit.div(grossLossAbs).toFixed(4));
  const winRate = n === 0 ? null : wins.length / n;
  const lossRate = n === 0 ? null : losses.length / n;
  const beRate = n === 0 ? null : bes.length / n;

  const averageWin = wins.length ? grossProfit.div(wins.length).toFixed(4) : null;
  const averageLoss = losses.length ? grossLossAbs.neg().div(losses.length).toFixed(4) : null;

  const rValues = closed
    .map((t) => (t.rMultiple === null || t.rMultiple === undefined || t.rMultiple === "" ? null : d(t.rMultiple)))
    .filter((v): v is Decimal => v !== null);

  const winR = wins
    .map((t) => (t.rMultiple === null || t.rMultiple === undefined || t.rMultiple === "" ? null : d(t.rMultiple)))
    .filter((v): v is Decimal => v !== null);
  const lossR = losses
    .map((t) => (t.rMultiple === null || t.rMultiple === undefined || t.rMultiple === "" ? null : d(t.rMultiple).abs()))
    .filter((v): v is Decimal => v !== null);

  const averageRr = rValues.length
    ? Number(rValues.reduce((a, b) => a.plus(b), new Decimal(0)).div(rValues.length).toFixed(4))
    : null;
  const averageWinR = winR.length
    ? Number(winR.reduce((a, b) => a.plus(b), new Decimal(0)).div(winR.length).toFixed(4))
    : null;
  const averageLossR = lossR.length
    ? Number(lossR.reduce((a, b) => a.plus(b), new Decimal(0)).div(lossR.length).toFixed(4))
    : null;

  const expectancyR =
    winRate !== null && lossRate !== null && averageWinR !== null && averageLossR !== null
      ? Number(new Decimal(winRate).mul(averageWinR).minus(new Decimal(lossRate).mul(averageLossR)).toFixed(4))
      : null;

  const expectancyCurrency = n === 0 ? null : net.div(n).toFixed(4);

  const sorted = [...closed].sort(
    (a, b) => realizationDate(a).getTime() - realizationDate(b).getTime(),
  );
  let equity = d(startingBalance);
  let peak = equity;
  let maxDd = new Decimal(0);
  let peakAtMaxDd = equity;
  for (const t of sorted) {
    equity = equity.plus(d(t.netPnl));
    if (equity.gt(peak)) peak = equity;
    const dd = peak.minus(equity);
    if (dd.gt(maxDd)) {
      maxDd = dd;
      peakAtMaxDd = peak;
    }
  }
  const maxDrawdownPercent = peakAtMaxDd.gt(0) ? Number(maxDd.div(peakAtMaxDd).mul(100).toFixed(2)) : null;
  const recoveryFactor = maxDd.eq(0) ? null : Number(net.div(maxDd).toFixed(4));

  const holdings = closed.map((t) => t.holdingMinutes).filter((v): v is number => typeof v === "number");
  const averageHoldingMinutes = holdings.length
    ? Math.round(holdings.reduce((a, b) => a + b, 0) / holdings.length)
    : null;

  const planKnown = closed.filter((t) => t.followedPlan !== null && t.followedPlan !== undefined);
  const ruleFollowingPct = planKnown.length
    ? Number(((planKnown.filter((t) => t.followedPlan).length / planKnown.length) * 100).toFixed(1))
    : null;

  let curL = 0;
  let maxL = 0;
  let curW = 0;
  let maxW = 0;
  for (const t of sorted) {
    if (t.result === "loss") {
      curL += 1;
      maxL = Math.max(maxL, curL);
      curW = 0;
    } else if (t.result === "win") {
      curW += 1;
      maxW = Math.max(maxW, curW);
      curL = 0;
    } else {
      curL = 0;
      curW = 0;
    }
  }

  const largestWin = wins.length
    ? wins.reduce((m, t) => Decimal.max(m, d(t.netPnl)), new Decimal(0)).toFixed(4)
    : "0.0000";
  const largestLoss = losses.length
    ? losses.reduce((m, t) => Decimal.min(m, d(t.netPnl)), new Decimal(0)).toFixed(4)
    : "0.0000";

  const start = d(startingBalance);
  const returnOnStarting = start.eq(0) ? null : Number(net.div(start).mul(100).toFixed(2));

  return {
    totalTrades: n,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakEvenTrades: bes.length,
    winRate,
    lossRate,
    beRate,
    netPnl: net.toFixed(4),
    grossProfit: grossProfit.toFixed(4),
    grossLoss: grossLossAbs.neg().toFixed(4),
    profitFactor,
    averageWin,
    averageLoss,
    averageRr,
    averageWinR,
    averageLossR,
    expectancyR,
    expectancyCurrency,
    maxDrawdown: maxDd.toFixed(4),
    maxDrawdownPercent,
    recoveryFactor,
    averageHoldingMinutes,
    ruleFollowingPct,
    currentLosingStreak: curL,
    maxLosingStreak: maxL,
    currentWinningStreak: curW,
    maxWinningStreak: maxW,
    largestWin,
    largestLoss,
    returnOnStarting,
    sampleWarning: n > 0 && n < 20,
  };
}

export function equitySeries(
  trades: ClosedTradeStatsInput[],
  startingBalance = "0",
): { t: string; equity: number; pnl: number; cumulativePnl: number }[] {
  const sorted = trades
    .filter((t) => !t.status || t.status === "closed")
    .sort((a, b) => realizationDate(a).getTime() - realizationDate(b).getTime());
  let equity = d(startingBalance);
  let cum = new Decimal(0);
  const points: { t: string; equity: number; pnl: number; cumulativePnl: number }[] = [
    {
      t: sorted[0] ? realizationDate(sorted[0]).toISOString() : new Date().toISOString(),
      equity: Number(equity.toFixed(2)),
      pnl: 0,
      cumulativePnl: 0,
    },
  ];
  if (!sorted.length) return points;
  points.length = 0;
  for (const trade of sorted) {
    const pnl = d(trade.netPnl);
    equity = equity.plus(pnl);
    cum = cum.plus(pnl);
    points.push({
      t: realizationDate(trade).toISOString(),
      equity: Number(equity.toFixed(2)),
      pnl: Number(pnl.toFixed(2)),
      cumulativePnl: Number(cum.toFixed(2)),
    });
  }
  return points;
}

export function verifyCalculationInvariants(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const longWin = computeTradeMetrics({
    direction: "long",
    entryPrice: "1.10000",
    exitPrice: "1.11000",
    stopLoss: "1.09500",
    takeProfit: "1.11000",
    lotSize: "1",
    positionSize: "1",
    pipSize: "0.0001",
    pipValue: "10",
    tickSize: "0",
    tickValue: "0",
    contractSize: "0",
    commission: "7",
    swap: "0",
    slippage: "0",
    entryAt: new Date("2026-01-01T10:00:00Z"),
    exitAt: new Date("2026-01-01T12:00:00Z"),
  });
  if (longWin.grossPnl !== "1000.0000") failures.push(`long gross expected 1000 got ${longWin.grossPnl}`);
  if (longWin.netPnl !== "993.0000") failures.push(`long net expected 993 got ${longWin.netPnl}`);
  if (longWin.result !== "win") failures.push("long should be win");

  const shortWin = computeTradeMetrics({
    direction: "short",
    entryPrice: "2650.00",
    exitPrice: "2640.00",
    stopLoss: "2655.00",
    takeProfit: "2630.00",
    lotSize: "1",
    positionSize: "1",
    pipSize: "0.1",
    pipValue: "10",
    tickSize: "0",
    tickValue: "0",
    contractSize: "0",
    commission: "0",
    entryAt: new Date("2026-01-01T10:00:00Z"),
    exitAt: new Date("2026-01-01T11:00:00Z"),
  });
  if (shortWin.grossPnl !== "1000.0000") failures.push(`short gold gross expected 1000 got ${shortWin.grossPnl}`);

  const shortLoss = computeTradeMetrics({
    direction: "short",
    entryPrice: "100",
    exitPrice: "110",
    stopLoss: "110",
    lotSize: "1",
    positionSize: "1",
    tickSize: "1",
    tickValue: "1",
    pipSize: "0",
    pipValue: "0",
    contractSize: "0",
    entryAt: new Date(),
    exitAt: new Date(),
  });
  if (shortLoss.result !== "loss") failures.push("short loss not classified");
  if (!new Decimal(shortLoss.netPnl).isNegative()) failures.push("short loss pnl should be negative");

  const pfNone = computePerformanceStats([
    {
      netPnl: "100",
      grossPnl: "100",
      rMultiple: "2",
      result: "win",
      entryAt: new Date(),
      exitAt: new Date(),
    },
  ]);
  if (pfNone.profitFactor !== null) failures.push("profit factor with no losses must be null");

  const empty = computePerformanceStats([]);
  if (empty.totalTrades !== 0 || empty.winRate !== null) failures.push("empty stats incorrect");

  return { ok: failures.length === 0, failures };
}
