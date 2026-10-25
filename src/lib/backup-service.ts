import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  aiReviews,
  backtestTrades,
  backtests,
  cashFlows,
  customSessions,
  dailyJournals,
  importBatches,
  importMappingPresets,
  instruments,
  psychologyRecords,
  riskSettings,
  savedViews,
  screenshots,
  strategies,
  tags,
  tradeExecutions,
  tradePricePoints,
  tradeRiskLevels,
  tradeTags,
  trades,
  tradingAccounts,
  users,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  BACKUP_KIND,
  BACKUP_VERSION,
  BACKUP_TABLES,
  decodeBackupAttachment,
  parseBackup,
  reviveBackupData,
  validateBackupReferences,
  type BackupEnvelope,
  type BackupRow,
} from "@/lib/backup";
import { deleteScreenshotFiles, readScreenshotFile, saveScreenshotFile } from "@/lib/screenshot-storage";
import { rebuildAccountBalances } from "@/lib/trade-service";

function extensionFor(mimeType: string) {
  return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : mimeType === "image/gif" ? "gif" : "jpg";
}

function owned(rows: BackupRow[], userId: string) {
  return rows.map((row) => ({ ...row, userId }));
}

async function insertRows(tx: any, table: any, rows: BackupRow[]) {
  if (rows.length) await tx.insert(table).values(rows);
}

export async function exportWorkspace(userId: string): Promise<BackupEnvelope> {
  const [user] = await db.select({
    name: users.name,
    timezone: users.timezone,
    theme: users.theme,
    dateFormat: users.dateFormat,
    timeFormat: users.timeFormat,
    baseCurrency: users.baseCurrency,
    aiPermission: users.aiPermission,
    onboardingComplete: users.onboardingComplete,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User not found");

  const [
    tradingAccountRows,
    cashFlowRows,
    riskRows,
    instrumentRows,
    strategyRows,
    tagRows,
    savedViewRows,
    importMappingRows,
    importRows,
    tradeRows,
    executionRows,
    pricePointRows,
    riskLevelRows,
    tradeTagRows,
    psychologyRows,
    screenshotRows,
    journalRows,
    backtestRows,
    backtestTradeRows,
    aiReviewRows,
    sessionRows,
  ] = await Promise.all([
    db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, userId)),
    db.select().from(cashFlows).where(eq(cashFlows.userId, userId)),
    db.select().from(riskSettings).where(eq(riskSettings.userId, userId)),
    db.select().from(instruments).where(eq(instruments.userId, userId)),
    db.select().from(strategies).where(eq(strategies.userId, userId)),
    db.select().from(tags).where(eq(tags.userId, userId)),
    db.select().from(savedViews).where(eq(savedViews.userId, userId)),
    db.select().from(importMappingPresets).where(eq(importMappingPresets.userId, userId)),
    db.select().from(importBatches).where(eq(importBatches.userId, userId)),
    db.select().from(trades).where(eq(trades.userId, userId)),
    db.select().from(tradeExecutions).where(eq(tradeExecutions.userId, userId)),
    db.select().from(tradePricePoints).where(eq(tradePricePoints.userId, userId)),
    db.select().from(tradeRiskLevels).where(eq(tradeRiskLevels.userId, userId)),
    db.select({ id: tradeTags.id, tradeId: tradeTags.tradeId, tagId: tradeTags.tagId }).from(tradeTags)
      .innerJoin(trades, eq(tradeTags.tradeId, trades.id)).where(eq(trades.userId, userId)),
    db.select().from(psychologyRecords).where(eq(psychologyRecords.userId, userId)),
    db.select().from(screenshots).where(eq(screenshots.userId, userId)),
    db.select().from(dailyJournals).where(eq(dailyJournals.userId, userId)),
    db.select().from(backtests).where(eq(backtests.userId, userId)),
    db.select().from(backtestTrades).where(eq(backtestTrades.userId, userId)),
    db.select().from(aiReviews).where(eq(aiReviews.userId, userId)),
    db.select().from(customSessions).where(eq(customSessions.userId, userId)),
  ]);

  const attachments = [];
  for (const screenshot of screenshotRows) {
    const file = await readScreenshotFile(userId, screenshot.fileName);
    if (!file) throw new Error(`Screenshot ${screenshot.id} is missing from storage; backup was not created`);
    const buffer = Buffer.from(await new Response(file.body).arrayBuffer());
    attachments.push({
      screenshotId: screenshot.id,
      mimeType: screenshot.mimeType,
      data: buffer.toString("base64"),
    });
  }

  const backup: BackupEnvelope = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    user: { ...user, theme: user.theme === "light" ? "light" as const : "dark" as const },
    data: {
      tradingAccounts: tradingAccountRows,
      cashFlows: cashFlowRows,
      riskSettings: riskRows,
      instruments: instrumentRows,
      strategies: strategyRows,
      tags: tagRows,
      savedViews: savedViewRows,
      importMappingPresets: importMappingRows,
      importBatches: importRows,
      trades: tradeRows,
      tradeExecutions: executionRows,
      tradePricePoints: pricePointRows,
      tradeRiskLevels: riskLevelRows,
      tradeTags: tradeTagRows,
      psychologyRecords: psychologyRows,
      screenshots: screenshotRows,
      dailyJournals: journalRows,
      backtests: backtestRows,
      backtestTrades: backtestTradeRows,
      aiReviews: aiReviewRows,
      customSessions: sessionRows,
    },
    attachments,
  };
  validateBackupReferences(backup);
  return backup;
}

