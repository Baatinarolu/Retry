import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_KIND,
  BACKUP_TABLES,
  BACKUP_VERSION,
  decodeBackupAttachment,
  parseBackup,
  reviveBackupData,
  validateBackupReferences,
  type BackupEnvelope,
} from "../src/lib/backup";

const accountId = "00000000-0000-4000-8000-000000000011";
const tradeId = "00000000-0000-4000-8000-000000000012";
const screenshotId = "00000000-0000-4000-8000-000000000013";

function emptyBackup(): BackupEnvelope {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: "2026-10-25T12:00:00.000Z",
    user: { name: "Test User", timezone: "UTC", theme: "dark", baseCurrency: "USD" },
    data: Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as unknown as BackupEnvelope["data"],
    attachments: [],
  };
}

test("versioned backup covers every workspace table and strips credential fields", () => {
  const input = { ...emptyBackup(), user: { ...emptyBackup().user, passwordHash: "must-not-survive", sessionVersion: 99 } };
  const parsed = parseBackup(input);
  assert.deepEqual(Object.keys(parsed.data).sort(), [...BACKUP_TABLES].sort());
  assert.equal("passwordHash" in parsed.user, false);
  assert.equal("sessionVersion" in parsed.user, false);
  assert.equal(validateBackupReferences(parsed).tradingAccounts.size, 0);
});

test("restore validation rejects cross-workspace references and duplicate IDs before deletion", () => {
  const backup = emptyBackup();
  backup.data.tradingAccounts.push({ id: accountId });
  backup.data.trades.push({ id: tradeId, accountId: "00000000-0000-4000-8000-000000000099" });
  assert.throws(() => validateBackupReferences(backup), /outside this backup/);

  const duplicate = emptyBackup();
  duplicate.data.tradingAccounts.push({ id: accountId }, { id: accountId });
  assert.throws(() => validateBackupReferences(duplicate), /duplicate ID/);
});

test("attachments are required, size checked, and image signatures validated", () => {
  const backup = emptyBackup();
  backup.data.tradingAccounts.push({ id: accountId });
  backup.data.trades.push({ id: tradeId, accountId });
  backup.data.screenshots.push({ id: screenshotId, tradeId });
  assert.throws(() => validateBackupReferences(backup), /no retained attachment/);

  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  backup.attachments.push({ screenshotId, mimeType: "image/png", data: png.toString("base64") });
  assert.equal(validateBackupReferences(backup).screenshots.has(screenshotId), true);
  assert.equal(decodeBackupAttachment(backup.attachments[0]).equals(png), true);

  const invalid = { ...backup.attachments[0], data: Buffer.from("not an image").toString("base64") };
  assert.throws(() => decodeBackupAttachment(invalid), /contents do not match/);
});

test("timestamp revival preserves calendar dates and rejects malformed instants", () => {
  const backup = emptyBackup();
  backup.data.tradingAccounts.push({ id: accountId, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null });
  backup.data.dailyJournals.push({ id: tradeId, accountId, journalDate: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z" });
  const revived = reviveBackupData(backup.data);
  assert.equal(revived.tradingAccounts[0].createdAt instanceof Date, true);
  assert.equal(revived.dailyJournals[0].journalDate, "2026-01-01");
  backup.data.trades.push({ id: tradeId, accountId, entryAt: "not-a-date" });
  assert.throws(() => reviveBackupData(backup.data), /invalid timestamp/);
});
