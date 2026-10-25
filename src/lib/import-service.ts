import { db } from "@/db";
import { importBatches, screenshots, trades, tradingAccounts, users } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { deleteScreenshotFiles } from "@/lib/screenshot-storage";
import { rebuildAccountBalances } from "@/lib/trade-service";
import { hashImportFile } from "@/lib/import-trust";
import type { ImportColumnMapping } from "@/lib/import-mapping";

export async function createImportBatch(
  userId: string,
  accountId: string,
  fileName: string,
  originalCsv: string,
  totalRows: number,
  rejectedRows: number,
  columnMapping: ImportColumnMapping = {},
) {
  const [account] = await db.select({ id: tradingAccounts.id }).from(tradingAccounts)
    .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId))).limit(1);
  if (!account) throw new Error("Choose an account you own");
  const [batch] = await db.insert(importBatches).values({
    userId,
    accountId,
    fileName: fileName.slice(0, 200),
    fileHash: hashImportFile(originalCsv),
    originalCsv,
    columnMapping,
    totalRows,
    rejectedRows,
  }).returning();
  return batch;
}

export async function getImportBatch(userId: string, batchId: string) {
  const [batch] = await db.select().from(importBatches)
    .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId))).limit(1);
  return batch || null;
}

export async function rollbackImportBatch(userId: string, batchId: string) {
  let files: string[] = [];
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    if (!user) throw new Error("User not found");
    const [batch] = await tx.select().from(importBatches)
      .where(and(eq(importBatches.id, batchId), eq(importBatches.userId, userId))).for("update");
    if (!batch) return null;
    if (batch.status !== "committed") throw new Error("Only a committed import batch can be rolled back");

    const imported = await tx.select({ id: trades.id, accountId: trades.accountId }).from(trades)
      .where(and(eq(trades.importBatchId, batchId), eq(trades.userId, userId)));
    const ids = imported.map((trade) => trade.id);
    if (ids.length) {
      files = (await tx.select({ fileName: screenshots.fileName }).from(screenshots)
        .where(inArray(screenshots.tradeId, ids))).map((file) => file.fileName);
      await tx.delete(trades).where(inArray(trades.id, ids));
    }
    for (const accountId of [...new Set(imported.map((trade) => trade.accountId))]) {
      await tx.select({ id: tradingAccounts.id }).from(tradingAccounts)
        .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId))).for("update");
      await rebuildAccountBalances(tx, accountId);
    }
    await tx.update(importBatches).set({ status: "rolled_back", rolledBackAt: new Date() })
      .where(eq(importBatches.id, batchId));
    return { deleted: ids.length };
  });
  if (result && files.length) await deleteScreenshotFiles(userId, files).catch(() => undefined);
  return result;
}
