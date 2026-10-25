import { jsonError, parseFilters, requireUser } from "@/lib/api";
import { buildAnalytics } from "@/lib/analytics";
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
      analytics,
      sampleSize: rows.length,
      startingBalance: context.startingBalance,
      currency: context.currency,
      conversion: context.conversion,
      timezone: timeZone,
      realizationDate: "realizedAt",
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Analytics failed", 500);
  }
}
