import { db } from "@/db";
import {
  psychologyRecords,
  screenshots,
  strategies,
  tags,
  tradeExecutions,
  tradeTags,
  trades,
  tradingAccounts,
  users,
} from "@/db/schema";
import Decimal from "decimal.js";
import { and, eq, inArray } from "drizzle-orm";
import { computeTradeMetrics, type Direction } from "./calculations";
import { deleteScreenshotFiles } from "./screenshot-storage";

export type TradePayload = {
  accountId: string;
  strategyId?: string | null;
  instrument: string;
  marketCategory?: string;
  direction: "long" | "short";
  tradeType?: string;
  session?: string;
  timezone?: string;
  entryAt: string;
  exitAt?: string | null;
  entryPrice?: string | number | null;
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
  overrideNetPnl?: string | number | null;
  pnlOverridden?: boolean;
  status?: "open" | "closed";
  marketBias?: string;
  htfDirection?: string;
  entryTimeframe?: string;
  htfTimeframe?: string;
  marketStructure?: string;
  entryModel?: string;
  confluence?: string;
  entryReason?: string;
  slJustification?: string;
  tpJustification?: string;
  invalidation?: string;
  plannedExit?: string;
  followedPlan?: boolean;
  newsRelated?: boolean;
  notes?: string;
  tagIds?: string[];
  executions?: {
    type: "entry" | "scale_in" | "scale_out" | "exit";
    price: string | number;
    quantity: string | number;
    executedAt: string;
    fees?: string | number;
    notes?: string;
  }[];
  psychology?: {
    emotionBefore?: string;
    emotionDuring?: string;
    emotionAfter?: string;
    confidence?: number;
    patience?: number;
    fomo?: boolean;
    fear?: boolean;
    greed?: boolean;
    revenge?: boolean;
    overtrading?: boolean;
    hesitation?: boolean;
    impulsive?: boolean;
    earlyExit?: boolean;
    movedStop?: boolean;
    brokeRiskRules?: boolean;
    followedPlan?: boolean;
    lessons?: string;
    didWell?: string;
    improve?: string;
    reflection?: string;
  };
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const blank = (value: unknown) => value === null || value === undefined || value === "";

function str(value: string | number | null | undefined) {
  return blank(value) ? null : String(value);
}

function str0(value: string | number | null | undefined) {
  return blank(value) ? "0" : String(value);
}

function firstValue(...values: (string | number | null | undefined)[]) {
  return values.find((value) => !blank(value));
}

async function lockUser(tx: Tx, userId: string) {
  const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
  if (!user) throw new Error("User not found");
}

async function lockAccount(tx: Tx, userId: string, accountId: string) {
  const [account] = await tx
    .select()
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)))
    .for("update");
  if (!account) throw new Error("Account not found");
  return account;
}

async function validateRelations(tx: Tx, userId: string, payload: TradePayload) {
  if (payload.strategyId) {
    const [strategy] = await tx
      .select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, payload.strategyId), eq(strategies.userId, userId)));
    if (!strategy) throw new Error("Strategy not found");
  }

  const tagIds = [...new Set(payload.tagIds ?? [])];
  if (tagIds.length) {
    const owned = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.userId, userId), inArray(tags.id, tagIds)));
    if (owned.length !== tagIds.length) throw new Error("One or more tags were not found");
  }
  return tagIds;
}

