import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants";
import { settingsSchema } from "@/lib/validations";
import { z } from "zod";

export const BACKUP_KIND = "trademind-workspace";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 48 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 32 * 1024 * 1024;

export const BACKUP_TABLES = [
  "tradingAccounts",
  "cashFlows",
  "riskSettings",
  "instruments",
  "strategies",
  "tags",
  "savedViews",
  "importBatches",
  "trades",
  "tradeExecutions",
  "tradeTags",
  "psychologyRecords",
  "screenshots",
  "dailyJournals",
  "backtests",
  "backtestTrades",
  "aiReviews",
  "customSessions",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type BackupRow = Record<string, any>;

const rowSchema = z.record(z.string(), z.unknown());
const rowsSchema = z.array(rowSchema).max(100_000);
const dataSchema = z.object(Object.fromEntries(BACKUP_TABLES.map((key) => [
  key,
  key === "savedViews" ? rowsSchema.optional().default([]) : rowsSchema,
])) as Record<BackupTable, typeof rowsSchema>);
const attachmentSchema = z.object({
  screenshotId: z.string().uuid(),
  mimeType: z.string().max(120),
  data: z.string().max(MAX_BACKUP_BYTES),
});
const backupUserSchema = settingsSchema.extend({
  onboardingComplete: z.boolean().optional(),
});

export const backupEnvelopeSchema = z.object({
  kind: z.literal(BACKUP_KIND),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string().max(80),
  user: backupUserSchema,
  data: dataSchema,
  attachments: z.array(attachmentSchema).max(100_000),
});

export type BackupAttachment = z.infer<typeof attachmentSchema>;
export type BackupEnvelope = {
  kind: typeof BACKUP_KIND;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  user: z.infer<typeof backupUserSchema>;
  data: Record<BackupTable, BackupRow[]>;
  attachments: BackupAttachment[];
};

export function parseBackup(input: unknown): BackupEnvelope {
  const parsed = backupEnvelopeSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid workspace backup: ${parsed.error.issues[0]?.message || "invalid structure"}`);
  return parsed.data as BackupEnvelope;
}

function idSet(rows: BackupRow[], table: string) {
  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.id !== "string" || !z.string().uuid().safeParse(row.id).success) {
      throw new Error(`${table} contains an invalid or missing ID`);
    }
    if (ids.has(row.id)) throw new Error(`${table} contains duplicate ID ${row.id}`);
    ids.add(row.id);
  }
  return ids;
}

function reference(value: unknown, ids: Set<string>, table: string, field: string, optional = true) {
  if ((value === null || value === undefined || value === "") && optional) return;
  if (typeof value !== "string" || !ids.has(value)) throw new Error(`${table}.${field} references a record outside this backup`);
}

function validSignature(mimeType: string, buffer: Buffer) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export function decodeBackupAttachment(attachment: BackupAttachment) {
  if (!ALLOWED_IMAGE_TYPES.includes(attachment.mimeType)) throw new Error("Backup contains an unsupported attachment type");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(attachment.data) || attachment.data.length % 4 === 1) {
    throw new Error("Backup contains invalid attachment encoding");
  }
  const buffer = Buffer.from(attachment.data, "base64");
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) throw new Error("Backup attachments must be non-empty images of 4 MB or smaller");
  if (!validSignature(attachment.mimeType, buffer)) throw new Error("Backup attachment contents do not match their declared image type");
  return buffer;
}

/** Reject broken ownership references before any existing workspace data is deleted. */
export function validateBackupReferences(backup: BackupEnvelope) {
  const data = backup.data;
  const ids = Object.fromEntries(BACKUP_TABLES.map((table) => [table, idSet(data[table], table)])) as Record<BackupTable, Set<string>>;
  for (const row of data.cashFlows) reference(row.accountId, ids.tradingAccounts, "cashFlows", "accountId", false);
  for (const row of data.riskSettings) reference(row.accountId, ids.tradingAccounts, "riskSettings", "accountId");
  for (const row of data.importBatches) reference(row.accountId, ids.tradingAccounts, "importBatches", "accountId", false);
  for (const row of data.dailyJournals) reference(row.accountId, ids.tradingAccounts, "dailyJournals", "accountId");
  for (const row of data.strategies) reference(row.parentStrategyId, ids.strategies, "strategies", "parentStrategyId");
  for (const row of data.trades) {
    reference(row.accountId, ids.tradingAccounts, "trades", "accountId", false);
    reference(row.strategyId, ids.strategies, "trades", "strategyId");
    reference(row.importBatchId, ids.importBatches, "trades", "importBatchId");
  }
  for (const row of data.tradeExecutions) reference(row.tradeId, ids.trades, "tradeExecutions", "tradeId", false);
  for (const row of data.psychologyRecords) reference(row.tradeId, ids.trades, "psychologyRecords", "tradeId", false);
  for (const row of data.screenshots) reference(row.tradeId, ids.trades, "screenshots", "tradeId", false);
  for (const row of data.tradeTags) {
    reference(row.tradeId, ids.trades, "tradeTags", "tradeId", false);
    reference(row.tagId, ids.tags, "tradeTags", "tagId", false);
  }
  for (const row of data.backtests) reference(row.strategyId, ids.strategies, "backtests", "strategyId");
  for (const row of data.backtestTrades) reference(row.backtestId, ids.backtests, "backtestTrades", "backtestId", false);

  const attachmentIds = new Set<string>();
  let totalBytes = 0;
  for (const attachment of backup.attachments) {
    if (attachmentIds.has(attachment.screenshotId)) throw new Error("Backup contains duplicate attachment records");
    attachmentIds.add(attachment.screenshotId);
    if (!ids.screenshots.has(attachment.screenshotId)) throw new Error("Backup attachment references a missing screenshot");
    totalBytes += decodeBackupAttachment(attachment).length;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) throw new Error("Backup attachments exceed the 32 MB restore limit");
  }
  for (const screenshot of data.screenshots) {
    if (!attachmentIds.has(screenshot.id)) throw new Error(`Screenshot ${screenshot.id} has no retained attachment in this backup`);
  }
  return ids;
}

const TIMESTAMP_COLUMNS: Partial<Record<BackupTable, string[]>> = {
  tradingAccounts: ["createdAt", "updatedAt"],
  cashFlows: ["occurredAt", "createdAt", "updatedAt"],
  riskSettings: ["createdAt", "updatedAt"],
  instruments: ["createdAt"],
  strategies: ["createdAt", "updatedAt"],
  tags: ["createdAt"],
  savedViews: ["createdAt", "updatedAt"],
  importBatches: ["createdAt", "committedAt", "rolledBackAt"],
  trades: ["entryAt", "exitAt", "realizedAt", "reviewedAt", "createdAt", "updatedAt"],
  tradeExecutions: ["executedAt"],
  screenshots: ["createdAt"],
  dailyJournals: ["createdAt", "updatedAt"],
  backtests: ["createdAt", "updatedAt"],
  backtestTrades: ["entryAt", "exitAt", "createdAt"],
  aiReviews: ["createdAt"],
};

export function reviveBackupData(data: Record<BackupTable, BackupRow[]>) {
  return Object.fromEntries(BACKUP_TABLES.map((table) => [
    table,
    data[table].map((row) => {
      const revived = { ...row };
      for (const column of TIMESTAMP_COLUMNS[table] || []) {
        const value = revived[column];
        if (value === null || value === undefined || value === "") continue;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new Error(`${table}.${column} contains an invalid timestamp`);
        revived[column] = date;
      }
      return revived;
    }),
  ])) as Record<BackupTable, BackupRow[]>;
}
