import { db } from "@/db";
import {
  psychologyRecords,
  screenshots,
  strategies,
  tags,
  tradeExecutions,
  tradeTags,
  trades,
} from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { deleteTrade, updateTrade } from "@/lib/trade-service";
import { tradeSchema } from "@/lib/validations";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const [row] = await db
    .select({ trade: trades, strategyName: strategies.name, psych: psychologyRecords })
    .from(trades)
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
  const shots = await db.select().from(screenshots).where(eq(screenshots.tradeId, id));
  return NextResponse.json({
    trade: {
      ...row.trade,
      strategyName: row.strategyName,
      psychology: row.psych,
      tags: tagRows.map((t) => t.tag),
      executions,
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
