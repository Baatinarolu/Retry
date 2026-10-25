import { jsonError, parseFilters, requireUser } from "@/lib/api";
import { buildAnalytics } from "@/lib/analytics";
import { loadTradeRows, startingBalanceFor } from "@/lib/queries";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  try {
    const filters = parseFilters(new URL(req.url));
    const rows = await loadTradeRows(session!.uid, filters);
    const starting = await startingBalanceFor(session!.uid, filters.accountId);
    const analytics = buildAnalytics(rows, starting);
    return NextResponse.json({ analytics, sampleSize: rows.length, startingBalance: starting });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Analytics failed", 500);
  }
}
