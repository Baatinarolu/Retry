import { db } from "@/db";
import { importBatches, instruments, strategies, trades, tradingAccounts } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTradesBatch } from "@/lib/trade-service";
import { createImportBatch, getImportBatch, rollbackImportBatch } from "@/lib/import-service";
import { prepareImport, type ImportInstrumentSpec, type ImportPreparationOptions } from "@/lib/import-preparation";
import type { ImportSource } from "@/lib/import-trust";
import { parseCsv } from "@/lib/csv";
import { jsonError, requireUser } from "@/lib/api";
import { applyImportMapping } from "@/lib/import-mapping";
import { importColumnMappingSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const MAX_ROWS = 5000;
const MAX_CSV_CHARS = 2_000_000;
const MAX_BODY_CHARS = 2_500_000;

function isUuid(value: string) {
  return z.string().uuid().safeParse(value).success;
}

const importSchema = z.object({
  commit: z.boolean().optional(),
  batchId: z.string().uuid().optional(),
  csv: z.string().max(MAX_CSV_CHARS).optional(),
  fileName: z.string().max(200).optional(),
  accountId: z.string().optional(),
  mapping: importColumnMappingSchema.optional(),
  rows: z.array(z.any()).max(MAX_ROWS).optional(),
});

async function resolveAccount(userId: string, requested?: string) {
  if (requested) {
    if (!isUuid(requested)) throw new Error("Invalid account ID");
    const [account] = await db.select().from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, requested), eq(tradingAccounts.userId, userId))).limit(1);
    if (!account) throw new Error("Account not found");
    return account;
  }
  const [account] = await db.select().from(tradingAccounts)
    .where(eq(tradingAccounts.userId, userId)).orderBy(desc(tradingAccounts.createdAt)).limit(1);
  if (!account) throw new Error("Create a trading account first");
  return account;
}

async function savedSources(userId: string, accountId: string): Promise<ImportSource[]> {
  const rows = await db.select({ sourceKey: trades.sourceKey, sourceHash: trades.sourceHash }).from(trades)
    .where(and(eq(trades.userId, userId), eq(trades.accountId, accountId)));
  return rows.filter((row) => Boolean(row.sourceKey)).map((row) => ({
    sourceKey: row.sourceKey!,
    sourceHash: row.sourceHash || "",
  }));
}

async function preparationOptions(userId: string): Promise<ImportPreparationOptions> {
  const [instrumentRows, strategyRows] = await Promise.all([
    db.select().from(instruments).where(eq(instruments.userId, userId)),
    db.select().from(strategies).where(eq(strategies.userId, userId)),
  ]);
  return {
    instrumentMap: new Map<string, ImportInstrumentSpec>(instrumentRows.map((row) => [row.symbol.toUpperCase(), row])),
    strategyMap: new Map<string, string>(strategyRows.map((row) => [row.name.toLowerCase(), row.id])),
  };
}

async function prepareForAccount(userId: string, accountId: string, rows: Record<string, string>[], lineMap: number[]) {
  const [sources, options] = await Promise.all([savedSources(userId, accountId), preparationOptions(userId)]);
  return prepareImport(rows, lineMap, accountId, sources, options);
}

function publicPreparation(prepared: ReturnType<typeof prepareImport>) {
  return {
    preview: prepared.preview,
    valid: prepared.valid,
    rejected: prepared.rejected,
    sourceRows: prepared.sourceRows,
    tradeRecords: prepared.preview.length,
    executionMode: prepared.executionMode,
  };
}

