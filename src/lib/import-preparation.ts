import type { TradePayload } from "@/lib/trade-service";
import { importSource, isExecutionCsv, normalizeExecutionType, sourceConflict, type ImportSource } from "@/lib/import-trust";
import { tradeSchema } from "@/lib/validations";
import { IMPORT_ALIASES } from "@/lib/import-mapping";

export type ImportInstrumentSpec = {
  category: string;
  contractSize: string;
  tickSize: string;
  tickValue: string;
  pipSize: string;
  pipValue: string;
};

export type ImportPreparationOptions = {
  instrumentMap?: Map<string, ImportInstrumentSpec>;
  strategyMap?: Map<string, string>;
};

export type ImportPreviewRow = {
  line: number;
  data: Record<string, string>;
  errors: string[];
  duplicate: boolean;
};

export type PreparedImport = {
  preview: ImportPreviewRow[];
  payloads: Array<{ payload: TradePayload; line: number }>;
  valid: number;
  rejected: number;
  sourceRows: number;
  executionMode: boolean;
};

function pick(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

/** Accept both raw broker headers and the canonical rows returned by an older preview. */
export function canonicalRow(row: Record<string, string>) {
  const data: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(IMPORT_ALIASES)) {
    // An explicitly mapped canonical key is authoritative, including when its cell is blank.
    const value = Object.hasOwn(row, key) ? String(row[key] ?? "").trim() : pick(row, aliases);
    if (value) data[key] = value;
  }
  return data;
}

function directionOf(value: string): "long" | "short" | "" {
  const direction = value.trim().toLowerCase();
  if (["short", "sell", "s"].includes(direction)) return "short";
  if (["long", "buy", "b"].includes(direction)) return "long";
  return "";
}

function baseCandidate(data: Record<string, string>, accountId: string, options: ImportPreparationOptions): Record<string, unknown> {
  const instrument = (data.instrument || "").trim().toUpperCase();
  const spec = options.instrumentMap?.get(instrument);
  const direction = directionOf(data.direction || "");
  const strategyName = (data.strategy || "").trim().toLowerCase();
  const wantsClosed = Boolean(data.exitAt || data.exitPrice || data.netPnl);
  return {
    accountId,
    strategyId: strategyName ? options.strategyMap?.get(strategyName) || null : null,
    instrument,
    marketCategory: data.marketCategory || spec?.category || "forex",
    direction: direction || "long",
    entryAt: data.entryAt || "",
    exitAt: data.exitAt || null,
    entryPrice: data.entryPrice || "",
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
    commission: data.commission || data.totalCommission || "0",
    swap: data.swap || "0",
    slippage: data.slippage || "0",
    pnlOverridden: data.netPnl !== undefined && data.netPnl !== "",
    overrideNetPnl: data.netPnl || null,
    session: data.session || "other",
    notes: data.notes ? `${data.notes}\nImported from CSV` : "Imported from CSV",
    status: data.status || (wantsClosed ? "closed" : "open"),
  };
}

