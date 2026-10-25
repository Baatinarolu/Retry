import { db } from "@/db";
import { trades } from "@/db/schema";
import { jsonError, parseFilters, requireUser } from "@/lib/api";
import { tradeWhere } from "@/lib/queries";
import { and, asc, desc, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  try {
    const filters = parseFilters(new URL(req.url));
    const where = tradeWhere(session!.uid, filters, user!.timezone);
    const [rows, counts] = await Promise.all([
      db
        .select({
          id: trades.id,
          displayId: trades.displayId,
          instrument: trades.instrument,
          direction: trades.direction,
          reviewStatus: trades.reviewStatus,
          nextAction: trades.nextAction,
          reviewedAt: trades.reviewedAt,
          entryAt: trades.entryAt,
          netPnl: trades.netPnl,
          result: trades.result,
        })
        .from(trades)
        .where(and(where, inArray(trades.reviewStatus, ["unreviewed", "needs_follow_up"])))
        .orderBy(asc(trades.reviewStatus), desc(trades.entryAt), desc(trades.id))
        .limit(50),
      db
        .select({ status: trades.reviewStatus, total: sql<number>`count(*)` })
        .from(trades)
        .where(where)
        .groupBy(trades.reviewStatus),
    ]);
    const summary = { unreviewed: 0, reviewed: 0, needs_follow_up: 0 };
    for (const row of counts) {
      if (row.status in summary) summary[row.status as keyof typeof summary] = Number(row.total);
    }
    return NextResponse.json({
      queue: rows,
      counts: summary,
      queueTotal: summary.unreviewed + summary.needs_follow_up,
      sampleTotal: Object.values(summary).reduce((total, value) => total + value, 0),
    });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not load review queue", 500);
  }
}