async function commitPrepared(userId: string, batchId: string, prepared: ReturnType<typeof prepareImport>) {
  const created = await createTradesBatch(userId, prepared.payloads.map((item) => item.payload), batchId);
  return NextResponse.json({
    batchId,
    imported: created.length,
    created: created.map((trade) => trade.displayId),
    ...publicPreparation(prepared),
    rejected: prepared.preview.filter((row) => row.duplicate || row.errors.length > 0).map((row) => ({
      ...row,
      error: [...row.errors, row.duplicate ? "duplicate" : ""].filter(Boolean).join("; "),
    })),
    rejectedCount: prepared.rejected,
    reconciliation: {
      sourceRows: prepared.sourceRows,
      tradeRecords: prepared.preview.length,
      imported: created.length,
      rejected: prepared.rejected,
    },
  });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_CHARS) return jsonError("Import request is too large (2 MB CSV maximum)", 413);
  const body = await request.json().catch(() => null);
  if (!body) return jsonError("Invalid payload");
  const parsedBody = importSchema.safeParse(body);
  if (!parsedBody.success) return jsonError(parsedBody.error.issues[0].message);

  try {
    const input = parsedBody.data;
    if (input.commit && input.batchId) {
      const batch = await getImportBatch(session!.uid, input.batchId);
      if (!batch) return jsonError("Import batch not found", 404);
      if (batch.status !== "preview") return jsonError("This import batch was already committed or rolled back", 409);
      const account = await resolveAccount(session!.uid, batch.accountId);
      const parsed = parseCsv(batch.originalCsv);
      if (parsed.rows.length > MAX_ROWS) return jsonError(`Import is limited to ${MAX_ROWS} rows`);
      const mappedRows = applyImportMapping(parsed.rows, parsed.headers, batch.columnMapping);
      const prepared = await prepareForAccount(session!.uid, account.id, mappedRows, parsed.lineMap);
      if (prepared.preview.length !== batch.totalRows) {
        return jsonError("The import format changed after preview. Preview the original file again.", 409);
      }
      return await commitPrepared(session!.uid, batch.id, prepared);
    }

    if (input.commit) {
      // Backward-compatible clients can still commit the old preview shape, but the write is now atomic.
      if (!input.rows) return jsonError("batchId is required for a new import commit");
      const account = await resolveAccount(session!.uid, input.accountId);
      const rows = input.rows.map((row) => row?.data && typeof row.data === "object" ? row.data : {});
      const lineMap = input.rows.map((row, index) => Number.isSafeInteger(row?.line) && row.line > 0 ? row.line : index + 2);
      const prepared = await prepareForAccount(session!.uid, account.id, rows, lineMap);
      const batch = await createImportBatch(session!.uid, account.id, "legacy-import.json", "", prepared.preview.length, prepared.rejected);
      return await commitPrepared(session!.uid, batch.id, prepared);
    }

    if (typeof input.csv !== "string") return jsonError("CSV text is required");
    const account = await resolveAccount(session!.uid, input.accountId);
    const parsed = parseCsv(input.csv);
    if (parsed.rows.length > MAX_ROWS) return jsonError(`Import is limited to ${MAX_ROWS} rows`);
    const columnMapping = input.mapping || {};
    const mappedRows = applyImportMapping(parsed.rows, parsed.headers, columnMapping);
    const prepared = await prepareForAccount(session!.uid, account.id, mappedRows, parsed.lineMap);
    const batch = await createImportBatch(
      session!.uid,
      account.id,
      input.fileName || "import.csv",
      input.csv,
      prepared.preview.length,
      prepared.rejected,
      columnMapping,
    );
    return NextResponse.json({
      batchId: batch.id,
      fileHash: batch.fileHash,
      accountId: account.id,
      headers: parsed.headers,
      columnMapping,
      ...publicPreparation(prepared),
    });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Import failed; no valid rows were partially committed");
  }
}

export async function GET(request: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const batchId = request.nextUrl.searchParams.get("id");
  if (batchId) {
    if (!isUuid(batchId)) return jsonError("Invalid batch ID");
    const batch = await getImportBatch(session!.uid, batchId);
    if (!batch) return jsonError("Import batch not found", 404);
    const { originalCsv: _originalCsv, ...metadata } = batch;
    return NextResponse.json({ batch: metadata });
  }
  const batches = await db.select({
    id: importBatches.id,
    accountId: importBatches.accountId,
    fileName: importBatches.fileName,
    fileHash: importBatches.fileHash,
    columnMapping: importBatches.columnMapping,
    status: importBatches.status,
    totalRows: importBatches.totalRows,
    importedRows: importBatches.importedRows,
    rejectedRows: importBatches.rejectedRows,
    createdAt: importBatches.createdAt,
    committedAt: importBatches.committedAt,
    rolledBackAt: importBatches.rolledBackAt,
  }).from(importBatches).where(eq(importBatches.userId, session!.uid)).orderBy(desc(importBatches.createdAt)).limit(30);
  return NextResponse.json({ batches });
}

export async function DELETE(request: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const batchId = request.nextUrl.searchParams.get("id");
  if (!batchId || !isUuid(batchId)) return jsonError("Invalid batch ID");
  try {
    const result = await rollbackImportBatch(session!.uid, batchId);
    if (!result) return jsonError("Import batch not found", 404);
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not roll back import");
  }
}
