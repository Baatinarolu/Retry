import { jsonError, parseFilters, requireUser } from "@/lib/api";
import { buildAnalytics } from "@/lib/analytics";
import { APP_NAME } from "@/lib/constants";
import { loadTradeRows, reportingContextFor } from "@/lib/queries";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  try {
    const filters = parseFilters(new URL(req.url));
    const timeZone = user!.timezone;
    const context = await reportingContextFor(session!.uid, filters.accountId, { convertMixed: true });
    const rows = context.convertTrades(await loadTradeRows(session!.uid, filters, timeZone));
    const analytics = buildAnalytics(rows, context.startingBalance, timeZone);
    return NextResponse.json({
      title: `${APP_NAME} performance report`,
      generatedAt: new Date().toISOString(),
      sampleSize: rows.length,
      filters,
      currency: context.currency,
      conversion: context.conversion,
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
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not build the report");
  }
}
