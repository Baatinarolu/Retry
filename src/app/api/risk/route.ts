import { db } from "@/db";
import { cashFlows, riskSettings, trades, tradingAccounts } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { calendarDayBounds, zonedDayKey, zonedWeekBounds } from "@/lib/reporting";
import { reportingContextFor } from "@/lib/queries";
import { evaluatePropRisk, phaseBaselineIsStale, propPlanIsActive, type PropRiskEvaluation } from "@/lib/prop-risk";
import { riskCheckSchema, riskSchema } from "@/lib/validations";
import Decimal from "decimal.js";
import { and, eq, gte, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function ownedAccount(userId: string, accountId?: string | null) {
  if (!accountId) return null;
  const [account] = await db
    .select()
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)));
  return account ?? null;
}

async function storedPropRisk(
  userId: string,
  account: typeof tradingAccounts.$inferSelect,
  settings: typeof riskSettings.$inferSelect,
  plannedRisk: string | number,
  timeZone: string,
  dayWindow?: { start: Date; end: Date },
): Promise<PropRiskEvaluation | null> {
  if (!propPlanIsActive(settings.propPlan)) return null;
  const { start, end } = dayWindow ?? calendarDayBounds(zonedDayKey(new Date(), timeZone), timeZone);
  const [history, historyCashFlows] = await Promise.all([
    db.select().from(trades).where(and(eq(trades.userId, userId), eq(trades.accountId, account.id))),
    db.select().from(cashFlows).where(and(eq(cashFlows.userId, userId), eq(cashFlows.accountId, account.id))),
  ]);
  return evaluatePropRisk({
    plan: settings.propPlan,
    startingBalance: account.startingBalance,
    currentBalance: account.currentBalance,
    trades: history,
    cashFlows: historyCashFlows,
    dayStart: start,
    dayEnd: end,
    plannedRisk,
  });
}

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  const accountId = new URL(req.url).searchParams.get("accountId");
  const requestedAccount = accountId ? await ownedAccount(session!.uid, accountId) : null;
  if (accountId && !requestedAccount) return jsonError("Account not found", 404);
  const list = await db.select().from(riskSettings).where(eq(riskSettings.userId, session!.uid));
  const settings = accountId ? list.find((row) => row.accountId === accountId) : list[0];
  if (accountId && !settings) return jsonError("No risk profile for this account", 404);
  const account = requestedAccount ?? (settings?.accountId ? await ownedAccount(session!.uid, settings.accountId) : null);
  const propRisk = account && settings ? await storedPropRisk(session!.uid, account, settings, "0", user!.timezone) : null;
  return NextResponse.json({ settings, all: list, propRisk });
}

