import Decimal from "decimal.js";
import { z } from "zod";
import { isValidTimeZone } from "./reporting";

const isBlank = (value: unknown) => value === "" || value === null || value === undefined;

function decimal(value: string | number) {
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(Number.NaN);
  }
}

function validDate(value: string) {
  return value.length > 0 && value.length <= 80 && !Number.isNaN(new Date(value).getTime());
}

function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const dateTimeString = z.string().refine(validDate, "Invalid date/time");
const calendarDateString = z.string().refine(validCalendarDate, "Use a valid YYYY-MM-DD date");
const optionalDateTimeString = z
  .string()
  .refine((value) => value === "" || validDate(value), "Invalid date/time")
  .nullable()
  .optional();

const optionalNumeric = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .refine((value) => isBlank(value) || decimal(value as string | number).isFinite(), "Must be a finite number");

const optionalPositive = optionalNumeric.refine(
  (value) => isBlank(value) || decimal(value as string | number).gt(0),
  "Must be greater than zero",
);
const optionalNonNegative = optionalNumeric.refine(
  (value) => isBlank(value) || decimal(value as string | number).gte(0),
  "Must be zero or greater",
);
const requiredNumeric = z
  .union([z.string(), z.number()])
  .refine((value) => value !== "" && decimal(value).isFinite(), "Must be a finite number");
const requiredPositive = requiredNumeric.refine((value) => decimal(value).gt(0), "Must be greater than zero");
const requiredNonNegative = requiredNumeric.refine((value) => decimal(value).gte(0), "Must be zero or greater");

const optionalUpdateNumber = z
  .union([z.string(), z.number()])
  .optional()
  .refine((value) => isBlank(value) || decimal(value as string | number).isFinite(), "Must be a finite number");
const optionalUpdateNonNegative = optionalUpdateNumber.refine(
  (value) => isBlank(value) || decimal(value as string | number).gte(0),
  "Must be zero or greater",
);

const optionalText = (max = 5000) => z.string().max(max).optional().default("");
const passwordSchema = z
  .string()
  .min(8)
  .max(120)
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 UTF-8 bytes");

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().max(160),
  password: passwordSchema,
  timezone: z.string().max(80).refine(isValidTimeZone, "Invalid timezone").optional(),
  baseCurrency: z.string().regex(/^[A-Za-z]{3,8}$/).optional(),
});

export const loginSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(1).max(120),
});

export const forgotSchema = z.object({
  email: z.string().email().max(160),
});

export const resetSchema = z.object({
  token: z.string().min(10).max(256),
  password: passwordSchema,
});

export const accountSchema = z.object({
  name: z.string().trim().min(1).max(80),
  broker: z.string().max(80).optional().default(""),
  currency: z.string().regex(/^[A-Za-z]{3,8}$/),
  startingBalance: requiredNonNegative,
  accountType: z.enum(["live", "demo", "prop", "paper"]).optional().default("live"),
  notes: z.string().max(2000).optional().default(""),
  isActive: z.boolean().optional().default(true),
});

