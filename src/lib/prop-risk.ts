import Decimal from "decimal.js";

export type DailyDrawdownBasis = "initial_balance" | "day_start_balance";
export type MaxDrawdownMode = "initial_balance" | "trailing_balance";

export type PropPhase = {
  id: string;
  name: string;
  targetPercent: string;
};

export type PropPlan = {
  firmName: string;
  phases: PropPhase[];
  currentPhaseId: string;
  phaseStartedAt: string;
  phaseStartBalance: string;
  dailyDrawdownPercent: string;
  dailyDrawdownBasis: DailyDrawdownBasis;
  maxDrawdownPercent: string;
  maxDrawdownMode: MaxDrawdownMode;
};

export function defaultPropPlan(): PropPlan {
  return {
    firmName: "",
    phases: [],
    currentPhaseId: "",
    phaseStartedAt: "",
    phaseStartBalance: "",
    dailyDrawdownPercent: "0",
    dailyDrawdownBasis: "initial_balance",
    maxDrawdownPercent: "0",
    maxDrawdownMode: "initial_balance",
  };
}

export function propPlanIsActive(plan: PropPlan | null | undefined) {
  if (!plan) return false;
  const currentPhase = plan.phases.find((phase) => phase.id === plan.currentPhaseId);
  return Number(plan.dailyDrawdownPercent) > 0 || Number(plan.maxDrawdownPercent) > 0 || Number(currentPhase?.targetPercent || 0) > 0;
}

export function phaseBaselineIsStale(previous: PropPlan, next: PropPlan) {
  return Boolean(
    next.currentPhaseId
    && next.currentPhaseId !== previous.currentPhaseId
    && next.phaseStartedAt === previous.phaseStartedAt,
  );
}

export type PropRiskTrade = {
  id: string;
  netPnl: string | number;
  entryAt: Date;
  exitAt?: Date | null;
  realizedAt?: Date | null;
  createdAt: Date;
};

export type PropRiskCashFlow = {
  id: string;
  amount: string | number;
  occurredAt: Date;
  createdAt: Date;
};

export type PropRiskEvaluation = {
  warnings: string[];
  daily: {
    basis: DailyDrawdownBasis;
    percent: string;
    limit: string;
    remaining: string;
    dayStartBalance: string;
  } | null;
  overall: {
    mode: MaxDrawdownMode;
    percent: string;
    limit: string;
    floor: string;
    currentTradingBalance: string;
    peakTradingBalance: string;
    currentDrawdown: string;
    prospectiveDrawdown: string;
  } | null;
  phase: {
    id: string;
    name: string;
    targetPercent: string;
    targetAmount: string;
    realizedPnl: string;
    remaining: string;
    progressPercent: string;
    achieved: boolean;
    startedAt: string;
    phaseStartBalance: string;
  } | null;
};

function decimal(value: string | number) {
  const result = new Decimal(value);
  if (!result.isFinite()) throw new Error("Prop risk records contain a non-finite number");
  return result;
}

function realization(trade: PropRiskTrade) {
  return trade.realizedAt ?? trade.exitAt ?? trade.entryAt;
}

/**
 * Evaluates recorded trading history only. Open-trade equity and unrecorded
 * broker ticks are never inferred. Cash movements affect only the day-start
 * recorded balance, not phase targets or overall trading drawdown.
 */
