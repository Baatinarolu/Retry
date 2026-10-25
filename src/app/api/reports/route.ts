import { parseFilters, requireUser } from "@/lib/api";
import { buildAnalytics } from "@/lib/analytics";
import { APP_NAME } from "@/lib/constants";
import { loadTradeRows, startingBalanceFor } from "@/lib/queries";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const filters = parseFilters(new URL(req.url));
  const rows = await loadTradeRows(session!.uid, filters);
  const starting = await startingBalanceFor(session!.uid, filters.accountId);
  const analytics = buildAnalytics(rows, starting);
  return NextResponse.json({
    title: `${APP_NAME} performance report`,
    generatedAt: new Date().toISOString(),
    sampleSize: rows.length,
    filters,
    stats: analytics.stats,
    insights: analytics.insights,
    byInstrument: analytics.byInstrument,
    bySession: analytics.bySession,
    byStrategy: analytics.byStrategy,
    mistakes: analytics.mistakes,
    disclaimer:
      "This report describes historical journal data. It is not investment advice and does not predict future results.",
  });
}
