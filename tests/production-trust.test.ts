import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { rateLimitResult } from "../src/lib/rate-limit-policy";

const guardedRoutes: Record<string, string[]> = {
  "src/app/api/accounts/route.ts": ["POST", "PATCH", "DELETE"],
  "src/app/api/ai/route.ts": ["POST"],
  "src/app/api/backtests/route.ts": ["POST", "DELETE"],
  "src/app/api/backup/route.ts": ["POST"],
  "src/app/api/cash-flows/route.ts": ["POST", "PATCH", "DELETE"],
  "src/app/api/fx-rates/route.ts": ["POST", "DELETE"],
  "src/app/api/import/route.ts": ["POST", "DELETE"],
  "src/app/api/import-mappings/route.ts": ["POST", "PATCH", "DELETE"],
  "src/app/api/instruments/route.ts": ["POST", "DELETE"],
  "src/app/api/journal/route.ts": ["POST"],
  "src/app/api/risk/route.ts": ["PATCH"],
  "src/app/api/screenshots/[id]/route.ts": ["PATCH", "DELETE"],
  "src/app/api/settings/route.ts": ["PATCH", "DELETE"],
  "src/app/api/strategies/route.ts": ["POST", "PATCH", "DELETE"],
  "src/app/api/tags/route.ts": ["POST", "DELETE"],
  "src/app/api/trades/[id]/route.ts": ["PATCH", "DELETE"],
  "src/app/api/trades/[id]/review/route.ts": ["PATCH"],
  "src/app/api/trades/[id]/price-path/route.ts": ["POST", "DELETE"],
  "src/app/api/trades/[id]/risk-levels/route.ts": ["POST", "DELETE"],
  "src/app/api/trades/[id]/reverse/route.ts": ["POST"],
  "src/app/api/trades/[id]/screenshots/route.ts": ["POST"],
  "src/app/api/trades/route.ts": ["POST"],
  "src/app/api/views/route.ts": ["POST", "PATCH", "DELETE"],
};

test("every workspace-mutating API handler requires a writable non-demo user", () => {
  for (const [filename, methods] of Object.entries(guardedRoutes)) {
    const source = readFileSync(filename, "utf8");
    for (const method of methods) {
      const start = source.indexOf(`export async function ${method}`);
      assert.notEqual(start, -1, `${filename} ${method} exists`);
      const next = source.indexOf("export async function ", start + 1);
      const handler = source.slice(start, next === -1 ? source.length : next);
      assert.match(handler, /requireUser\(\{ write: true \}\)/, `${filename} ${method} has the demo write guard`);
    }
  }
  const api = readFileSync("src/lib/api.ts", "utf8");
  assert.match(api, /options\.write && user\.demoMode/);
});

test("saved trade details expose chart uploads without opening the editor", () => {
  const source = readFileSync("src/app/(app)/trades/[id]/page.tsx", "utf8");
  assert.match(source, /id="chart-screenshots"/);
  assert.match(source, /<ScreenshotUploader onUpload=\{uploadShot\} \/>/);
  assert.match(source, /<ScreenshotGallery/);
  assert.match(source, /<TradeTimeline/);
  assert.ok(source.indexOf("<ScreenshotUploader") < source.indexOf("<TradeForm"), "upload is not buried inside the editor");
});

test("trade evidence upgrades preserve direct metadata controls and multi-input uploads", () => {
  const uploader = readFileSync("src/components/ScreenshotUploader.tsx", "utf8");
  assert.match(uploader, /multiple/);
  assert.match(uploader, /onDrop=/);
  assert.match(uploader, /onPaste=/);
  const gallery = readFileSync("src/components/ScreenshotGallery.tsx", "utf8");
  assert.match(gallery, /method: "PATCH"/);
  assert.match(gallery, /method: "DELETE"/);
  assert.match(gallery, /Download original/);
  const timeline = readFileSync("src/lib/trade-timeline.ts", "utf8");
  assert.match(timeline, /shown at upload time/);
  assert.match(timeline, /never feeds execution, risk, or P&L calculations/);
});

test("rate-limit policy preserves exact boundaries and Retry-After values", () => {
  const now = new Date("2026-10-25T12:00:00.000Z");
  const resetAt = new Date(now.getTime() + 30_000);
  assert.deepEqual(rateLimitResult(3, 3, resetAt, now), {
    ok: true,
    remaining: 0,
    resetAt,
    retryAfterSeconds: 30,
  });
  assert.equal(rateLimitResult(4, 3, resetAt, now).ok, false);
  assert.equal(rateLimitResult(4, 3, resetAt, now).remaining, 0);
  assert.equal(rateLimitResult(4, 3, new Date(now.getTime() - 1), now).retryAfterSeconds, 1);
});

test("auth and AI use the shared atomic limiter rather than process-local buckets", () => {
  const limiter = readFileSync("src/lib/rate-limit.ts", "utf8");
  assert.match(limiter, /onConflictDoUpdate/);
  assert.match(limiter, /createHash/);
  assert.doesNotMatch(readFileSync("src/lib/auth.ts", "utf8"), /const buckets/);
  assert.match(readFileSync("src/app/api/auth/[action]/route.ts", "utf8"), /await rateLimit/);
  assert.match(readFileSync("src/app/api/ai/route.ts", "utf8"), /await rateLimit/);
});