export function evaluatePropRisk({
  plan,
  startingBalance,
  currentBalance,
  trades,
  cashFlows,
  dayStart,
  dayEnd,
  plannedRisk,
}: {
  plan: PropPlan;
  startingBalance: string | number;
  currentBalance: string | number;
  trades: PropRiskTrade[];
  cashFlows: PropRiskCashFlow[];
  dayStart: Date;
  dayEnd: Date;
  plannedRisk: string | number;
}): PropRiskEvaluation {
  const warnings: string[] = [];
  const initial = decimal(startingBalance);
  const currentRecorded = decimal(currentBalance);
  const planned = decimal(plannedRisk);
  const startMs = dayStart.getTime();
  const endMs = dayEnd.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) throw new Error("Invalid daily drawdown window");

  const ordered = [...trades].sort((left, right) =>
    realization(left).getTime() - realization(right).getTime()
    || left.createdAt.getTime() - right.createdAt.getTime()
    || left.id.localeCompare(right.id));
  const todayTrades = ordered.filter((trade) => {
    const time = realization(trade).getTime();
    return time >= startMs && time < endMs;
  });
  const todayPnl = todayTrades.reduce((sum, trade) => sum.plus(decimal(trade.netPnl)), new Decimal(0));
  const todayCash = cashFlows
    .filter((flow) => flow.occurredAt.getTime() >= startMs && flow.occurredAt.getTime() < endMs)
    .reduce((sum, flow) => sum.plus(decimal(flow.amount)), new Decimal(0));
  const dayStartBalance = currentRecorded.minus(todayPnl).minus(todayCash);

  const currentPhase = plan.phases.find((candidate) => candidate.id === plan.currentPhaseId);
  let phaseContext: { start: Date; balance: Decimal } | null = null;
  if (currentPhase && propPlanIsActive(plan)) {
    const start = new Date(plan.phaseStartedAt);
    const balance = decimal(plan.phaseStartBalance || "0");
    if (Number.isNaN(start.getTime()) || balance.lte(0)) {
      return {
        warnings: ["The active phase needs a valid start time and positive starting balance before its rules can be evaluated."],
        daily: null,
        overall: null,
        phase: null,
      };
    }
    phaseContext = { start, balance };
  }
  const performanceTrades = phaseContext
    ? ordered.filter((trade) => realization(trade).getTime() >= phaseContext.start.getTime())
    : ordered;
  const performanceInitial = phaseContext?.balance ?? initial;

  let daily: PropRiskEvaluation["daily"] = null;
  const dailyPercent = decimal(plan.dailyDrawdownPercent || "0");
  if (dailyPercent.gt(0)) {
    const basis = plan.dailyDrawdownBasis === "day_start_balance" ? dayStartBalance : performanceInitial;
    if (basis.lte(0)) {
      warnings.push("The selected daily drawdown balance basis is not positive, so the percentage rule cannot be evaluated safely.");
    } else {
      const limit = basis.mul(dailyPercent).div(100);
      const remaining = limit.plus(todayPnl);
      if (todayPnl.minus(planned).lte(limit.neg())) {
        warnings.push(`This idea may exceed the ${plan.dailyDrawdownBasis === "day_start_balance" ? "day-start" : "initial-balance"} daily drawdown allowance of ${plan.dailyDrawdownPercent}%.`);
      }
      daily = {
        basis: plan.dailyDrawdownBasis,
        percent: plan.dailyDrawdownPercent,
        limit: limit.toFixed(4),
        remaining: remaining.toFixed(4),
        dayStartBalance: dayStartBalance.toFixed(4),
      };
    }
  }

  let currentTradingBalance = performanceInitial;
  let peakTradingBalance = performanceInitial;
  for (const trade of performanceTrades) {
    currentTradingBalance = currentTradingBalance.plus(decimal(trade.netPnl));
    if (currentTradingBalance.gt(peakTradingBalance)) peakTradingBalance = currentTradingBalance;
  }

  let overall: PropRiskEvaluation["overall"] = null;
  const maxPercent = decimal(plan.maxDrawdownPercent || "0");
  if (maxPercent.gt(0)) {
    const trailing = plan.maxDrawdownMode === "trailing_balance";
    const basis = trailing ? peakTradingBalance : performanceInitial;
    if (basis.lte(0)) {
      warnings.push("The selected maximum drawdown balance basis is not positive, so the percentage rule cannot be evaluated safely.");
    } else {
      const limit = basis.mul(maxPercent).div(100);
      const floor = basis.minus(limit);
      const currentDrawdown = Decimal.max(basis.minus(currentTradingBalance), 0);
      const prospectiveBalance = currentTradingBalance.minus(planned);
      const prospectiveDrawdown = Decimal.max(basis.minus(prospectiveBalance), 0);
      if (prospectiveBalance.lte(floor)) {
        warnings.push(`This idea may exceed the ${trailing ? "trailing recorded-peak" : "initial-balance"} maximum drawdown allowance of ${plan.maxDrawdownPercent}%.`);
      }
      overall = {
        mode: plan.maxDrawdownMode,
        percent: plan.maxDrawdownPercent,
        limit: limit.toFixed(4),
        floor: floor.toFixed(4),
        currentTradingBalance: currentTradingBalance.toFixed(4),
        peakTradingBalance: peakTradingBalance.toFixed(4),
        currentDrawdown: currentDrawdown.toFixed(4),
        prospectiveDrawdown: prospectiveDrawdown.toFixed(4),
      };
    }
  }

  let phase: PropRiskEvaluation["phase"] = null;
  if (currentPhase && phaseContext && decimal(currentPhase.targetPercent || "0").gt(0)) {
    const realizedPnl = performanceTrades.reduce((sum, trade) => sum.plus(decimal(trade.netPnl)), new Decimal(0));
    const targetAmount = phaseContext.balance.mul(currentPhase.targetPercent).div(100);
    const remaining = targetAmount.minus(realizedPnl);
    const achieved = realizedPnl.gte(targetAmount);
    if (achieved) warnings.push(`${currentPhase.name} profit target reached. Your prop rules say to protect the completed phase.`);
    phase = {
      id: currentPhase.id,
      name: currentPhase.name,
      targetPercent: currentPhase.targetPercent,
      targetAmount: targetAmount.toFixed(4),
      realizedPnl: realizedPnl.toFixed(4),
      remaining: remaining.toFixed(4),
      progressPercent: realizedPnl.div(targetAmount).mul(100).toFixed(2),
      achieved,
      startedAt: phaseContext.start.toISOString(),
      phaseStartBalance: phaseContext.balance.toFixed(4),
    };
  }

  return { warnings, daily, overall, phase };
}
