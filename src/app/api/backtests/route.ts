import { db } from "@/db";
import { backtestTrades, backtests, strategies } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { computePerformanceStats } from "@/lib/calculations";
import { backtestSchema, backtestTradeSchema } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const [bt] = await db
      .select()
      .from(backtests)
      .where(and(eq(backtests.id, id), eq(backtests.userId, session!.uid)));
    if (!bt) return jsonError("Not found", 404);
    const list = await db.select().from(backtestTrades).where(eq(backtestTrades.backtestId, id));
    const stats = computePerformanceStats(
      list.map((t) => ({
        // Backtests are primarily R-based; using currency here made PF zero whenever currency was omitted.
        netPnl: t.resultR,
        grossPnl: t.resultR,
        rMultiple: t.resultR,
        result: Number(t.resultR) > 0.05 ? "win" : Number(t.resultR) < -0.05 ? "loss" : "be",
        followedPlan: t.followedRules,
        entryAt: t.entryAt,
        exitAt: t.exitAt,
      })),
    );
    return NextResponse.json({ backtest: bt, trades: list, stats, statsBasis: "r", simulated: true });
  }
  const list = await db
    .select()
    .from(backtests)
    .where(eq(backtests.userId, session!.uid))
    .orderBy(desc(backtests.createdAt));
  return NextResponse.json({ backtests: list });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (body?.backtestId) {
    const parsed = backtestTradeSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid simulated trade");
    const [bt] = await db
      .select()
      .from(backtests)
      .where(and(eq(backtests.id, body.backtestId), eq(backtests.userId, session!.uid)));
    if (!bt) return jsonError("Backtest not found", 404);
    const [row] = await db
      .insert(backtestTrades)
      .values({
        backtestId: body.backtestId,
        userId: session!.uid,
        instrument: parsed.data.instrument,
        direction: parsed.data.direction,
        entryAt: new Date(parsed.data.entryAt),
        exitAt: parsed.data.exitAt ? new Date(parsed.data.exitAt) : null,
        entryPrice: String(parsed.data.entryPrice),
        exitPrice: parsed.data.exitPrice ? String(parsed.data.exitPrice) : null,
        stopLoss: parsed.data.stopLoss ? String(parsed.data.stopLoss) : null,
        takeProfit: parsed.data.takeProfit ? String(parsed.data.takeProfit) : null,
        resultR: String(parsed.data.resultR || 0),
        resultCurrency: String(parsed.data.resultCurrency || 0),
        informationAtDecision: parsed.data.informationAtDecision || "",
        notes: parsed.data.notes || "",
        followedRules: parsed.data.followedRules ?? true,
      })
      .returning();
    return NextResponse.json({ trade: row }, { status: 201 });
  }
  const parsed = backtestSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid backtest");
  if (parsed.data.strategyId) {
    const [strategy] = await db
      .select({ id: strategies.id })
      .from(strategies)
      .where(and(eq(strategies.id, parsed.data.strategyId), eq(strategies.userId, session!.uid)));
    if (!strategy) return jsonError("Strategy not found", 404);
  }
  const [row] = await db
    .insert(backtests)
    .values({
      userId: session!.uid,
      ...parsed.data,
      strategyId: parsed.data.strategyId || null,
    })
    .returning();
  return NextResponse.json({ backtest: row }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const tradeId = url.searchParams.get("tradeId");
  const id = url.searchParams.get("id");
  if (tradeId) {
    await db.delete(backtestTrades).where(and(eq(backtestTrades.id, tradeId), eq(backtestTrades.userId, session!.uid)));
    return NextResponse.json({ ok: true });
  }
  if (id) {
    await db.delete(backtests).where(and(eq(backtests.id, id), eq(backtests.userId, session!.uid)));
    return NextResponse.json({ ok: true });
  }
  return jsonError("id required");
}
