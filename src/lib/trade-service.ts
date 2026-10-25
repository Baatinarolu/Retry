import { db } from "@/db";
import {
  cashFlows,
  importBatches,
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
import { and, eq, inArray } from "drizzle-orm";
import { buildAccountBalanceSnapshots } from "./accounting";
import { computeTradeMetrics, type Direction } from "./calculations";
import { calculateExecutionLedger, type ExecutionLedger } from "./execution-ledger";
import { deleteScreenshotFiles } from "./screenshot-storage";

export type TradePayload = {
  accountId: string;
  importBatchId?: string | null;
  sourceKey?: string | null;
  sourceHash?: string | null;
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
  if (payload.pnlOverridden && blank(payload.overrideNetPnl)) throw new Error("Manual net P&L is required");

  if (payload.executions?.length) {
    const ledger = calculateExecutionLedger({
      direction: payload.direction,
      status: payload.status ?? "closed",
      executions: payload.executions,
      stopLoss: payload.stopLoss,
      takeProfit: payload.takeProfit,
      contractSize: payload.contractSize,
      tickSize: payload.tickSize,
      tickValue: payload.tickValue,
      pipSize: payload.pipSize,
      pipValue: payload.pipValue,
      commission: payload.commission,
      swap: payload.swap,
      slippage: payload.slippage,
      overrideNetPnl: payload.pnlOverridden ? payload.overrideNetPnl : null,
    });
    return {
      closed: ledger.status === "closed",
      executionBased: true,
      entryAt: ledger.entryAt,
      exitAt: ledger.exitAt,
      realizedAt: ledger.realizedAt,
      metrics: ledger.metrics,
      ledger,
    };
  }

  const closed = payload.status !== "open";
  const entryAt = new Date(payload.entryAt);
  if (Number.isNaN(entryAt.getTime())) throw new Error("Invalid entry time");
  if (blank(payload.entryPrice)) throw new Error("Entry price is required");

  const exitAt = closed && payload.exitAt ? new Date(payload.exitAt) : null;
  if (closed && !exitAt) throw new Error("Closed trades require an exit time");
  if (exitAt && Number.isNaN(exitAt.getTime())) throw new Error("Invalid exit time");
  if (exitAt && exitAt < entryAt) throw new Error("Exit time cannot be before entry time");
  if (closed && blank(payload.exitPrice)) throw new Error("Closed trades require an exit price");

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
  return { closed, executionBased: false, entryAt, exitAt, realizedAt: closed ? exitAt : null, metrics, ledger: null };
}

function valuesFor(
  payload: TradePayload,
  calculated: ReturnType<typeof calculate>,
): Omit<typeof trades.$inferInsert, "userId" | "accountId" | "displayId" | "balanceBefore" | "balanceAfter"> {
  const { closed, entryAt, exitAt, realizedAt, metrics, ledger, executionBased } = calculated;
  return {
    importBatchId: payload.importBatchId || null,
    sourceKey: payload.sourceKey || null,
    sourceHash: payload.sourceHash || null,
    strategyId: payload.strategyId || null,
    instrument: payload.instrument.trim(),
    marketCategory: payload.marketCategory || "forex",
    direction: payload.direction,
    tradeType: payload.tradeType || "intraday",
    session: payload.session || "london",
    timezone: payload.timezone || "UTC",
    entryAt,
    exitAt,
    realizedAt,
    entryPrice: ledger?.entryPrice ?? str0(payload.entryPrice),
    exitPrice: ledger ? ledger.exitPrice : closed ? str(payload.exitPrice) : null,
    stopLoss: str(payload.stopLoss),
    takeProfit: str(payload.takeProfit),
    positionSize: ledger?.positionSize ?? str0(firstValue(payload.positionSize, payload.lotSize, "1")),
    lotSize: ledger?.lotSize ?? str0(firstValue(payload.lotSize, payload.positionSize, "1")),
    contractSize: str0(firstValue(payload.contractSize, "1")),
    tickSize: str0(payload.tickSize),
    tickValue: str0(payload.tickValue),
    pipSize: str0(firstValue(payload.pipSize, "0.0001")),
    pipValue: str0(firstValue(payload.pipValue, "10")),
    commission: str0(payload.commission),
    swap: str0(payload.swap),
    slippage: str0(payload.slippage),
    grossPnl: closed || executionBased ? metrics.grossPnl : "0",
    netPnl: closed || executionBased ? metrics.netPnl : "0",
    initialRisk: metrics.initialRisk,
    plannedRr: metrics.plannedRr,
    actualRr: closed || executionBased ? metrics.actualRr : null,
    rMultiple: closed || executionBased ? metrics.rMultiple : null,
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
    pnlOverridden: closed || executionBased ? (payload.pnlOverridden ?? false) : false,
  };
}

function executionValues(
  tradeId: string,
  userId: string,
  payload: TradePayload,
  ledger?: ExecutionLedger | null,
) {
  return (ledger?.executions ?? payload.executions ?? []).map((execution) => ({
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

export async function rebuildAccountBalances(tx: Tx, accountId: string) {
  const [account] = await tx
    .select({ id: tradingAccounts.id, startingBalance: tradingAccounts.startingBalance })
    .from(tradingAccounts)
    .where(eq(tradingAccounts.id, accountId));
  if (!account) throw new Error("Account not found");

  const rows = await tx
    .select({
      id: trades.id,
      netPnl: trades.netPnl,
      entryAt: trades.entryAt,
      exitAt: trades.exitAt,
      realizedAt: trades.realizedAt,
      createdAt: trades.createdAt,
      balanceBefore: trades.balanceBefore,
      balanceAfter: trades.balanceAfter,
    })
    .from(trades)
    .where(eq(trades.accountId, accountId));
  const cashFlowRows = await tx
    .select({ id: cashFlows.id, amount: cashFlows.amount, occurredAt: cashFlows.occurredAt, createdAt: cashFlows.createdAt })
    .from(cashFlows)
    .where(eq(cashFlows.accountId, accountId));

  const { snapshots, currentBalance } = buildAccountBalanceSnapshots(account.startingBalance, rows, cashFlowRows);
  const byId = new Map(rows.map((row) => [row.id, row]));

  for (const snapshot of snapshots) {
    const existing = byId.get(snapshot.id);
    if (existing?.balanceBefore === snapshot.balanceBefore && existing.balanceAfter === snapshot.balanceAfter) continue;
    await tx
      .update(trades)
      .set({ balanceBefore: snapshot.balanceBefore, balanceAfter: snapshot.balanceAfter })
      .where(eq(trades.id, snapshot.id));
  }

  await tx
    .update(tradingAccounts)
    .set({ currentBalance, updatedAt: new Date() })
    .where(eq(tradingAccounts.id, accountId));
  return currentBalance;
}

async function createTradeInTx(tx: Tx, userId: string, payload: TradePayload, rebuild = true) {
  const calculated = calculate(payload);
  // Serializing writes per user protects balances, ledger snapshots, and display IDs.
  await lockUser(tx, userId);
  const account = await lockAccount(tx, userId, payload.accountId);
  if (payload.sourceKey) {
    const [existing] = await tx
      .select({ sourceHash: trades.sourceHash })
      .from(trades)
      .where(and(
        eq(trades.userId, userId),
        eq(trades.accountId, account.id),
        eq(trades.sourceKey, payload.sourceKey),
      ))
      .limit(1);
    if (existing) {
      throw new Error(existing.sourceHash === payload.sourceHash
        ? "This source row was already imported"
        : "Source ID was already imported with different content; reconcile it instead of overwriting");
    }
  }
  const tagIds = await validateRelations(tx, userId, payload);
  const displayId = await nextDisplayId(tx, userId);

  const [trade] = await tx
    .insert(trades)
    .values({
      userId,
      accountId: account.id,
      displayId,
      ...valuesFor(payload, calculated),
    })
    .returning();

  const executions = executionValues(trade.id, userId, payload, calculated.ledger);
  if (executions.length) await tx.insert(tradeExecutions).values(executions);
  if (tagIds.length) await tx.insert(tradeTags).values(tagIds.map((tagId) => ({ tradeId: trade.id, tagId })));
  const psychology = psychologyValues(payload);
  if (psychology) await tx.insert(psychologyRecords).values({ tradeId: trade.id, userId, ...psychology });

  if (!rebuild) return trade;
  await rebuildAccountBalances(tx, account.id);
  const [saved] = await tx.select().from(trades).where(eq(trades.id, trade.id));
  return saved;
}

export async function createTrade(userId: string, payload: TradePayload) {
  return db.transaction((tx) => createTradeInTx(tx, userId, payload));
}

/** Commit one import atomically and rebuild each affected account once. */
export async function createTradesBatch(userId: string, payloads: TradePayload[], batchId?: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const batch = batchId
      ? (await tx.select().from(importBatches).where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId))).for("update"))[0]
      : null;
    if (batchId && !batch) throw new Error("Import batch not found");
    if (batch && batch.status !== "preview") throw new Error("This import batch was already committed or rolled back");

    const created: Array<typeof trades.$inferSelect> = [];
    for (const payload of payloads) {
      if (batch && payload.accountId !== batch.accountId) throw new Error("Import account changed after preview; preview the file again");
      created.push(await createTradeInTx(tx, userId, { ...payload, importBatchId: batchId ?? payload.importBatchId }, false));
    }
    const accountIds = [...new Set(created.map((trade) => trade.accountId))];
    for (const accountId of accountIds) await rebuildAccountBalances(tx, accountId);

    if (batch) {
      await tx.update(importBatches).set({
        status: "committed",
        importedRows: created.length,
        rejectedRows: Math.max(0, batch.totalRows - created.length),
        committedAt: new Date(),
      }).where(eq(importBatches.id, batch.id));
    }
    if (!created.length) return [];
    const rows = await tx.select().from(trades).where(inArray(trades.id, created.map((trade) => trade.id)));
    const byId = new Map(rows.map((row) => [row.id, row]));
    return created.map((trade) => byId.get(trade.id)!);
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
    if (existing.sourceKey && destination.id !== oldAccount.id) {
      const [duplicate] = await tx.select({ id: trades.id }).from(trades).where(and(
        eq(trades.userId, userId),
        eq(trades.accountId, destination.id),
        eq(trades.sourceKey, existing.sourceKey),
      )).limit(1);
      if (duplicate) throw new Error("Another trade in the destination account already uses this source ID");
    }
    const tagIds = await validateRelations(tx, userId, payload);
    const updatedValues = valuesFor(payload, calculated);
    updatedValues.importBatchId = existing.importBatchId;
    updatedValues.sourceKey = existing.sourceKey;
    updatedValues.sourceHash = existing.sourceHash;

    await tx
      .update(trades)
      .set({
        accountId: destination.id,
        ...updatedValues,
        updatedAt: new Date(),
      })
      .where(eq(trades.id, tradeId));

    await tx.delete(tradeTags).where(eq(tradeTags.tradeId, tradeId));
    if (tagIds.length) await tx.insert(tradeTags).values(tagIds.map((tagId) => ({ tradeId, tagId })));
    await tx.delete(tradeExecutions).where(eq(tradeExecutions.tradeId, tradeId));
    const executions = executionValues(tradeId, userId, payload, calculated.ledger);
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

    await rebuildAccountBalances(tx, oldAccount.id);
    if (destination.id !== oldAccount.id) await rebuildAccountBalances(tx, destination.id);
    const [saved] = await tx.select().from(trades).where(eq(trades.id, tradeId));
    return saved;
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

    const account = await lockAccount(tx, userId, existing.accountId);
    const shots = await tx
      .select({ fileName: screenshots.fileName })
      .from(screenshots)
      .where(eq(screenshots.tradeId, tradeId));
    await tx.delete(trades).where(eq(trades.id, tradeId));
    await rebuildAccountBalances(tx, account.id);
    return shots.map((shot) => shot.fileName);
  });

  if (!files) return false;
  await deleteScreenshotFiles(userId, files).catch(() => undefined);
  return true;
}
