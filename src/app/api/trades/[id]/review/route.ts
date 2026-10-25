import { db } from "@/db";
import { trades } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { tradeReviewSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = tradeReviewSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid review payload");

  const now = new Date();
  const [review] = await db
    .update(trades)
    .set({
      reviewStatus: parsed.data.reviewStatus,
      nextAction: parsed.data.nextAction,
      reviewedAt: parsed.data.reviewStatus === "unreviewed" ? null : now,
      updatedAt: now,
    })
    .where(and(eq(trades.id, id), eq(trades.userId, session!.uid)))
    .returning({ id: trades.id, reviewStatus: trades.reviewStatus, reviewedAt: trades.reviewedAt, nextAction: trades.nextAction });
  if (!review) return jsonError("Trade not found", 404);
  return NextResponse.json({ review });
}
