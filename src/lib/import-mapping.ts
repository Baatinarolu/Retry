export const IMPORT_FIELD_DEFINITIONS = [
  { key: "instrument", label: "Instrument", aliases: ["instrument", "symbol", "ticker", "pair"] },
  { key: "direction", label: "Direction", aliases: ["direction", "side", "type", "buy_sell"] },
  { key: "entryAt", label: "Entry time", aliases: ["entry_at", "entry_time", "open_time", "time", "date"] },
  { key: "exitAt", label: "Exit time", aliases: ["exit_at", "exit_time", "close_time"] },
  { key: "entryPrice", label: "Entry price", aliases: ["entry_price", "open_price", "open"] },
  { key: "exitPrice", label: "Exit price", aliases: ["exit_price", "close_price", "close"] },
  { key: "stopLoss", label: "Stop loss", aliases: ["stop_loss", "sl"] },
  { key: "takeProfit", label: "Take profit", aliases: ["take_profit", "tp"] },
  { key: "lotSize", label: "Lot size", aliases: ["lot_size", "lots", "volume", "size", "qty"] },
  { key: "positionSize", label: "Position size", aliases: ["position_size", "quantity"] },
  { key: "contractSize", label: "Contract size", aliases: ["contract_size", "contract_multiplier", "multiplier"] },
  { key: "tickSize", label: "Tick size", aliases: ["tick_size"] },
  { key: "tickValue", label: "Tick value", aliases: ["tick_value", "point_value"] },
  { key: "pipSize", label: "Pip size", aliases: ["pip_size"] },
  { key: "pipValue", label: "Pip value", aliases: ["pip_value"] },
  { key: "totalCommission", label: "Trade-total commission", aliases: ["total_commission", "commission_total"] },
  { key: "commission", label: "Commission", aliases: ["commission", "fee", "fees"] },
  { key: "swap", label: "Swap / funding", aliases: ["swap", "swap_fee", "funding"] },
  { key: "slippage", label: "Slippage", aliases: ["slippage"] },
  { key: "netPnl", label: "Summary net P&L", aliases: ["net_pnl", "pnl", "profit", "net", "total_pnl", "total_net_pnl"] },
  { key: "totalPnl", label: "Execution-group net P&L override", aliases: ["total_pnl", "total_net_pnl"] },
  { key: "session", label: "Session", aliases: ["session"] },
  { key: "status", label: "Status", aliases: ["status", "state"] },
  { key: "marketCategory", label: "Market category", aliases: ["market_category", "category", "market", "asset_class"] },
  { key: "strategy", label: "Strategy", aliases: ["strategy", "strategy_name", "setup", "playbook"] },
  { key: "notes", label: "Notes", aliases: ["notes", "comment", "comments"] },
  { key: "sourceId", label: "Source / position ID", aliases: ["source_id", "trade_id", "position_id", "ticket"] },
  { key: "executionType", label: "Execution type", aliases: ["execution_type", "fill_type"] },
  { key: "executionPrice", label: "Execution price", aliases: ["execution_price", "fill_price", "price"] },
  { key: "executionQuantity", label: "Execution quantity", aliases: ["execution_quantity", "fill_quantity", "quantity", "size", "volume", "qty"] },
  { key: "executedAt", label: "Execution time", aliases: ["executed_at", "execution_time", "fill_time", "timestamp", "time", "date"] },
  { key: "executionFees", label: "Execution fees", aliases: ["execution_fees", "fill_fees", "fees", "commission", "fee"] },
] as const;

export type ImportField = (typeof IMPORT_FIELD_DEFINITIONS)[number]["key"];
export type ImportColumnMapping = Partial<Record<ImportField, string>>;

export const IMPORT_FIELD_KEYS = IMPORT_FIELD_DEFINITIONS.map((field) => field.key);
export const IMPORT_ALIASES = Object.fromEntries(
  IMPORT_FIELD_DEFINITIONS.map((field) => [field.key, [...field.aliases]]),
) as Record<ImportField, string[]>;

const IMPORT_FIELD_SET = new Set<string>(IMPORT_FIELD_KEYS);

/** Add explicit canonical columns without mutating the retained source rows. */
export function applyImportMapping(
  rows: Record<string, string>[],
  headers: string[],
  mapping: ImportColumnMapping,
) {
  const entries = Object.entries(mapping);
  if (!entries.length) return rows;
  const available = new Set(headers);
  for (const [field, source] of entries) {
    if (!IMPORT_FIELD_SET.has(field)) throw new Error(`Unknown import field: ${field}`);
    if (!source || !available.has(source)) throw new Error(`Mapped column "${source || field}" is missing from this CSV`);
  }
  return rows.map((row) => {
    const mapped = { ...row };
    for (const [field, source] of entries) mapped[field] = row[source!] ?? "";
    return mapped;
  });
}