async function nextDisplayId(tx: Tx, userId: string) {
  const year = new Date().getUTCFullYear();
  const prefix = `TM-${year}-`;
  const rows = await tx.select({ displayId: trades.displayId }).from(trades).where(eq(trades.userId, userId));
  const highest = rows.reduce((max, row) => {
    if (!row.displayId.startsWith(prefix)) return max;
    const sequence = Number(row.displayId.slice(prefix.length));
    return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, "0")}`;
}

function calculate(payload: TradePayload) {
  const closed = payload.status !== "open";
  const entryAt = new Date(payload.entryAt);
  if (Number.isNaN(entryAt.getTime())) throw new Error("Invalid entry time");
  if (blank(payload.entryPrice)) throw new Error("Entry price is required");

  const exitAt = closed && payload.exitAt ? new Date(payload.exitAt) : null;
  if (closed && !exitAt) throw new Error("Closed trades require an exit time");
  if (exitAt && Number.isNaN(exitAt.getTime())) throw new Error("Invalid exit time");
  if (exitAt && exitAt < entryAt) throw new Error("Exit time cannot be before entry time");
  if (closed && blank(payload.exitPrice)) throw new Error("Closed trades require an exit price");
  if (payload.pnlOverridden && blank(payload.overrideNetPnl)) throw new Error("Manual net P&L is required");

  const metrics = computeTradeMetrics({
    direction: payload.direction as Direction,
    entryPrice: str0(payload.entryPrice),
    exitPrice: closed ? payload.exitPrice : null,
    stopLoss: payload.stopLoss,
    takeProfit: payload.takeProfit,
    positionSize: payload.positionSize,
    lotSize: payload.lotSize,
    contractSize: payload.contractSize,
    tickSize: payload.tickSize,
    tickValue: payload.tickValue,
    pipSize: payload.pipSize,
    pipValue: payload.pipValue,
    commission: payload.commission,
    swap: payload.swap,
    slippage: payload.slippage,
    overrideNetPnl: payload.pnlOverridden ? payload.overrideNetPnl : null,
    entryAt,
    exitAt,
  });
  return { closed, entryAt, exitAt, metrics };
}

function valuesFor(
  payload: TradePayload,
  calculated: ReturnType<typeof calculate>,
): Omit<typeof trades.$inferInsert, "userId" | "accountId" | "displayId" | "balanceBefore" | "balanceAfter"> {
  const { closed, entryAt, exitAt, metrics } = calculated;
  return {
    strategyId: payload.strategyId || null,
    instrument: payload.instrument.trim(),
    marketCategory: payload.marketCategory || "forex",
    direction: payload.direction,
    tradeType: payload.tradeType || "intraday",
    session: payload.session || "london",
    timezone: payload.timezone || "UTC",
    entryAt,
    exitAt,
    entryPrice: str0(payload.entryPrice),
    exitPrice: closed ? str(payload.exitPrice) : null,
    stopLoss: str(payload.stopLoss),
    takeProfit: str(payload.takeProfit),
    positionSize: str0(firstValue(payload.positionSize, payload.lotSize, "1")),
    lotSize: str0(firstValue(payload.lotSize, payload.positionSize, "1")),
    contractSize: str0(firstValue(payload.contractSize, "1")),
    tickSize: str0(payload.tickSize),
    tickValue: str0(payload.tickValue),
    pipSize: str0(firstValue(payload.pipSize, "0.0001")),
    pipValue: str0(firstValue(payload.pipValue, "10")),
    commission: str0(payload.commission),
    swap: str0(payload.swap),
    slippage: str0(payload.slippage),
    grossPnl: closed ? metrics.grossPnl : "0",
    netPnl: closed ? metrics.netPnl : "0",
    initialRisk: metrics.initialRisk,
    plannedRr: metrics.plannedRr,
    actualRr: closed ? metrics.actualRr : null,
    rMultiple: closed ? metrics.rMultiple : null,
    status: closed ? "closed" : "open",
    result: closed ? metrics.result : "be",
    marketBias: payload.marketBias || "",
    htfDirection: payload.htfDirection || "",
    entryTimeframe: payload.entryTimeframe || "15m",
    htfTimeframe: payload.htfTimeframe || "4h",
    marketStructure: payload.marketStructure || "",
    entryModel: payload.entryModel || "",
    confluence: payload.confluence || "",
    entryReason: payload.entryReason || "",
    slJustification: payload.slJustification || "",
    tpJustification: payload.tpJustification || "",
    invalidation: payload.invalidation || "",
    plannedExit: payload.plannedExit || "",
    followedPlan: payload.followedPlan ?? true,
    newsRelated: payload.newsRelated ?? false,
    notes: payload.notes || "",
    holdingMinutes: closed ? metrics.holdingMinutes : null,
    pnlOverridden: closed ? (payload.pnlOverridden ?? false) : false,
  };
}

function executionValues(tradeId: string, userId: string, payload: TradePayload) {
  return (payload.executions ?? []).map((execution) => ({
    tradeId,
    userId,
    type: execution.type,
    price: String(execution.price),
    quantity: String(execution.quantity),
    executedAt: new Date(execution.executedAt),
    fees: String(execution.fees ?? 0),
    notes: execution.notes || "",
  }));
}

function psychologyValues(payload: TradePayload) {
  const p = payload.psychology;
  if (!p) return null;
  return {
    emotionBefore: p.emotionBefore || "",
    emotionDuring: p.emotionDuring || "",
    emotionAfter: p.emotionAfter || "",
    confidence: p.confidence ?? 5,
    patience: p.patience ?? 5,
    fomo: p.fomo ?? false,
    fear: p.fear ?? false,
    greed: p.greed ?? false,
    revenge: p.revenge ?? false,
    overtrading: p.overtrading ?? false,
    hesitation: p.hesitation ?? false,
    impulsive: p.impulsive ?? false,
    earlyExit: p.earlyExit ?? false,
    movedStop: p.movedStop ?? false,
    brokeRiskRules: p.brokeRiskRules ?? false,
    followedPlan: p.followedPlan ?? payload.followedPlan ?? true,
    lessons: p.lessons || "",
    didWell: p.didWell || "",
    improve: p.improve || "",
    reflection: p.reflection || "",
  };
}

export async function createTrade(userId: string, payload: TradePayload) {
  const calculated = calculate(payload);
  return db.transaction(async (tx) => {
    // Serializing writes per user protects both balances and human-readable display IDs.
    await lockUser(tx, userId);
    const account = await lockAccount(tx, userId, payload.accountId);
    const tagIds = await validateRelations(tx, userId, payload);
    const displayId = await nextDisplayId(tx, userId);
    const balanceBefore = new Decimal(account.currentBalance);
    const balanceAfter = calculated.closed ? balanceBefore.plus(calculated.metrics.netPnl) : balanceBefore;

    const [trade] = await tx
      .insert(trades)
      .values({
        userId,
        accountId: account.id,
        displayId,
        ...valuesFor(payload, calculated),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
      })
      .returning();

    if (calculated.closed) {
      await tx
        .update(tradingAccounts)
        .set({ currentBalance: balanceAfter.toFixed(2), updatedAt: new Date() })
        .where(eq(tradingAccounts.id, account.id));
    }

    const executions = executionValues(trade.id, userId, payload);
    if (executions.length) await tx.insert(tradeExecutions).values(executions);
    if (tagIds.length) await tx.insert(tradeTags).values(tagIds.map((tagId) => ({ tradeId: trade.id, tagId })));
    const psychology = psychologyValues(payload);
    if (psychology) await tx.insert(psychologyRecords).values({ tradeId: trade.id, userId, ...psychology });
    return trade;
  });
}

export async function updateTrade(userId: string, tradeId: string, payload: TradePayload) {
  const calculated = calculate(payload);
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [existing] = await tx
      .select()
      .from(trades)
      .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
      .for("update");
    if (!existing) return null;

    const oldAccount = await lockAccount(tx, userId, existing.accountId);
    const destination = payload.accountId === existing.accountId
      ? oldAccount
      : await lockAccount(tx, userId, payload.accountId);
    const tagIds = await validateRelations(tx, userId, payload);
    const oldNet = existing.status === "closed" ? new Decimal(existing.netPnl) : new Decimal(0);
    const newNet = calculated.closed ? new Decimal(calculated.metrics.netPnl) : new Decimal(0);
    let balanceBefore: Decimal;
    let balanceAfter: Decimal;

    if (oldAccount.id === destination.id) {
      const accountWithoutOldTrade = new Decimal(destination.currentBalance).minus(oldNet);
      const updatedBalance = accountWithoutOldTrade.plus(newNet);
      balanceBefore = existing.balanceBefore ? new Decimal(existing.balanceBefore) : accountWithoutOldTrade;
      balanceAfter = calculated.closed ? balanceBefore.plus(newNet) : accountWithoutOldTrade;
      await tx
        .update(tradingAccounts)
        .set({ currentBalance: updatedBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(tradingAccounts.id, destination.id));
    } else {
      const oldBalance = new Decimal(oldAccount.currentBalance).minus(oldNet);
      balanceBefore = new Decimal(destination.currentBalance);
      balanceAfter = balanceBefore.plus(newNet);
      await tx
        .update(tradingAccounts)
        .set({ currentBalance: oldBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(tradingAccounts.id, oldAccount.id));
      await tx
        .update(tradingAccounts)
        .set({ currentBalance: balanceAfter.toFixed(2), updatedAt: new Date() })
        .where(eq(tradingAccounts.id, destination.id));
    }

    const [trade] = await tx
      .update(trades)
      .set({
        accountId: destination.id,
        ...valuesFor(payload, calculated),
        balanceBefore: balanceBefore.toFixed(2),
        balanceAfter: balanceAfter.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(trades.id, tradeId))
      .returning();

    await tx.delete(tradeTags).where(eq(tradeTags.tradeId, tradeId));
    if (tagIds.length) await tx.insert(tradeTags).values(tagIds.map((tagId) => ({ tradeId, tagId })));
    await tx.delete(tradeExecutions).where(eq(tradeExecutions.tradeId, tradeId));
    const executions = executionValues(tradeId, userId, payload);
    if (executions.length) await tx.insert(tradeExecutions).values(executions);

    const psychology = psychologyValues(payload);
    if (psychology) {
      const [existingPsychology] = await tx
        .select({ id: psychologyRecords.id })
        .from(psychologyRecords)
        .where(eq(psychologyRecords.tradeId, tradeId));
      if (existingPsychology) {
        await tx.update(psychologyRecords).set(psychology).where(eq(psychologyRecords.id, existingPsychology.id));
      } else {
        await tx.insert(psychologyRecords).values({ tradeId, userId, ...psychology });
      }
    }
    return trade;
  });
}

export async function deleteTrade(userId: string, tradeId: string) {
  const files = await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [existing] = await tx
      .select()
      .from(trades)
      .where(and(eq(trades.id, tradeId), eq(trades.userId, userId)))
      .for("update");
    if (!existing) return null;

    if (existing.status === "closed") {
      const account = await lockAccount(tx, userId, existing.accountId);
      const restored = new Decimal(account.currentBalance).minus(existing.netPnl);
      await tx
        .update(tradingAccounts)
        .set({ currentBalance: restored.toFixed(2), updatedAt: new Date() })
        .where(eq(tradingAccounts.id, account.id));
    }

    const shots = await tx
      .select({ fileName: screenshots.fileName })
      .from(screenshots)
      .where(eq(screenshots.tradeId, tradeId));
    await tx.delete(trades).where(eq(trades.id, tradeId));
    return shots.map((shot) => shot.fileName);
  });

  if (!files) return false;
  await deleteScreenshotFiles(userId, files).catch(() => undefined);
  return true;
}
