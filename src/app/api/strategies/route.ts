import { db } from "@/db";
import { strategies } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { computePerformanceStats } from "@/lib/calculations";
import { loadTradeRows, reportingContextFor } from "@/lib/queries";
import { strategySchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  try {
    const list = await db.select().from(strategies).where(eq(strategies.userId, session!.uid));
    if (new URL(req.url).searchParams.get("basic") === "1") {
      return NextResponse.json({ strategies: list });
    }
    const context = await reportingContextFor(session!.uid, null, { convertMixed: true });
    const rows = context.convertTrades(await loadTradeRows(session!.uid, {}, user!.timezone));
    const withStats = list.map((strategy) => {
      const linked = rows.filter((trade) => trade.strategyId === strategy.id);
      return { ...strategy, stats: computePerformanceStats(linked) };
    });
    return NextResponse.json({ strategies: withStats, currency: context.currency, conversion: context.conversion });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not load strategy statistics");
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = strategySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid strategy");
  const [row] = await db
    .insert(strategies)
    .values({ userId: session!.uid, ...parsed.data })
    .returning();
  return NextResponse.json({ strategy: row }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body?.id) return jsonError("id required");
  const asNewVersion = Boolean(body.asNewVersion);
  const [existing] = await db
    .select()
    .from(strategies)
    .where(and(eq(strategies.id, body.id), eq(strategies.userId, session!.uid)));
  if (!existing) return jsonError("Not found", 404);
  const parsed = strategySchema.partial().safeParse(body);
  if (!parsed.success) return jsonError("Invalid strategy");
  if (asNewVersion) {
    const [row] = await db
      .insert(strategies)
      .values({
        userId: session!.uid,
        name: parsed.data.name || existing.name,
        description: parsed.data.description ?? existing.description,
        marketConditions: parsed.data.marketConditions ?? existing.marketConditions,
        confirmations: parsed.data.confirmations ?? existing.confirmations,
        entryRules: parsed.data.entryRules ?? existing.entryRules,
        stopLossRules: parsed.data.stopLossRules ?? existing.stopLossRules,
        takeProfitRules: parsed.data.takeProfitRules ?? existing.takeProfitRules,
        riskRules: parsed.data.riskRules ?? existing.riskRules,
        invalidation: parsed.data.invalidation ?? existing.invalidation,
        checklist: parsed.data.checklist ?? existing.checklist,
        version: existing.version + 1,
        parentStrategyId: existing.parentStrategyId || existing.id,
      })
      .returning();
    return NextResponse.json({ strategy: row });
  }
  const [row] = await db
    .update(strategies)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(strategies.id, existing.id))
    .returning();
  return NextResponse.json({ strategy: row });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("id required");
  await db
    .update(strategies)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(strategies.id, id), eq(strategies.userId, session!.uid)));
  return NextResponse.json({ ok: true });
}
