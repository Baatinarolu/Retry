import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

const testDatabaseUrl = process.env.TRADEMIND_TEST_DATABASE_URL;

test("real PostgreSQL migrations and concurrent fixed-window limiting", { skip: !testDatabaseUrl, timeout: 120_000 }, async () => {
  if (!testDatabaseUrl) return;
  assert.notEqual(testDatabaseUrl, process.env.DATABASE_URL, "Never run integration tests against the configured application database");
  process.env.DATABASE_URL = testDatabaseUrl;

  const { db, pool } = await import("../../src/db");
  try {
    const { migrate } = await import("drizzle-orm/neon-serverless/migrator");
    const { rateLimits } = await import("../../src/db/schema");
    const { rateLimit } = await import("../../src/lib/rate-limit");
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
  } finally {
    await pool.end();
  }
});
