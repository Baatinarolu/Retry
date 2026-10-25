export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

export function rateLimitResult(count: number, limit: number, resetAt: Date, now: Date): RateLimitResult {
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}