export async function PATCH(req: NextRequest) {
  const { session, user, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = riskSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid risk settings");
  const account = parsed.data.accountId ? await ownedAccount(session!.uid, parsed.data.accountId) : null;
  if (parsed.data.accountId && !account) return jsonError("Account not found", 404);
  if (parsed.data.propPlan && (propPlanIsActive(parsed.data.propPlan) || parsed.data.propPlan.firmName || parsed.data.propPlan.phases.length > 0)) {
    if (!account) return jsonError("Select an individual prop account before saving prop rules");
    if (account.accountType !== "prop") return jsonError("Prop rules can only be enabled on a prop account");
  }
  if (parsed.data.propPlan?.phaseStartedAt && new Date(parsed.data.propPlan.phaseStartedAt).getTime() > Date.now()) {
    return jsonError("Phase start time cannot be in the future");
  }

  const list = await db.select().from(riskSettings).where(eq(riskSettings.userId, session!.uid));
  const current = parsed.data.accountId
    ? list.find((row) => row.accountId === parsed.data.accountId)
    : list[0];
  if (!current) return jsonError("No risk profile yet", 404);
  if (parsed.data.propPlan && phaseBaselineIsStale(current.propPlan, parsed.data.propPlan)) {
    return jsonError("Set a new phase start time and confirm the starting balance when changing the active phase");
  }
  const value = (next: string | number | undefined, previous: string) =>
    next === undefined || next === "" ? previous : String(next);
  const [row] = await db
    .update(riskSettings)
    .set({
      defaultRiskPercent: value(parsed.data.defaultRiskPercent, current.defaultRiskPercent),
      maxDailyLoss: value(parsed.data.maxDailyLoss, current.maxDailyLoss),
      maxWeeklyLoss: value(parsed.data.maxWeeklyLoss, current.maxWeeklyLoss),
      maxTradesPerDay: parsed.data.maxTradesPerDay ?? current.maxTradesPerDay,
      maxConsecutiveLosses: parsed.data.maxConsecutiveLosses ?? current.maxConsecutiveLosses,
      maxOpenRisk: value(parsed.data.maxOpenRisk, current.maxOpenRisk),
      minPlannedRr: value(parsed.data.minPlannedRr, current.minPlannedRr),
      dailyProfitTarget: value(parsed.data.dailyProfitTarget, current.dailyProfitTarget),
      maxPositionSize: value(parsed.data.maxPositionSize, current.maxPositionSize),
      personalRules: parsed.data.personalRules ?? current.personalRules,
      propPlan: parsed.data.propPlan ?? current.propPlan,
      updatedAt: new Date(),
    })
    .where(eq(riskSettings.id, current.id))
    .returning();
  const propRisk = account ? await storedPropRisk(session!.uid, account, row, "0", user!.timezone) : null;
  return NextResponse.json({ settings: row, propRisk });
}

export async function POST(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  const parsed = riskCheckSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid risk check");
  const { accountId } = parsed.data;
  const account = await ownedAccount(session!.uid, accountId);
  if (accountId && !account) return jsonError("Account not found", 404);
  if (!accountId) {
    try {
      await reportingContextFor(session!.uid);
    } catch (cause) {
      return jsonError(cause instanceof Error ? cause.message : "Select an account for risk checks");
    }
  }
  const plannedRisk = Number(parsed.data.plannedRisk);
  const plannedRr = Number(parsed.data.plannedRr);
  const positionSize = Number(parsed.data.positionSize);

  const list = await db.select().from(riskSettings).where(eq(riskSettings.userId, session!.uid));
  const settings = accountId ? list.find((row) => row.accountId === accountId) : list[0];
  if (accountId && !settings) return jsonError("No risk profile for this account", 404);

  const timeZone = user!.timezone;
  const now = new Date();
  const today = zonedDayKey(now, timeZone);
  const { start, end: tomorrow } = calendarDayBounds(today, timeZone);
  const { start: week, end: nextWeek } = zonedWeekBounds(now, timeZone);
  const accountFilter = accountId ? eq(trades.accountId, accountId) : undefined;

  const [todayEntries, todayTrades, weekTrades, openTrades] = await Promise.all([
    db
      .select()
      .from(trades)
      .where(and(eq(trades.userId, session!.uid), accountFilter, gte(trades.entryAt, start), lt(trades.entryAt, tomorrow))),
    db
      .select()
      .from(trades)
      .where(and(eq(trades.userId, session!.uid), accountFilter, gte(trades.realizedAt, start), lt(trades.realizedAt, tomorrow))),
    db
      .select()
      .from(trades)
      .where(and(eq(trades.userId, session!.uid), accountFilter, gte(trades.realizedAt, week), lt(trades.realizedAt, nextWeek))),
    db
      .select()
      .from(trades)
      .where(and(eq(trades.userId, session!.uid), accountFilter, eq(trades.status, "open"))),
  ]);

  const sumPnl = (rows: typeof todayTrades) =>
    rows.reduce((sum, trade) => sum.plus(trade.netPnl), new Decimal(0)).toNumber();
  const dailyPnl = sumPnl(todayTrades);
  const weeklyPnl = sumPnl(weekTrades);
  const openRisk = openTrades.reduce((sum, trade) => sum.plus(trade.initialRisk), new Decimal(0)).toNumber();
  let streak = 0;
  const sorted = [...todayTrades]
    .filter((trade) => trade.status === "closed")
    .sort((a, b) => (b.realizedAt ?? b.exitAt ?? b.entryAt).getTime() - (a.realizedAt ?? a.exitAt ?? a.entryAt).getTime());
  for (const trade of sorted) {
    if (trade.result === "loss") streak += 1;
    else break;
  }

  const warnings: string[] = [];
  if (settings) {
    if (Number(settings.maxDailyLoss) > 0 && dailyPnl - plannedRisk <= -Number(settings.maxDailyLoss)) {
      warnings.push("This idea may exceed the maximum daily loss.");
    }
    if (Number(settings.maxWeeklyLoss) > 0 && weeklyPnl - plannedRisk <= -Number(settings.maxWeeklyLoss)) {
      warnings.push("This idea may exceed the maximum weekly loss.");
    }
    if (settings.maxTradesPerDay > 0 && todayEntries.length >= settings.maxTradesPerDay) {
      warnings.push("Maximum trades per day already reached.");
    }
    if (settings.maxConsecutiveLosses > 0 && streak >= settings.maxConsecutiveLosses) {
      warnings.push("Consecutive loss limit already reached.");
    }
    if (Number(settings.minPlannedRr) > 0 && plannedRr > 0 && plannedRr < Number(settings.minPlannedRr)) {
      warnings.push(`Planned R:R ${plannedRr.toFixed(2)} is below your minimum ${settings.minPlannedRr}.`);
    }
    if (Number(settings.maxPositionSize) > 0 && positionSize > Number(settings.maxPositionSize)) {
      warnings.push("Position size exceeds the configured maximum.");
    }
    if (Number(settings.maxOpenRisk) > 0 && openRisk + plannedRisk > Number(settings.maxOpenRisk)) {
      warnings.push("This idea may exceed the maximum open-risk allowance.");
    }
    if (Number(settings.dailyProfitTarget) > 0 && dailyPnl >= Number(settings.dailyProfitTarget)) {
      warnings.push("Daily profit target reached. Your rules say to protect the day.");
    }
    if (account && Number(settings.defaultRiskPercent) > 0) {
      const allowed = new Decimal(account.currentBalance).mul(settings.defaultRiskPercent).div(100).toNumber();
      if (plannedRisk > allowed) {
        warnings.push(`Planned risk exceeds your default ${settings.defaultRiskPercent}% allowance (${allowed.toFixed(2)}).`);
      }
    }
  }

  let propRisk: PropRiskEvaluation | null = null;
  if (account && settings && propPlanIsActive(settings.propPlan)) {
    propRisk = await storedPropRisk(session!.uid, account, settings, parsed.data.plannedRisk, timeZone, { start, end: tomorrow });
    warnings.push(...(propRisk?.warnings ?? []));
  } else if (!account && settings && propPlanIsActive(settings.propPlan)) {
    warnings.push("Select an individual prop account to evaluate its percentage drawdown and phase rules.");
  }

  const dailyLossRemainders = [
    settings && Number(settings.maxDailyLoss) > 0 ? Number(settings.maxDailyLoss) + dailyPnl : null,
    propRisk?.daily ? Number(propRisk.daily.remaining) : null,
  ].filter((value): value is number => value !== null);

  return NextResponse.json({
    warnings,
    remainingDailyLoss: dailyLossRemainders.length ? Math.min(...dailyLossRemainders) : null,
    propRisk,
    tradesToday: todayEntries.length,
    realizedTradesToday: todayTrades.length,
    consecutiveLosses: streak,
    timezone: timeZone,
    dailyPnl,
    weeklyPnl,
    openRisk,
    settings,
  });
}
