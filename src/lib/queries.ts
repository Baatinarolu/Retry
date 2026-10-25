import { db } from "@/db";
import {
  psychologyRecords,
  strategies,
  tags,
  trades,
  tradingAccounts,
} from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { TradeRow } from "./analytics";

export type TradeFilters = {
  from?: string | null;
  to?: string | null;
  accountId?: string | null;
  instrument?: string | null;
  strategyId?: string | null;
  direction?: string | null;
  session?: string | null;
  dateField?: "entry" | "exit" | null;
};

export function tradeWhere(userId: string, filters: TradeFilters = {}) {
  const parts = [eq(trades.userId, userId)];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  let invalid = false;
  if (filters.accountId) {
    if (uuid.test(filters.accountId)) parts.push(eq(trades.accountId, filters.accountId));
    else invalid = true;
  }
  if (filters.instrument) parts.push(eq(trades.instrument, filters.instrument));
  if (filters.strategyId) {
    if (uuid.test(filters.strategyId)) parts.push(eq(trades.strategyId, filters.strategyId));
    else invalid = true;
  }
  if (filters.direction) parts.push(eq(trades.direction, filters.direction));
  if (filters.session) parts.push(eq(trades.session, filters.session));
  const dateColumn = filters.dateField === "exit" ? trades.exitAt : trades.entryAt;
  if (filters.from) {
    const start = new Date(filters.from);
    if (Number.isNaN(start.getTime())) invalid = true;
    else parts.push(gte(dateColumn, start));
  }
  if (filters.to) {
    const end = new Date(filters.to);
    if (Number.isNaN(end.getTime())) invalid = true;
    else {
      if (!filters.to.includes("T")) end.setUTCHours(23, 59, 59, 999);
      parts.push(lte(dateColumn, end));
    }
  }
  return and(...parts, invalid ? sql`false` : undefined);
}

export async function loadTradeRows(userId: string, filters: TradeFilters = {}): Promise<TradeRow[]> {
  const rows = await db
    .select({
      trade: trades,
      strategyName: strategies.name,
      psych: psychologyRecords,
    })
    .from(trades)
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .leftJoin(psychologyRecords, eq(psychologyRecords.tradeId, trades.id))
    .where(and(tradeWhere(userId, filters), eq(trades.status, "closed")))
    .orderBy(desc(trades.entryAt));

  return rows.map((r) => ({
    id: r.trade.id,
    displayId: r.trade.displayId,
    instrument: r.trade.instrument,
    strategyId: r.trade.strategyId,
    strategyName: r.strategyName,
    session: r.trade.session,
    direction: r.trade.direction,
    tradeType: r.trade.tradeType,
    entryTimeframe: r.trade.entryTimeframe,
    followedPlan: r.trade.followedPlan,
    newsRelated: r.trade.newsRelated,
    notes: r.trade.notes,
    netPnl: r.trade.netPnl,
    grossPnl: r.trade.grossPnl,
    rMultiple: r.trade.rMultiple,
    result: r.trade.result,
    status: r.trade.status,
    holdingMinutes: r.trade.holdingMinutes,
    entryAt: r.trade.entryAt,
    exitAt: r.trade.exitAt,
    emotionBefore: r.psych?.emotionBefore,
    emotionAfter: r.psych?.emotionAfter,
    fomo: r.psych?.fomo,
    revenge: r.psych?.revenge,
    earlyExit: r.psych?.earlyExit,
    movedStop: r.psych?.movedStop,
    brokeRiskRules: r.psych?.brokeRiskRules,
    impulsive: r.psych?.impulsive,
  }));
}

export async function getUserAccounts(userId: string) {
  return db
    .select()
    .from(tradingAccounts)
    .where(eq(tradingAccounts.userId, userId))
    .orderBy(tradingAccounts.createdAt);
}

export async function getUserStrategies(userId: string) {
  return db.select().from(strategies).where(eq(strategies.userId, userId)).orderBy(strategies.name);
}

export async function getUserTags(userId: string) {
  return db.select().from(tags).where(eq(tags.userId, userId)).orderBy(tags.name);
}

export async function startingBalanceFor(userId: string, accountId?: string | null) {
  if (accountId) {
    const [a] = await db.select().from(tradingAccounts).where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)));
    return a?.startingBalance ?? "0";
  }
  const list = await getUserAccounts(userId);
  return list.reduce((s, a) => s + Number(a.startingBalance || 0), 0).toFixed(2);
}
