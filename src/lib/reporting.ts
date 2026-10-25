const formatterCache = new Map<string, Intl.DateTimeFormat>();

export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function commonReportingCurrency(currencies: string[]) {
  const normalized = [...new Set(currencies.map((currency) => currency.trim().toUpperCase()).filter(Boolean))];
  if (normalized.length > 1) {
    throw new Error("Select one account for reporting. Cross-currency totals require explicit FX conversion.");
  }
  return normalized[0] ?? "USD";
}

export function isValidTimeZone(value: string) {
  if (!value || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function assertTimeZone(value: string | null | undefined) {
  const timeZone = value?.trim() || "UTC";
  if (!isValidTimeZone(timeZone)) throw new Error("Invalid reporting timezone");
  return timeZone;
}

function formatter(timeZone: string) {
  const key = assertTimeZone(timeZone);
  const cached = formatterCache.get(key);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat("en-US", {
    timeZone: key,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(key, created);
  return created;
}

function partsAt(value: Date, timeZone: string): CalendarDateParts {
  if (Number.isNaN(value.getTime())) throw new Error("Invalid reporting timestamp");
  const parts = formatter(timeZone).formatToParts(value);
  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function asUtc(parts: CalendarDateParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function sameParts(a: CalendarDateParts, b: CalendarDateParts) {
  return a.year === b.year && a.month === b.month && a.day === b.day &&
    a.hour === b.hour && a.minute === b.minute && a.second === b.second;
}

/** Convert a local wall-clock time to an instant, including DST offset changes. */
export function zonedDateTimeToUtc(parts: CalendarDateParts, timeZone = "UTC") {
  const target = asUtc(parts);
  let candidate = target;
  // Offset iteration handles both sides of a DST transition. A nonexistent
  // wall-clock time oscillates and is rejected by the round-trip check below.
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const actual = partsAt(new Date(candidate), timeZone);
    const offset = asUtc(actual) - candidate;
    const next = target - offset;
    if (next === candidate) break;
    candidate = next;
  }
  const result = new Date(candidate);
  if (!sameParts(partsAt(result, timeZone), parts)) {
    throw new Error("The selected local time does not exist in this timezone");
  }
  return result;
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftCalendarDate(value: string, days: number) {
  if (!isCalendarDate(value)) throw new Error("Invalid calendar date");
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function calendarDayStart(value: string, timeZone: string) {
  assertTimeZone(timeZone);
  // A few zones move their clocks at midnight. Find the first real wall-clock
  // minute instead of rejecting an otherwise valid reporting day.
  for (let minuteOffset = 0; minuteOffset <= 180; minuteOffset += 1) {
    const local = new Date(`${value}T00:00:00.000Z`);
    local.setUTCMinutes(local.getUTCMinutes() + minuteOffset);
    const parts = {
      year: local.getUTCFullYear(),
      month: local.getUTCMonth() + 1,
      day: local.getUTCDate(),
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
      second: 0,
    };
    try {
      return zonedDateTimeToUtc(parts, timeZone);
    } catch {
      // Try the next minute only for a nonexistent midnight boundary.
    }
  }
  throw new Error("The local calendar day has no valid start in this timezone");
}

/** Return [start, end) UTC instants for one local calendar day. */
export function calendarDayBounds(value: string, timeZone = "UTC") {
  if (!isCalendarDate(value)) throw new Error("Invalid calendar date");
  const start = calendarDayStart(value, timeZone);
  const end = calendarDayStart(shiftCalendarDate(value, 1), timeZone);
  return { start, end };
}

export function zonedDayKey(value: Date, timeZone = "UTC") {
  const parts = partsAt(value, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function zonedMonthKey(value: Date, timeZone = "UTC") {
  return zonedDayKey(value, timeZone).slice(0, 7);
}

export function zonedWeekday(value: Date, timeZone = "UTC") {
  return new Date(`${zonedDayKey(value, timeZone)}T00:00:00.000Z`).getUTCDay();
}

/** Return the Monday-start week containing an instant in the user's timezone. */
export function zonedWeekBounds(value: Date, timeZone = "UTC") {
  const day = zonedDayKey(value, timeZone);
  const weekday = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  const monday = shiftCalendarDate(day, -((weekday + 6) % 7));
  const start = calendarDayBounds(monday, timeZone).start;
  const end = calendarDayBounds(shiftCalendarDate(monday, 7), timeZone).start;
  return { start, end, monday };
}
