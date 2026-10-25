import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const testDatabaseUrl = process.env.TRADEMIND_TEST_DATABASE_URL;

test("real PostgreSQL migrations, FX recovery, and concurrent fixed-window limiting", { skip: !testDatabaseUrl, timeout: 120_000 }, async () => {
  if (!testDatabaseUrl) return;
  assert.notEqual(testDatabaseUrl, process.env.DATABASE_URL, "Never run integration tests against the configured application database");
  process.env.DATABASE_URL = testDatabaseUrl;

  const { db, pool } = await import("../../src/db");
  try {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    const { fxRates, rateLimits, tradingAccounts, users } = await import("../../src/db/schema");
    const { rateLimit } = await import("../../src/lib/rate-limit");
    const { exportWorkspace, restoreWorkspace } = await import("../../src/lib/backup-service");
    const { reportingContextFor } = await import("../../src/lib/queries");
    const { eq, inArray } = await import("drizzle-orm");
    await migrate(db, { migrationsFolder: "drizzle" });

    const rawKey = `integration:${randomUUID()}`;
    const otherRawKey = `integration:${randomUUID()}`;
    const hashedKeys = [rawKey, otherRawKey].map((key) => createHash("sha256").update(`v1\0${key}`).digest("hex"));
    try {
      const results = await Promise.all(Array.from({ length: 16 }, () => rateLimit(rawKey, 10, 60_000)));
      assert.equal(results.filter((result) => result.ok).length, 10, "concurrent requests cannot exceed the shared limit");
      const [bucket] = await db.select().from(rateLimits).where(eq(rateLimits.key, hashedKeys[0])).limit(1);
      assert.equal(bucket.count, 16);
      assert.equal(bucket.key, hashedKeys[0]);
      assert.equal(bucket.key.includes(rawKey), false, "raw IP/user material is not stored");
      assert.equal((await rateLimit(otherRawKey, 10, 60_000)).ok, true, "independent keys do not share a process bucket");
    } finally {
      await db.delete(rateLimits).where(inArray(rateLimits.key, hashedKeys));
    }

    const [user] = await db.insert(users).values({
      email: `integration-${randomUUID()}@example.test`,
      passwordHash: "integration-only",
      name: "Integration recovery",
      baseCurrency: "NGN",
      timezone: "UTC",
    }).returning();
    try {
      await db.insert(tradingAccounts).values([
        { userId: user.id, name: "USD source", currency: "USD", startingBalance: "100", currentBalance: "100" },
        { userId: user.id, name: "NGN source", currency: "NGN", startingBalance: "150000", currentBalance: "150000" },
      ]);
      await db.insert(fxRates).values({
        userId: user.id,
        fromCurrency: "USD",
        toCurrency: "NGN",
        rate: "1500",
        effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
        source: "integration",
        notes: "disposable database check",
      });

      const context = await reportingContextFor(user.id, null, { convertMixed: true });
      assert.equal(context.currency, "NGN");
      assert.equal(context.startingBalance, "300000.00", "the live reporting path uses the dated USD/NGN quote");
      assert.equal(context.conversion.enabled, true);

      const backup = await exportWorkspace(user.id);
      assert.equal(backup.data.fxRates.length, 1, "the live export retains the FX rate book");
      assert.equal(backup.data.tradingAccounts.length, 2);
      await db.delete(fxRates).where(eq(fxRates.userId, user.id));
      const restored = await restoreWorkspace(user.id, backup);
      assert.equal(restored.restored.fxRates, 1);
      assert.equal(restored.accountsRebuilt, 2);
      assert.equal(restored.attachments, 0);
      const restoredRates = await db.select().from(fxRates).where(eq(fxRates.userId, user.id));
      assert.equal(restoredRates.length, 1, "a real restore recreates the deleted rate");
      assert.equal(restoredRates[0].fromCurrency, "USD");
      assert.equal(restoredRates[0].toCurrency, "NGN");
      const restoredAccounts = await db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, user.id));
      assert.equal(restoredAccounts.length, 2);
    } finally {
      await db.delete(users).where(eq(users.id, user.id));
    }
  } finally {
    await pool.end();
  }
});
