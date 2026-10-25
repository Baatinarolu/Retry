import { db } from "@/db";
import { tradeExecutions, tradePricePoints, trades } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { normalizePricePath } from "@/lib/price-path";
import { pricePathSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const parsed = pricePathSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid price path");

  try {
    const points = await db.transaction(async (tx) => {
      const [trade] = await tx.select().from(trades)
        .where(and(eq(trades.id, id), eq(trades.userId, session!.uid))).for("update");
      if (!trade) return null;
      const [execution] = await tx.select({ id: tradeExecutions.id }).from(tradeExecutions)
        .where(eq(tradeExecutions.tradeId, id)).limit(1);
      if (!execution) throw new Error("Price paths currently require an execution-led trade");
      const normalized = normalizePricePath(parsed.data.points, {
        entryAt: trade.entryAt,
        exitAt: trade.exitAt,
        now: new Date(),
      });
      await tx.delete(tradePricePoints).where(and(eq(tradePricePoints.tradeId, id), eq(tradePricePoints.userId, session!.uid)));
      if (normalized.length) {
        await tx.insert(tradePricePoints).values(normalized.map((point) => ({
          tradeId: id,
          userId: session!.uid,
          observedAt: point.observedAt,
          price: point.price,
          notes: point.notes,
        })));
      }
      return normalized;
    });
    if (!points) return jsonError("Trade not found", 404);
    return NextResponse.json({ points });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not save price path");
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const [trade] = await db.select({ id: trades.id }).from(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, session!.uid))).limit(1);
  if (!trade) return jsonError("Trade not found", 404);
  await db.delete(tradePricePoints).where(and(eq(tradePricePoints.tradeId, id), eq(tradePricePoints.userId, session!.uid)));
  return NextResponse.json({ ok: true });
}
