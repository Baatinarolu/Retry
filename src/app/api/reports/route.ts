import { parseFilters, requireUser } from "@/lib/api";
import { buildAnalytics } from "@/lib/analytics";
import { APP_NAME } from "@/lib/constants";
import { loadTradeRows, reportingContextFor } from "@/lib/queries";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  const filters = parseFilters(new URL(req.url));
  const timeZone = user!.timezone;
  const context = await reportingContextFor(session!.uid, filters.accountId);
  const rows = await loadTradeRows(session!.uid, filters, timeZone);
  const analytics = buildAnalytics(rows, context.startingBalance, timeZone);
  return NextResponse.json({
    title: `${APP_NAME} performance report`,
    generatedAt: new Date().toISOString(),
    sampleSize: rows.length,
    filters,
    currency: context.currency,
    timezone: timeZone,
    realizationDate: "realizedAt",
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