export const tradeSchema = z
  .object({
    accountId: z.string().uuid(),
    strategyId: z.string().uuid().nullable().optional(),
    instrument: z.string().trim().min(1).max(32),
    marketCategory: z.string().max(32).optional().default("forex"),
    direction: z.enum(["long", "short"]),
    tradeType: z.string().max(32).optional().default("intraday"),
    session: z.string().max(40).optional().default("london"),
    timezone: z.string().max(80).refine(isValidTimeZone, "Invalid timezone").optional().default("UTC"),
    entryAt: dateTimeString,
    exitAt: optionalDateTimeString,
    entryPrice: optionalPositive,
    exitPrice: optionalPositive,
    stopLoss: optionalPositive,
    takeProfit: optionalPositive,
    positionSize: optionalPositive,
    lotSize: optionalPositive,
    contractSize: optionalNonNegative,
    tickSize: optionalNonNegative,
    tickValue: optionalNonNegative,
    pipSize: optionalNonNegative,
    pipValue: optionalNonNegative,
    commission: optionalNonNegative,
    swap: optionalNumeric,
    slippage: optionalNonNegative,
    overrideNetPnl: optionalNumeric,
    pnlOverridden: z.boolean().optional().default(false),
    status: z.enum(["open", "closed"]).optional().default("closed"),
    marketBias: optionalText(500),
    htfDirection: optionalText(500),
    entryTimeframe: z.string().max(20).optional().default("15m"),
    htfTimeframe: z.string().max(20).optional().default("4h"),
    marketStructure: optionalText(2000),
    entryModel: optionalText(500),
    confluence: optionalText(2000),
    entryReason: optionalText(),
    slJustification: optionalText(),
    tpJustification: optionalText(),
    invalidation: optionalText(),
    plannedExit: optionalText(),
    followedPlan: z.boolean().optional().default(true),
    newsRelated: z.boolean().optional().default(false),
    notes: optionalText(10_000),
    tagIds: z.array(z.string().uuid()).max(100).optional().default([]),
    executions: z
      .array(
        z.object({
          type: z.enum(["entry", "scale_in", "scale_out", "exit"]),
          price: requiredPositive,
          quantity: requiredPositive,
          executedAt: dateTimeString,
          fees: requiredNonNegative.optional(),
          notes: z.string().max(2000).optional(),
        }),
      )
      .max(500)
      .optional()
      .default([]),
    psychology: z
      .object({
        emotionBefore: optionalText(100),
        emotionDuring: optionalText(100),
        emotionAfter: optionalText(100),
        confidence: z.number().int().min(1).max(10).optional().default(5),
        patience: z.number().int().min(1).max(10).optional().default(5),
        fomo: z.boolean().optional().default(false),
        fear: z.boolean().optional().default(false),
        greed: z.boolean().optional().default(false),
        revenge: z.boolean().optional().default(false),
        overtrading: z.boolean().optional().default(false),
        hesitation: z.boolean().optional().default(false),
        impulsive: z.boolean().optional().default(false),
        earlyExit: z.boolean().optional().default(false),
        movedStop: z.boolean().optional().default(false),
        brokeRiskRules: z.boolean().optional().default(false),
        followedPlan: z.boolean().optional().default(true),
        lessons: optionalText(),
        didWell: optionalText(),
        improve: optionalText(),
        reflection: optionalText(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const hasExecutions = value.executions.length > 0;
    const hasExitAt = Boolean(value.exitAt);
    const hasExitPrice = !isBlank(value.exitPrice);
    if (!hasExecutions && isBlank(value.entryPrice)) {
      ctx.addIssue({ code: "custom", path: ["entryPrice"], message: "Entry price is required without executions" });
    }
    if (!hasExecutions && value.status === "closed" && !hasExitAt) {
      ctx.addIssue({ code: "custom", path: ["exitAt"], message: "Closed trades require an exit time" });
    }
    if (!hasExecutions && value.status === "closed" && !hasExitPrice) {
      ctx.addIssue({ code: "custom", path: ["exitPrice"], message: "Closed trades require an exit price" });
    }
    if (!hasExecutions && value.exitAt && new Date(value.exitAt).getTime() < new Date(value.entryAt).getTime()) {
      ctx.addIssue({ code: "custom", path: ["exitAt"], message: "Exit time cannot be before entry time" });
    }
    if (value.pnlOverridden && isBlank(value.overrideNetPnl)) {
      ctx.addIssue({ code: "custom", path: ["overrideNetPnl"], message: "Enter the manual net P&L or disable the override" });
    }
  });

export const strategySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: optionalText(),
  marketConditions: optionalText(),
  confirmations: optionalText(),
  entryRules: optionalText(),
  stopLossRules: optionalText(),
  takeProfitRules: optionalText(),
  riskRules: optionalText(),
  invalidation: optionalText(),
  checklist: z.array(z.string().trim().min(1).max(300)).max(100).optional().default([]),
});

export const journalSchema = z.object({
  journalDate: calendarDateString,
  accountId: z.string().uuid().nullable().optional(),
  notes: optionalText(10_000),
  mood: optionalText(100),
  mistakes: optionalText(),
  grade: optionalText(20),
  followedRules: z.boolean().optional().default(true),
});

export const backtestSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    instrument: z.string().trim().min(1).max(32),
    timeframe: z.string().max(20).optional().default("15m"),
    strategyId: z.string().uuid().nullable().optional(),
    startDate: calendarDateString,
    endDate: calendarDateString,
    session: optionalText(40),
    entryRules: optionalText(),
    exitRules: optionalText(),
    riskModel: optionalText(2000),
    notes: optionalText(10_000),
  })
  .refine((value) => value.startDate <= value.endDate, {
    path: ["endDate"],
    message: "End date cannot be before start date",
  });

export const backtestTradeSchema = z
  .object({
    instrument: z.string().trim().min(1).max(32),
    direction: z.enum(["long", "short"]),
    entryAt: dateTimeString,
    exitAt: optionalDateTimeString,
    entryPrice: requiredPositive,
    exitPrice: optionalPositive,
    stopLoss: optionalPositive,
    takeProfit: optionalPositive,
    resultR: requiredNumeric.optional().default("0"),
    resultCurrency: requiredNumeric.optional().default("0"),
    informationAtDecision: optionalText(),
    notes: optionalText(),
    followedRules: z.boolean().optional().default(true),
  })
  .refine((value) => !value.exitAt || new Date(value.exitAt) >= new Date(value.entryAt), {
    path: ["exitAt"],
    message: "Exit time cannot be before entry time",
  });

export const riskSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  defaultRiskPercent: optionalUpdateNonNegative.refine(
    (value) => isBlank(value) || decimal(value as string | number).lte(100),
    "Risk percent cannot exceed 100",
  ),
  maxDailyLoss: optionalUpdateNonNegative,
  maxWeeklyLoss: optionalUpdateNonNegative,
  maxTradesPerDay: z.number().int().min(0).max(10_000).optional(),
  maxConsecutiveLosses: z.number().int().min(0).max(10_000).optional(),
  maxOpenRisk: optionalUpdateNonNegative,
  minPlannedRr: optionalUpdateNonNegative,
  dailyProfitTarget: optionalUpdateNonNegative,
  maxPositionSize: optionalUpdateNonNegative,
  personalRules: z.string().max(10_000).optional(),
});

export const riskCheckSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  plannedRisk: requiredNonNegative,
  plannedRr: requiredNonNegative,
  positionSize: requiredNonNegative,
});

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  timezone: z.string().max(80).refine(isValidTimeZone, "Invalid timezone").optional(),
  theme: z.enum(["dark", "light"]).optional(),
  dateFormat: z.string().max(40).optional(),
  timeFormat: z.string().max(40).optional(),
  baseCurrency: z.string().regex(/^[A-Za-z]{3,8}$/).optional(),
  aiPermission: z.boolean().optional(),
});

export const instrumentSchema = z.object({
  symbol: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(80),
  category: z.string().max(32).optional().default("forex"),
  contractSize: optionalNonNegative,
  tickSize: optionalNonNegative,
  tickValue: optionalNonNegative,
  pipSize: optionalNonNegative,
  pipValue: optionalNonNegative,
  quoteCurrency: z.string().regex(/^[A-Za-z]{3,8}$/).optional().default("USD"),
  notes: z.string().max(2000).optional().default(""),
});

export const tagSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40).optional().default("custom"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default("#5d6b50"),
});
