import { db } from "@/db";
import {
  psychologyRecords,
  strategies,
  tags,
  trades,
  tradingAccounts,
} from "@/db/schema";
import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import Decimal from "decimal.js";
import type { TradeRow } from "./analytics";
import { calendarDayBounds, commonReportingCurrency, isCalendarDate } from "./reporting";

export type TradeFilters = {
  from?: string | null;
  to?: string | null;
  accountId?: string | null;
  instrument?: string | null;
  strategyId?: string | null;
  direction?: string | null;
  session?: string | null;
  reviewStatus?: string | null;
  dateField?: "entry" | "exit" | null;
};

export function tradeWhere(userId: string, filters: TradeFilters = {}, timeZone = "UTC") {
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
  if (filters.reviewStatus) {
    if (["unreviewed", "reviewed", "needs_follow_up"].includes(filters.reviewStatus)) {
      parts.push(eq(trades.reviewStatus, filters.reviewStatus));
    } else invalid = true;
  }
  const dateColumn = filters.dateField === "exit" ? trades.realizedAt : trades.entryAt;
  if (filters.from) {
    if (isCalendarDate(filters.from)) {
      parts.push(gte(dateColumn, calendarDayBounds(filters.from, timeZone).start));
    } else {
      const start = new Date(filters.from);
      if (Number.isNaN(start.getTime()) || /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) invalid = true;
      else parts.push(gte(dateColumn, start));
    }
  }
  if (filters.to) {
    if (isCalendarDate(filters.to)) {
      parts.push(lt(dateColumn, calendarDayBounds(filters.to, timeZone).end));
    } else {
      const end = new Date(filters.to);
      if (Number.isNaN(end.getTime()) || /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) invalid = true;
      else parts.push(lte(dateColumn, end));
    }
  }
  return and(...parts, invalid ? sql`false` : undefined);
}

export async function loadTradeRows(userId: string, filters: TradeFilters = {}, timeZone = "UTC"): Promise<TradeRow[]> {
  const rows = await db
    .select({
      trade: trades,
      strategyName: strategies.name,
      psych: psychologyRecords,
    })
    .from(trades)
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .leftJoin(psychologyRecords, eq(psychologyRecords.tradeId, trades.id))
    .where(and(tradeWhere(userId, filters, timeZone), eq(trades.status, "closed")))
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
    realizedAt: r.trade.realizedAt,
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

export async function reportingContextFor(userId: string, accountId?: string | null) {
  const accounts = accountId
    ? await db
        .select()
        .from(tradingAccounts)
        .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)))
    : await getUserAccounts(userId);
  if (accountId && !accounts.length) throw new Error("Account not found");

  const currency = commonReportingCurrency(accounts.map((account) => account.currency));
  const startingBalance = accounts
    .reduce((total, account) => total.plus(account.startingBalance), new Decimal(0))
    .toFixed(2);
  return { currency, startingBalance };
}

export async function startingBalanceFor(userId: string, accountId?: string | null) {
  return (await reportingContextFor(userId, accountId)).startingBalance;
}