function makeRecord(
  candidate: Record<string, unknown>,
  data: Record<string, string>,
  line: number,
  identityRow: Record<string, string>,
  sourceId: string | undefined,
  seen: ImportSource[],
  preflightErrors: string[],
) {
  const errors = [...preflightErrors];
  let duplicate = false;
  let source: ImportSource | null = null;
  try {
    source = importSource(identityRow, sourceId);
    for (const existing of seen) {
      const conflict = sourceConflict(existing, source);
      if (conflict === "duplicate") duplicate = true;
      else if (conflict) errors.push(conflict);
    }
  } catch (cause) {
    errors.push(cause instanceof Error ? cause.message : "Invalid source identity");
  }

  const parsed = tradeSchema.safeParse(candidate);
  if (!parsed.success) {
    errors.push(...parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }
  const record = { line, data, errors, duplicate };
  if (!duplicate && !errors.length && parsed.success && source) {
    return { record, payload: { ...parsed.data, ...source }, source };
  }
  return { record, payload: null, source };
}

/** Prepare summary or explicitly grouped execution CSV without touching the database. */
export function prepareImport(
  rows: Record<string, string>[],
  lineMap: number[],
  accountId: string,
  savedSources: ImportSource[],
  options: ImportPreparationOptions = {},
): PreparedImport {
  const executionMode = rows.length > 0 && isExecutionCsv(Object.keys(rows[0]));
  const canonical = rows.map((row, index) => ({ data: canonicalRow(row), line: lineMap[index] ?? index + 2 }));
  const records: Array<Array<{ data: Record<string, string>; line: number }>> = executionMode
    ? [...canonical.reduce((groups, row) => {
        const key = row.data.sourceId || `missing:${row.line}`;
        const group = groups.get(key) || [];
        group.push(row);
        groups.set(key, group);
        return groups;
      }, new Map<string, Array<{ data: Record<string, string>; line: number }>>()).values()]
    : canonical.map((row) => [row]);

  const seen = [...savedSources];
  const preview: ImportPreviewRow[] = [];
  const payloads: PreparedImport["payloads"] = [];
  for (const group of records) {
    const data = group[0].data;
    const line = group[0].line;
    const preflightErrors: string[] = [];
    if (!directionOf(data.direction || "")) preflightErrors.push("Direction must be buy/long or sell/short");
    const strategyName = (data.strategy || "").trim().toLowerCase();
    if (strategyName && options.strategyMap && !options.strategyMap.has(strategyName)) preflightErrors.push("Strategy not found");
    let candidate = baseCandidate(data, accountId, options);
    let identityRow = data;
    const sourceId = data.sourceId;

    if (executionMode) {
      if (!sourceId) preflightErrors.push("Execution CSV requires trade_id or position_id on every fill");
      if (group.some((row) =>
        row.data.instrument.trim().toUpperCase() !== data.instrument.trim().toUpperCase() ||
        directionOf(row.data.direction || "") !== directionOf(data.direction || ""))) {
        preflightErrors.push("All fills in one execution group must share instrument and direction");
      }
      const executions = group.map((row) => {
        const type = normalizeExecutionType(row.data.executionType || "");
        if (!type) preflightErrors.push(`Line ${row.line}: execution_type must be entry, scale_in, scale_out, or exit`);
        return {
          type: type || "entry",
          price: row.data.executionPrice || row.data.entryPrice || row.data.exitPrice || "",
          quantity: row.data.executionQuantity || row.data.positionSize || row.data.lotSize || "",
          executedAt: row.data.executedAt || (type === "exit" || type === "scale_out" ? row.data.exitAt : row.data.entryAt) || "",
          fees: row.data.executionFees || "0",
          notes: `Imported line ${row.line}`,
        };
      });
      const sortedForIdentity = group
        .map((row) => row.data)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      identityRow = { rows: JSON.stringify(sortedForIdentity) };
      const earliest = [...executions].sort((a, b) => {
        const left = new Date(a.executedAt).getTime();
        const right = new Date(b.executedAt).getTime();
        return (Number.isNaN(left) ? 0 : left) - (Number.isNaN(right) ? 0 : right);
      })[0];
      candidate = {
        ...candidate,
        entryAt: data.entryAt || earliest?.executedAt || "",
        exitAt: null,
        entryPrice: null,
        exitPrice: null,
        positionSize: null,
        lotSize: null,
        commission: data.totalCommission || "0",
        overrideNetPnl: data.totalPnl || null,
        pnlOverridden: Boolean(data.totalPnl),
        status: data.status || (executions.some((execution) => execution.type === "exit") ? "closed" : "open"),
        executions,
      };
    }

    const result = makeRecord(candidate, data, line, identityRow, sourceId, seen, preflightErrors);
    preview.push(result.record);
    if (result.payload) {
      payloads.push({ payload: result.payload, line });
      if (result.source) seen.push(result.source);
    }
  }

  return {
    preview,
    payloads,
    valid: payloads.length,
    rejected: preview.filter((row) => row.duplicate || row.errors.length > 0).length,
    sourceRows: rows.length,
    executionMode,
  };
}
