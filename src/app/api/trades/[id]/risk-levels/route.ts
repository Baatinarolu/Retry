import { db } from "@/db";
import { tradeRiskLevels, trades } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { normalizeRiskLevels } from "@/lib/risk-levels";
import { riskLevelsSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = riskLevelsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid risk history");

  try {
    const snapshots = await db.transaction(async (tx) => {
      const [trade] = await tx.select().from(trades)
        .where(and(eq(trades.id, id), eq(trades.userId, session!.uid))).for("update");
      if (!trade) return null;
      const normalized = normalizeRiskLevels(parsed.data.snapshots, {
        entryAt: trade.entryAt,
        exitAt: trade.exitAt,
        now: new Date(),
      });
      await tx.delete(tradeRiskLevels).where(and(
        eq(tradeRiskLevels.tradeId, id),
        eq(tradeRiskLevels.userId, session!.uid),
      ));
      if (normalized.length) {
        await tx.insert(tradeRiskLevels).values(normalized.map((snapshot) => ({
          tradeId: id,
          userId: session!.uid,
          effectiveAt: snapshot.effectiveAt,
          stopLoss: snapshot.stopLoss,
          takeProfit: snapshot.takeProfit,
          notes: snapshot.notes,
        })));
      }
      return normalized;
    });
    if (!snapshots) return jsonError("Trade not found", 404);
    return NextResponse.json({ riskLevels: snapshots });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not save risk history");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const [trade] = await db.select({ id: trades.id }).from(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, session!.uid))).limit(1);
  if (!trade) return jsonError("Trade not found", 404);
  await db.delete(tradeRiskLevels).where(and(
    eq(tradeRiskLevels.tradeId, id),
    eq(tradeRiskLevels.userId, session!.uid),
  ));
  return NextResponse.json({ ok: true });
}
