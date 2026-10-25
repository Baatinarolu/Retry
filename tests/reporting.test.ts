import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalytics, type TradeRow } from "../src/lib/analytics";
import {
  calendarDayBounds,
  commonReportingCurrency,
  isCalendarDate,
  isValidTimeZone,
  zonedDateTimeToUtc,
  zonedDayKey,
  zonedMonthKey,
  zonedWeekBounds,
  zonedWeekday,
} from "../src/lib/reporting";

test("calendar dates and timezone names are validated strictly", () => {
  assert.equal(isCalendarDate("2026-02-28"), true);
  assert.equal(isCalendarDate("2026-02-29"), false);
  assert.equal(isCalendarDate("2026-2-28"), false);
  assert.equal(isValidTimeZone("America/New_York"), true);
  assert.equal(isValidTimeZone("not/a-timezone"), false);
});

test("mixed currencies are never silently aggregated", () => {
  assert.equal(commonReportingCurrency(["usd", "USD"]), "USD");
  assert.equal(commonReportingCurrency([]), "USD");
  assert.throws(() => commonReportingCurrency(["USD", "NGN"]), /Cross-currency totals require explicit FX conversion/);
});

test("local day bounds respect spring and fall DST transitions", () => {
  const spring = calendarDayBounds("2026-03-08", "America/New_York");
  assert.equal(spring.start.toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(spring.end.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal((spring.end.getTime() - spring.start.getTime()) / 3_600_000, 23);

  const fall = calendarDayBounds("2026-11-01", "America/New_York");
  assert.equal(fall.start.toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(fall.end.toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal((fall.end.getTime() - fall.start.getTime()) / 3_600_000, 25);

  const midnightTransition = calendarDayBounds("2026-09-06", "America/Santiago");
  assert.equal(midnightTransition.start.toISOString(), "2026-09-06T04:00:00.000Z");
  assert.equal(midnightTransition.end.toISOString(), "2026-09-07T03:00:00.000Z");
});

test("day, month, weekday, and week buckets use the local calendar", () => {
  const instant = new Date("2026-03-08T00:30:00.000Z");
  assert.equal(zonedDayKey(instant, "America/New_York"), "2026-03-07");
  assert.equal(zonedMonthKey(instant, "America/New_York"), "2026-03");
  assert.equal(zonedWeekday(instant, "America/New_York"), 6);

  const week = zonedWeekBounds(new Date("2026-03-08T12:00:00.000Z"), "America/New_York");
  assert.equal(week.monday, "2026-03-02");
  assert.equal(week.start.toISOString(), "2026-03-02T05:00:00.000Z");
  assert.equal(week.end.toISOString(), "2026-03-09T04:00:00.000Z");
});

test("nonexistent local times are rejected instead of silently shifting a report", () => {
  assert.throws(
    () => zonedDateTimeToUtc(
      { year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 },
      "America/New_York",
    ),
    /does not exist/,
  );
});

test("analytics buckets the realization instant in the requested timezone", () => {
  const trade: TradeRow = {
    id: "trade-1",
    displayId: "TM-2026-0001",
    instrument: "EURUSD",
    strategyId: null,
    strategyName: null,
    session: "london",
    direction: "long",
    tradeType: "intraday",
    entryTimeframe: "15m",
    followedPlan: true,
    newsRelated: false,
    notes: "",
    netPnl: "10",
    grossPnl: "10",
    rMultiple: "1",
    result: "win",
    status: "closed",
    holdingMinutes: 60,
    entryAt: new Date("2026-03-07T20:00:00.000Z"),
    exitAt: new Date("2026-03-08T00:30:00.000Z"),
    realizedAt: new Date("2026-03-08T00:30:00.000Z"),
  };
  const analytics = buildAnalytics([trade], "1000", "America/New_York");
  assert.equal(analytics.daily[0].date, "2026-03-07");
  assert.equal(analytics.byWeekday[0].key, "Saturday");
  assert.equal(analytics.byMonth[0].key, "2026-03");
});
