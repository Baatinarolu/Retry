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
  "src/app/api/trades/route.ts": ["POST", "PATCH"],
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

test("journal workflow keeps bulk review owned, atomic, and non-destructive to next actions", () => {
  const route = readFileSync("src/app/api/trades/route.ts", "utf8");
  assert.match(route, /db.transaction/);
  assert.match(route, /owned.length !== parsed.data.ids.length/);
  assert.match(route, /parsed.data.nextAction !== undefined/);
  assert.match(route, /ilike\(tags.name/);
  const page = readFileSync("src/app/(app)/journal/page.tsx", "utf8");
  assert.match(page, /<JournalTableSettings/);
  assert.match(page, /<ActiveJournalFilters/);
  assert.match(page, /<BulkReviewBar/);
});

test("currency inputs distinguish native trade math from reporting conversion", () => {
  const fxPanel = readFileSync("src/components/FxRatesPanel.tsx", "utf8");
  assert.match(fxPanel, /Rate \(target per 1 source\)/);
  assert.match(fxPanel, /starting balances use the latest rate effective at the report time/);
  assert.match(fxPanel, /Use current UTC time/);
  assert.match(fxPanel, /id="fx-rates"/);
  assert.match(fxPanel, /saved for/);
  assert.doesNotMatch(fxPanel, /placeholder="0\.000666667"/);
  const errorBanner = readFileSync("src/components/ReportingErrorBanner.tsx", "utf8");
  assert.match(errorBanner, /Open report filters/);
  assert.match(errorBanner, /settings#fx-rates/);
  for (const page of ["dashboard", "analytics", "calendar", "reports", "psychology"]) {
    assert.match(readFileSync(`src/app/(app)/${page}/page.tsx`, "utf8"), /ReportingErrorBanner/);
  }
  const settings = readFileSync("src/app/(app)/settings/page.tsx", "utf8");
  assert.match(settings, /Pip value \(account currency \/ lot\)/);
  assert.match(settings, /Quote currency/);
  const form = readFileSync("src/components/TradeForm.tsx", "utf8");
  assert.match(form, /No automatic \{quoteCurrency\} → \{currency\} trade-P&amp;L conversion/);
  assert.match(form, /calculationBasis/);
  assert.match(form, /calculationTrace/);
  assert.match(form, /Use saved \{form.instrument\} specification/);
  assert.match(form, /apiJson<\{ instruments\?: Instrument\[\] \}>\("\/api\/instruments"\)/);
  assert.match(form, /How should we record P&amp;L\?/);
  assert.match(form, /Calculate automatically/);
  assert.match(form, /Use broker P&amp;L/);
  assert.match(form, /Final net P&L from broker/);
  assert.match(form, /specificationMatchesTemplate/);
  assert.match(form, /tradeId \|\| hasDraft \|\| !specificationUntouched/);
  assert.match(form, /Enter the lot size or contract quantity exactly as shown by your broker/);
  assert.match(form, /positionSize: ""/);
  assert.match(form, /lotSize: ""/);
  assert.doesNotMatch(form, /positionSize: "0\.5"/);
});

test("basic workspace options stay independent of risk profiles and FX-converted statistics", () => {
  const bootstrap = readFileSync("src/app/api/bootstrap/route.ts", "utf8");
  assert.doesNotMatch(bootstrap, /riskSettings/);
  const strategies = readFileSync("src/app/api/strategies/route.ts", "utf8");
  assert.match(strategies, /searchParams.get\("basic"\) === "1"/);
  assert.ok(strategies.indexOf('searchParams.get("basic")') < strategies.indexOf("reportingContextFor(session!.uid"));
  const workspace = readFileSync("src/components/useWorkspace.ts", "utf8");
  assert.match(workspace, /\/api\/strategies\?basic=1/);
  const form = readFileSync("src/components/TradeForm.tsx", "utf8");
  assert.match(form, /apiJson<\{ strategies\?: Strategy\[\] \}>\("\/api\/strategies\?basic=1"\)/);
  assert.match(form, /cause instanceof Error \? cause.message/);
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
