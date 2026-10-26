import { db } from "@/db";
import {
  psychologyRecords,
  screenshots,
  strategies,
  tags,
  tradeExecutions,
  tradePricePoints,
  tradeRiskLevels,
  tradeTags,
  trades,
  tradingAccounts,
} from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { deleteTrade, updateTrade } from "@/lib/trade-service";
import { buildExecutionReview } from "@/lib/execution-review";
import { tradeSchema } from "@/lib/validations";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const [row] = await db
    .select({ trade: trades, strategyName: strategies.name, psych: psychologyRecords, accountCurrency: tradingAccounts.currency })
    .from(trades)
    .leftJoin(tradingAccounts, eq(tradingAccounts.id, trades.accountId))
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .leftJoin(psychologyRecords, eq(psychologyRecords.tradeId, trades.id))
    .where(and(eq(trades.id, id), eq(trades.userId, session!.uid)));
  if (!row) return jsonError("Trade not found", 404);
  const tagRows = await db
    .select({ tag: tags })
    .from(tradeTags)
    .innerJoin(tags, eq(tags.id, tradeTags.tagId))
    .where(eq(tradeTags.tradeId, id));
  const executions = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.tradeId, id))
    .orderBy(asc(tradeExecutions.executedAt), asc(tradeExecutions.id));
  const pricePath = await db.select().from(tradePricePoints)
    .where(and(eq(tradePricePoints.tradeId, id), eq(tradePricePoints.userId, session!.uid)))
    .orderBy(asc(tradePricePoints.observedAt), asc(tradePricePoints.id));
  const riskLevels = await db.select().from(tradeRiskLevels)
    .where(and(eq(tradeRiskLevels.tradeId, id), eq(tradeRiskLevels.userId, session!.uid)))
    .orderBy(asc(tradeRiskLevels.effectiveAt), asc(tradeRiskLevels.id));
  const shots = await db.select().from(screenshots)
    .where(eq(screenshots.tradeId, id))
    .orderBy(asc(screenshots.createdAt), asc(screenshots.id));
  const reversalSource = row.trade.reversedFromTradeId
    ? (await db.select({ id: trades.id, displayId: trades.displayId, direction: trades.direction, status: trades.status })
      .from(trades).where(and(eq(trades.id, row.trade.reversedFromTradeId), eq(trades.userId, session!.uid))).limit(1))[0] || null
    : null;
  const reversalTarget = (await db.select({ id: trades.id, displayId: trades.displayId, direction: trades.direction, status: trades.status })
    .from(trades).where(and(eq(trades.reversedFromTradeId, id), eq(trades.userId, session!.uid))).limit(1))[0] || null;
  const executionReview = executions.length
    ? buildExecutionReview({
        direction: row.trade.direction as "long" | "short",
        status: row.trade.status as "open" | "closed",
        executions: executions.map((execution) => ({
          ...execution,
          type: execution.type as "entry" | "scale_in" | "scale_out" | "exit",
        })),
        stopLoss: row.trade.stopLoss,
        takeProfit: row.trade.takeProfit,
        contractSize: row.trade.contractSize,
        tickSize: row.trade.tickSize,
        tickValue: row.trade.tickValue,
        pipSize: row.trade.pipSize,
        pipValue: row.trade.pipValue,
        commission: row.trade.commission,
        swap: row.trade.swap,
        slippage: row.trade.slippage,
        overrideNetPnl: row.trade.pnlOverridden ? row.trade.netPnl : null,
      }, pricePath)
    : null;
  return NextResponse.json({
    trade: {
      ...row.trade,
      accountCurrency: row.accountCurrency,
      strategyName: row.strategyName,
      psychology: row.psych,
      tags: tagRows.map((t) => t.tag),
      executions,
      pricePath,
      riskLevels,
      reversalSource,
      reversalTarget,
      executionReview,
      screenshots: shots,
    },
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid trade payload");
  try {
    const trade = await updateTrade(session!.uid, id, parsed.data);
    if (!trade) return jsonError("Trade not found", 404);
    return NextResponse.json({ trade });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not update trade");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const ok = await deleteTrade(session!.uid, id);
  if (!ok) return jsonError("Trade not found", 404);
  return NextResponse.json({ ok: true });
}