export async function restoreWorkspace(userId: string, input: unknown) {
  const backup = parseBackup(input);
  validateBackupReferences(backup);
  const data = reviveBackupData(backup.data);
  const attachmentById = new Map(backup.attachments.map((attachment) => [attachment.screenshotId, attachment]));
  const stagedReferences: string[] = [];
  const stagedByScreenshot = new Map<string, string>();
  const attachmentSizes = new Map<string, number>();
  let oldReferences: string[] = [];

  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
      if (!user) throw new Error("User not found");
      oldReferences = (await tx.select({ fileName: screenshots.fileName }).from(screenshots)
        .where(eq(screenshots.userId, userId))).map((shot) => shot.fileName);

      // Stage new private files before deleting any database rows. Failed restores clean these references.
      for (const screenshot of data.screenshots) {
        const attachment = attachmentById.get(screenshot.id)!;
        const buffer = decodeBackupAttachment(attachment);
        const reference = await saveScreenshotFile({
          userId,
          fileName: `restore-${randomUUID()}.${extensionFor(attachment.mimeType)}`,
          mimeType: attachment.mimeType,
          buffer,
        });
        stagedReferences.push(reference);
        stagedByScreenshot.set(screenshot.id, reference);
        attachmentSizes.set(screenshot.id, buffer.length);
      }

      const oldTradeIds = (await tx.select({ id: trades.id }).from(trades).where(eq(trades.userId, userId))).map((row) => row.id);
      if (oldTradeIds.length) await tx.delete(tradeTags).where(inArray(tradeTags.tradeId, oldTradeIds));
      await tx.delete(screenshots).where(eq(screenshots.userId, userId));
      await tx.delete(psychologyRecords).where(eq(psychologyRecords.userId, userId));
      await tx.delete(tradeExecutions).where(eq(tradeExecutions.userId, userId));
      await tx.delete(tradePricePoints).where(eq(tradePricePoints.userId, userId));
      await tx.delete(tradeRiskLevels).where(eq(tradeRiskLevels.userId, userId));
      await tx.delete(trades).where(eq(trades.userId, userId));
      await tx.delete(backtestTrades).where(eq(backtestTrades.userId, userId));
      await tx.delete(backtests).where(eq(backtests.userId, userId));
      await tx.delete(cashFlows).where(eq(cashFlows.userId, userId));
      await tx.delete(importBatches).where(eq(importBatches.userId, userId));
      await tx.delete(dailyJournals).where(eq(dailyJournals.userId, userId));
      await tx.delete(riskSettings).where(eq(riskSettings.userId, userId));
      await tx.delete(aiReviews).where(eq(aiReviews.userId, userId));
      await tx.delete(customSessions).where(eq(customSessions.userId, userId));
      await tx.delete(importMappingPresets).where(eq(importMappingPresets.userId, userId));
      await tx.delete(savedViews).where(eq(savedViews.userId, userId));
      await tx.delete(instruments).where(eq(instruments.userId, userId));
      await tx.delete(strategies).where(eq(strategies.userId, userId));
      await tx.delete(tags).where(eq(tags.userId, userId));
      await tx.delete(tradingAccounts).where(eq(tradingAccounts.userId, userId));

      await insertRows(tx, tradingAccounts, owned(data.tradingAccounts, userId));
      await insertRows(tx, instruments, owned(data.instruments, userId));
      await insertRows(tx, strategies, owned(data.strategies, userId));
      await insertRows(tx, tags, owned(data.tags, userId));
      await insertRows(tx, savedViews, owned(data.savedViews, userId));
      await insertRows(tx, importMappingPresets, owned(data.importMappingPresets, userId));
      await insertRows(tx, customSessions, owned(data.customSessions, userId));
      await insertRows(tx, aiReviews, owned(data.aiReviews, userId));
      await insertRows(tx, riskSettings, owned(data.riskSettings, userId));
      await insertRows(tx, importBatches, owned(data.importBatches, userId));
      await insertRows(tx, cashFlows, owned(data.cashFlows, userId));
      await insertRows(tx, dailyJournals, owned(data.dailyJournals, userId));
      await insertRows(tx, trades, owned(data.trades, userId));
      await insertRows(tx, tradeExecutions, owned(data.tradeExecutions, userId));
      await insertRows(tx, tradePricePoints, owned(data.tradePricePoints, userId));
      await insertRows(tx, tradeRiskLevels, owned(data.tradeRiskLevels, userId));
      await insertRows(tx, psychologyRecords, owned(data.psychologyRecords, userId));
      await insertRows(tx, screenshots, data.screenshots.map((row) => ({
        ...row,
        userId,
        fileName: stagedByScreenshot.get(row.id)!,
        sizeBytes: attachmentSizes.get(row.id)!,
      })));
      await insertRows(tx, tradeTags, data.tradeTags);
      await insertRows(tx, backtests, owned(data.backtests, userId));
      await insertRows(tx, backtestTrades, owned(data.backtestTrades, userId));

      await tx.update(users).set({ ...backup.user, updatedAt: new Date() }).where(eq(users.id, userId));
      for (const account of data.tradingAccounts) await rebuildAccountBalances(tx, account.id);
    });
  } catch (cause) {
    if (stagedReferences.length) await deleteScreenshotFiles(userId, stagedReferences).catch(() => undefined);
    throw cause;
  }

  let cleanupFailed = false;
  if (oldReferences.length) await deleteScreenshotFiles(userId, oldReferences).catch(() => { cleanupFailed = true; });
  return {
    version: BACKUP_VERSION,
    restored: Object.fromEntries(BACKUP_TABLES.map((table) => [table, data[table].length])),
    attachments: stagedReferences.length,
    accountsRebuilt: data.tradingAccounts.length,
    cleanupFailed,
  };
}
