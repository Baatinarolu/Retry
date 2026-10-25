import { createHash } from "node:crypto";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { lte, sql } from "drizzle-orm";
import { rateLimitResult, type RateLimitResult } from "@/lib/rate-limit-policy";

/** Atomic fixed-window limit shared by every application instance. Raw IP/user keys are hashed before storage. */
export async function rateLimit(key: string, limit = 20, windowMs = 60_000): Promise<RateLimitResult> {
  if (!key.trim() || key.length > 512) throw new Error("Rate-limit key must be non-empty and at most 512 characters");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100_000) throw new Error("Rate-limit limit must be a positive safe integer");
  if (!Number.isSafeInteger(windowMs) || windowMs < 1 || windowMs > 24 * 60 * 60 * 1000) throw new Error("Rate-limit window is invalid");

  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const bucketKey = createHash("sha256").update(`v1\0${key}`).digest("hex");
  const [row] = await db.insert(rateLimits).values({
    key: bucketKey,
    count: 1,
    resetAt,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: rateLimits.key,
    set: {
      count: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
      resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= ${now} THEN ${resetAt} ELSE ${rateLimits.resetAt} END`,
      updatedAt: now,
    },
  }).returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  // Best-effort hygiene without making cleanup failure a way to bypass the limiter.
  if (Math.random() < 0.01) await db.delete(rateLimits).where(lte(rateLimits.resetAt, now)).catch(() => undefined);
  return rateLimitResult(row.count, limit, row.resetAt, now);
}
