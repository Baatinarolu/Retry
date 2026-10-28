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
const reversalId = "00000000-0000-4000-8000-000000000014";

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
  const input = { ...emptyBackup(), user: { ...emptyBackup().user, passwordHash: "must-not-survive", sessionVersion: 99, demoMode: true } };
  const parsed = parseBackup(input);
  assert.deepEqual(Object.keys(parsed.data).sort(), [...BACKUP_TABLES].sort());
  assert.equal("passwordHash" in parsed.user, false);
  assert.equal("sessionVersion" in parsed.user, false);
  assert.equal("demoMode" in parsed.user, false);
  assert.equal(validateBackupReferences(parsed).tradingAccounts.size, 0);
  const legacyData = Object.fromEntries(Object.entries(emptyBackup().data)
    .filter(([key]) => key !== "fxRates" && key !== "savedViews" && key !== "importMappingPresets" && key !== "tradePricePoints" && key !== "tradeRiskLevels"));
  const legacy = parseBackup({ ...emptyBackup(), data: legacyData });
  assert.deepEqual(legacy.data.fxRates, []);
  assert.deepEqual(legacy.data.savedViews, []);
  assert.deepEqual(legacy.data.importMappingPresets, []);
  assert.deepEqual(legacy.data.tradePricePoints, []);
  assert.deepEqual(legacy.data.tradeRiskLevels, []);
});

test("restore validation rejects cross-workspace references and duplicate IDs before deletion", () => {
  const backup = emptyBackup();
  backup.data.tradingAccounts.push({ id: accountId });
  backup.data.trades.push({ id: tradeId, accountId: "00000000-0000-4000-8000-000000000099" });
  assert.throws(() => validateBackupReferences(backup), /outside this backup/);

  const duplicate = emptyBackup();
  duplicate.data.tradingAccounts.push({ id: accountId }, { id: accountId });
  assert.throws(() => validateBackupReferences(duplicate), /duplicate ID/);

  const linked = emptyBackup();
  linked.data.tradingAccounts.push({ id: accountId });
  linked.data.trades.push(
    { id: tradeId, accountId },
    { id: reversalId, accountId, reversedFromTradeId: tradeId },
  );
  assert.equal(validateBackupReferences(linked).trades.size, 2);
  linked.data.trades[1].reversedFromTradeId = screenshotId;
  assert.throws(() => validateBackupReferences(linked), /outside this backup/);
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
  backup.data.fxRates.push({ id: tradeId, effectiveAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
  backup.data.dailyJournals.push({ id: tradeId, accountId, journalDate: "2026-01-01", createdAt: "2026-01-01T00:00:00.000Z" });
  backup.data.savedViews.push({ id: tradeId, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", filters: { direction: "long" } });
  backup.data.importMappingPresets.push({ id: tradeId, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", mapping: { instrument: "asset" } });
  backup.data.tradePricePoints.push({ id: tradeId, tradeId, observedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
  backup.data.tradeRiskLevels.push({ id: tradeId, tradeId, effectiveAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z" });
  const revived = reviveBackupData(backup.data);
  assert.equal(revived.tradingAccounts[0].createdAt instanceof Date, true);
  assert.equal(revived.fxRates[0].effectiveAt instanceof Date, true);
  assert.equal(revived.savedViews[0].updatedAt instanceof Date, true);
  assert.equal(revived.importMappingPresets[0].updatedAt instanceof Date, true);
  assert.equal(revived.tradePricePoints[0].observedAt instanceof Date, true);
  assert.equal(revived.tradeRiskLevels[0].effectiveAt instanceof Date, true);
  assert.equal(revived.dailyJournals[0].journalDate, "2026-01-01");
  backup.data.trades.push({ id: tradeId, accountId, entryAt: "2026-01-01T00:00:00.000Z", reviewedAt: "2026-01-02T00:00:00.000Z", reviewStatus: "reviewed", nextAction: "Wait for confirmation" });
  const withReview = reviveBackupData(backup.data);
  assert.equal(withReview.trades[0].reviewedAt instanceof Date, true);
  assert.equal(withReview.trades[0].nextAction, "Wait for confirmation");
  backup.data.trades[0].entryAt = "not-a-date";
  assert.throws(() => reviveBackupData(backup.data), /invalid timestamp/);
});

test("risk-setting backups accept legacy rows and preserve prop-plan JSON", () => {
  const legacy = emptyBackup();
  legacy.data.riskSettings.push({ id: tradeId, accountId, maxDailyLoss: "100", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  const parsedLegacy = parseBackup(legacy);
  assert.equal("propPlan" in parsedLegacy.data.riskSettings[0], false);

  const current = emptyBackup();
  const propPlan = {
    firmName: "Example",
    phases: [{ id: "phase-1", name: "Phase 1", targetPercent: "8" }],
    currentPhaseId: "phase-1",
    phaseStartedAt: "2026-01-01T00:00:00.000Z",
    phaseStartBalance: "100000",
    dailyDrawdownPercent: "4",
    dailyDrawdownBasis: "initial_balance",
    maxDrawdownPercent: "10",
    maxDrawdownMode: "trailing_balance",
  };
  current.data.riskSettings.push({ id: tradeId, accountId, propPlan, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  const revived = reviveBackupData(parseBackup(current).data);
  assert.deepEqual(revived.riskSettings[0].propPlan, propPlan);
  assert.equal(revived.riskSettings[0].createdAt instanceof Date, true);
  current.data.riskSettings[0].propPlan = { ...propPlan, dailyDrawdownPercent: "101" };
  assert.throws(() => parseBackup(current), /riskSettings propPlan/);
});
