import { db } from "@/db";
import { instruments, strategies, trades, tradingAccounts } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import { createTrade, type TradePayload } from "@/lib/trade-service";
import { tradeSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;
const MAX_CSV_CHARS = 2_000_000;

type PreviewRow = {
  line: number;
  data: Record<string, string>;
  errors: string[];
  duplicate: boolean;
};

type InstrumentSpec = {
  category: string;
  contractSize: string;
  tickSize: string;
  tickValue: string;
  pipSize: string;
  pipValue: string;
};

type ExistingTrade = { instrument: string; direction: string; entryAt: Date };

const ALIASES: Record<string, string[]> = {
  instrument: ["instrument", "symbol", "ticker", "pair"],
  direction: ["direction", "side", "type", "buy_sell"],
  entryAt: ["entry_at", "entry_time", "open_time", "time", "date"],
  exitAt: ["exit_at", "exit_time", "close_time"],
  entryPrice: ["entry_price", "open_price", "open"],
  exitPrice: ["exit_price", "close_price", "close"],
  stopLoss: ["stop_loss", "sl"],
  takeProfit: ["take_profit", "tp"],
  lotSize: ["lot_size", "lots", "volume", "size", "qty"],
  positionSize: ["position_size", "quantity"],
  contractSize: ["contract_size"],
  tickSize: ["tick_size"],
  tickValue: ["tick_value"],
  pipSize: ["pip_size"],
  pipValue: ["pip_value"],
  commission: ["commission", "fee", "fees"],
  swap: ["swap", "swap_fee", "funding"],
  slippage: ["slippage"],
  netPnl: ["net_pnl", "pnl", "profit", "net"],
  session: ["session"],
  marketCategory: ["market_category", "category"],
  strategy: ["strategy", "strategy_name"],
  notes: ["notes", "comment", "comments"],
};

function pick(row: Record<string, string>, key: string) {
  for (const name of ALIASES[key] || [key]) {
    if (row[name] !== undefined && row[name] !== "") return row[name];
  }
  return "";
}

function canonicalRow(raw: Record<string, string>, aliased: boolean) {
  const data: Record<string, string> = {};
  for (const key of Object.keys(ALIASES)) data[key] = aliased ? pick(raw, key) : String(raw[key] ?? "");
  return data;
}

function directionOf(value: string): "long" | "short" | "" {
  const direction = value.trim().toLowerCase();
  if (direction === "short" || direction === "sell" || direction === "s") return "short";
  if (direction === "long" || direction === "buy" || direction === "b") return "long";
  return "";
}

function isDuplicate(existing: ExistingTrade[], data: Record<string, string>, direction: string) {
  const entryTime = new Date(data.entryAt).getTime();
  if (!direction || Number.isNaN(entryTime)) return false;
  return existing.some(
    (trade) =>
      trade.instrument.toUpperCase() === data.instrument.trim().toUpperCase() &&
      trade.direction === direction &&
      Math.abs(trade.entryAt.getTime() - entryTime) < 60_000,
  );
}

function prepareRow(
  data: Record<string, string>,
  line: number,
  accountId: string,
  instrumentMap: Map<string, InstrumentSpec>,
  strategyMap: Map<string, string>,
  existing: ExistingTrade[],
) {
  const direction = directionOf(data.direction);
  const spec = instrumentMap.get(data.instrument.trim().toUpperCase());
  const errors: string[] = [];
  if (!direction) errors.push("Direction must be buy/long or sell/short");
  const strategyName = data.strategy.trim().toLowerCase();
  const strategyId = strategyName ? strategyMap.get(strategyName) : null;
  if (strategyName && !strategyId) errors.push("Strategy not found");
  const wantsClosed = Boolean(data.exitAt || data.exitPrice || data.netPnl);
  const candidate: TradePayload = {
    accountId,
    strategyId: strategyId || null,
    instrument: data.instrument.trim().toUpperCase(),
    marketCategory: data.marketCategory || spec?.category || "forex",
    direction: direction || "long",
    entryAt: data.entryAt,
    exitAt: data.exitAt || null,
    entryPrice: data.entryPrice,
    exitPrice: data.exitPrice || null,
    stopLoss: data.stopLoss || null,
    takeProfit: data.takeProfit || null,
    lotSize: data.lotSize || data.positionSize || "1",
    positionSize: data.positionSize || data.lotSize || "1",
    contractSize: data.contractSize || spec?.contractSize || "1",
    tickSize: data.tickSize || spec?.tickSize || "0",
    tickValue: data.tickValue || spec?.tickValue || "0",
    pipSize: data.pipSize || spec?.pipSize || "0.0001",
    pipValue: data.pipValue || spec?.pipValue || "10",
    commission: data.commission || "0",
    swap: data.swap || "0",
    slippage: data.slippage || "0",
    pnlOverridden: data.netPnl !== "",
    overrideNetPnl: data.netPnl || null,
    session: data.session || "other",
    notes: data.notes ? `${data.notes}\nImported from CSV` : "Imported from CSV",
    status: wantsClosed ? "closed" : "open",
  };
  const parsed = tradeSchema.safeParse(candidate);
  if (!parsed.success) {
    errors.push(...parsed.error.issues.slice(0, 4).map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  const duplicate = isDuplicate(existing, data, direction);
  return {
    preview: { line, data, errors, duplicate } satisfies PreviewRow,
    payload: parsed.success && errors.length === 0 && !duplicate ? parsed.data : null,
    duplicate,
    existing: {
      instrument: candidate.instrument,
      direction: candidate.direction,
      entryAt: new Date(candidate.entryAt),
    } satisfies ExistingTrade,
  };
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => null);
  if (!body) return jsonError("Invalid payload");

  const [accounts, instrumentRows, strategyRows, saved] = await Promise.all([
    db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, session!.uid)),
    db.select().from(instruments).where(eq(instruments.userId, session!.uid)),
    db.select().from(strategies).where(eq(strategies.userId, session!.uid)),
    db.select({ instrument: trades.instrument, direction: trades.direction, entryAt: trades.entryAt }).from(trades).where(eq(trades.userId, session!.uid)),
  ]);
  const account = body.accountId
    ? accounts.find((candidate) => candidate.id === body.accountId)
    : accounts[0];
  if (!account) return jsonError(body.accountId ? "Account not found" : "Create an account first", 404);
  if (body.csv === undefined && !Array.isArray(body.rows)) return jsonError("csv required");

  const instrumentMap = new Map<string, InstrumentSpec>(
    instrumentRows.map((row) => [row.symbol.toUpperCase(), row]),
  );
  const strategyMap = new Map<string, string>(strategyRows.map((row) => [row.name.toLowerCase(), row.id]));

  if (body.commit) {
    if (!Array.isArray(body.rows)) return jsonError("Preview rows required");
    if (body.rows.length > MAX_ROWS) return jsonError(`Import is limited to ${MAX_ROWS} rows`);
    const created: string[] = [];
    const rejected: { line: number; error: string }[] = [];
    const seen: ExistingTrade[] = [...saved];
    for (const [index, row] of (body.rows as Partial<PreviewRow>[]).entries()) {
      const line = Number.isSafeInteger(row.line) && Number(row.line) > 0 ? Number(row.line) : index + 2;
      if (!row.data || typeof row.data !== "object") {
        rejected.push({ line, error: "Malformed preview row" });
        continue;
      }
      const data = canonicalRow(row.data, false);
      const prepared = prepareRow(data, line, account.id, instrumentMap, strategyMap, seen);
      if (!prepared.payload) {
        rejected.push({
          line,
          error: [...prepared.preview.errors, prepared.duplicate ? "duplicate" : ""].filter(Boolean).join("; "),
        });
        continue;
      }
      try {
        const trade = await createTrade(session!.uid, prepared.payload);
        created.push(trade.displayId);
        seen.push(prepared.existing);
      } catch (cause) {
        rejected.push({ line, error: cause instanceof Error ? cause.message : "Failed to import" });
      }
    }
    return NextResponse.json({ created, rejected, imported: created.length });
  }

  if (typeof body.csv !== "string" || body.csv.length > MAX_CSV_CHARS) {
    return jsonError(`CSV must be text and at most ${MAX_CSV_CHARS.toLocaleString()} characters`);
  }
  let parsedCsv: ReturnType<typeof parseCsv>;
  try {
    parsedCsv = parseCsv(body.csv);
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Invalid CSV");
  }
  if (parsedCsv.rows.length > MAX_ROWS) return jsonError(`Import is limited to ${MAX_ROWS} rows`);
  const seen: ExistingTrade[] = [...saved];
  const preview = parsedCsv.rows.map((raw, index) => {
    const prepared = prepareRow(
      canonicalRow(raw, true),
      parsedCsv.lineMap[index],
      account.id,
      instrumentMap,
      strategyMap,
      seen,
    );
    if (!prepared.preview.errors.length && !prepared.duplicate) seen.push(prepared.existing);
    return prepared.preview;
  });

  return NextResponse.json({
    headers: parsedCsv.headers,
    preview,
    valid: preview.filter((row) => !row.errors.length && !row.duplicate).length,
    rejected: preview.filter((row) => row.errors.length || row.duplicate).length,
  });
}
