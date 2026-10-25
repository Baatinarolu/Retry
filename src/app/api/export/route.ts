import { db } from "@/db";
import { psychologyRecords, strategies, trades, tradingAccounts } from "@/db/schema";
import { parseFilters, requireUser } from "@/lib/api";
import { csvLine } from "@/lib/csv";
import { tradeWhere } from "@/lib/queries";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";
  const filters = parseFilters(url);
  const rows = await db
    .select({ trade: trades, strategyName: strategies.name, psych: psychologyRecords, accountCurrency: tradingAccounts.currency })
    .from(trades)
    .leftJoin(tradingAccounts, eq(tradingAccounts.id, trades.accountId))
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .leftJoin(psychologyRecords, eq(psychologyRecords.tradeId, trades.id))
    .where(tradeWhere(session!.uid, filters, user!.timezone));

  if (format === "json") {
    return NextResponse.json(
      {
        exportedAt: new Date().toISOString(),
        trades: rows.map((row) => ({ ...row.trade, accountCurrency: row.accountCurrency, strategyName: row.strategyName, psychology: row.psych })),
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="trademind-backup-${new Date().toISOString().slice(0, 10)}.json"`,
          "Cache-Control": "no-store",
        },
      },
    );
  }
  if (format !== "csv") return NextResponse.json({ error: "Supported formats are csv and json" }, { status: 400 });

  const headers = [
    "display_id",
    "account_currency",
    "instrument",
    "direction",
    "entry_at",
    "exit_at",
    "realized_at",
    "entry_price",
    "exit_price",
    "stop_loss",
    "take_profit",
    "lot_size",
    "position_size",
    "contract_size",
    "tick_size",
    "tick_value",
    "pip_size",
    "pip_value",
    "commission",
    "swap",
    "slippage",
    "gross_pnl",
    "net_pnl",
    "r_multiple",
    "result",
    "session",
    "market_category",
    "strategy",
    "followed_plan",
    "notes",
  ];
  const lines = [csvLine(headers)];
  for (const row of rows) {
    const trade = row.trade;
    lines.push(
      csvLine([
        trade.displayId,
        row.accountCurrency,
        trade.instrument,
        trade.direction,
        trade.entryAt.toISOString(),
        trade.exitAt?.toISOString() ?? "",
        trade.realizedAt?.toISOString() ?? "",
        trade.entryPrice,
        trade.exitPrice ?? "",
        trade.stopLoss ?? "",
        trade.takeProfit ?? "",
        trade.lotSize,
        trade.positionSize,
        trade.contractSize,
        trade.tickSize,
        trade.tickValue,
        trade.pipSize,
        trade.pipValue,
        trade.commission,
        trade.swap,
        trade.slippage,
        trade.grossPnl,
        trade.netPnl,
        trade.rMultiple ?? "",
        trade.result,
        trade.session,
        trade.marketCategory,
        row.strategyName ?? "",
        trade.followedPlan,
        trade.notes,
      ]),
    );
  }
  return new NextResponse(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="trademind-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
