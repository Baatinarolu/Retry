import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  sessionVersion: integer("session_version").notNull().default(0),
  name: text("name").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  theme: text("theme").notNull().default("dark"),
  dateFormat: text("date_format").notNull().default("yyyy-MM-dd"),
  timeFormat: text("time_format").notNull().default("HH:mm"),
  baseCurrency: text("base_currency").notNull().default("USD"),
  aiPermission: boolean("ai_permission").notNull().default(false),
  demoMode: boolean("demo_mode").notNull().default(false),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_user_idx").on(t.userId), uniqueIndex("password_reset_token_idx").on(t.tokenHash)],
);

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rate_limits_reset_idx").on(t.resetAt)],
);

export const tradingAccounts = pgTable(
  "trading_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    broker: text("broker").notNull().default(""),
    currency: text("currency").notNull().default("USD"),
    startingBalance: numeric("starting_balance", { precision: 18, scale: 2 }).notNull(),
    currentBalance: numeric("current_balance", { precision: 18, scale: 2 }).notNull(),
    accountType: text("account_type").notNull().default("live"),
    isActive: boolean("is_active").notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

export const cashFlows = pgTable(
  "cash_flows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    /** Signed amount in the account currency; never included in trading P&L. */
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    externalId: text("external_id"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cash_flows_user_idx").on(t.userId),
    index("cash_flows_account_occurred_idx").on(t.accountId, t.occurredAt),
    uniqueIndex("cash_flows_source_idx").on(t.userId, t.accountId, t.externalId),
  ],
);

export const riskSettings = pgTable(
  "risk_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => tradingAccounts.id, { onDelete: "cascade" }),
    defaultRiskPercent: numeric("default_risk_percent", { precision: 8, scale: 4 }).notNull().default("0.5"),
    maxDailyLoss: numeric("max_daily_loss", { precision: 18, scale: 2 }).notNull().default("0"),
    maxWeeklyLoss: numeric("max_weekly_loss", { precision: 18, scale: 2 }).notNull().default("0"),
    maxTradesPerDay: integer("max_trades_per_day").notNull().default(5),
    maxConsecutiveLosses: integer("max_consecutive_losses").notNull().default(3),
    maxOpenRisk: numeric("max_open_risk", { precision: 18, scale: 2 }).notNull().default("0"),
    minPlannedRr: numeric("min_planned_rr", { precision: 8, scale: 2 }).notNull().default("2"),
    dailyProfitTarget: numeric("daily_profit_target", { precision: 18, scale: 2 }).notNull().default("0"),
    maxPositionSize: numeric("max_position_size", { precision: 18, scale: 4 }).notNull().default("0"),
    personalRules: text("personal_rules").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("risk_user_idx").on(t.userId), uniqueIndex("risk_account_idx").on(t.accountId)],
);

export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: text("symbol").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("forex"),
    contractSize: numeric("contract_size", { precision: 18, scale: 6 }).notNull().default("1"),
    tickSize: numeric("tick_size", { precision: 18, scale: 8 }).notNull().default("0.00001"),
    tickValue: numeric("tick_value", { precision: 18, scale: 8 }).notNull().default("1"),
    pipSize: numeric("pip_size", { precision: 18, scale: 8 }).notNull().default("0.0001"),
    pipValue: numeric("pip_value", { precision: 18, scale: 8 }).notNull().default("10"),
    quoteCurrency: text("quote_currency").notNull().default("USD"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("instruments_user_idx").on(t.userId),
    uniqueIndex("instruments_user_symbol_idx").on(t.userId, t.symbol),
  ],
);

export const strategies = pgTable(
  "strategies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    marketConditions: text("market_conditions").notNull().default(""),
    confirmations: text("confirmations").notNull().default(""),
    entryRules: text("entry_rules").notNull().default(""),
    stopLossRules: text("stop_loss_rules").notNull().default(""),
    takeProfitRules: text("take_profit_rules").notNull().default(""),
    riskRules: text("risk_rules").notNull().default(""),
    invalidation: text("invalidation").notNull().default(""),
    checklist: jsonb("checklist").$type<string[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    parentStrategyId: uuid("parent_strategy_id"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("strategies_user_idx").on(t.userId)],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("custom"),
    color: text("color").notNull().default("#2dd4bf"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tags_user_idx").on(t.userId),
    uniqueIndex("tags_user_name_idx").on(t.userId, t.name),
  ],
);

export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_views_user_idx").on(t.userId), uniqueIndex("saved_views_user_name_idx").on(t.userId, t.name)],
);

export const importMappingPresets = pgTable(
  "import_mapping_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mapping: jsonb("mapping").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("import_mapping_presets_user_idx").on(t.userId),
    uniqueIndex("import_mapping_presets_user_name_idx").on(t.userId, t.name),
  ],
);

export const importBatches = pgTable(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull().default(""),
    fileHash: text("file_hash").notNull(),
    originalCsv: text("original_csv").notNull(),
    columnMapping: jsonb("column_mapping").$type<Record<string, string>>().notNull().default({}),
    status: text("status").notNull().default("preview"),
    totalRows: integer("total_rows").notNull().default(0),
    importedRows: integer("imported_rows").notNull().default(0),
    rejectedRows: integer("rejected_rows").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
  },
  (t) => [index("import_batches_user_idx").on(t.userId), index("import_batches_account_idx").on(t.accountId)],
);

export const trades = pgTable(
  "trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => tradingAccounts.id, { onDelete: "restrict" }),
    importBatchId: uuid("import_batch_id").references(() => importBatches.id, { onDelete: "set null" }),
    sourceKey: text("source_key"),
    sourceHash: text("source_hash"),
    strategyId: uuid("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    displayId: text("display_id").notNull(),
    instrument: text("instrument").notNull(),
    marketCategory: text("market_category").notNull().default("forex"),
    direction: text("direction").notNull(),
    tradeType: text("trade_type").notNull().default("intraday"),
    session: text("session").notNull().default("london"),
    timezone: text("timezone").notNull().default("UTC"),
    entryAt: timestamp("entry_at", { withTimezone: true }).notNull(),
    exitAt: timestamp("exit_at", { withTimezone: true }),
    /** Latest realization instant: final exit, or latest partial reduction. */
    realizedAt: timestamp("realized_at", { withTimezone: true }),
    entryPrice: numeric("entry_price", { precision: 18, scale: 8 }).notNull(),
    exitPrice: numeric("exit_price", { precision: 18, scale: 8 }),
    stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
    takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
    positionSize: numeric("position_size", { precision: 18, scale: 6 }).notNull().default("1"),
    lotSize: numeric("lot_size", { precision: 18, scale: 6 }).notNull().default("0.1"),
    contractSize: numeric("contract_size", { precision: 18, scale: 6 }).notNull().default("1"),
    tickSize: numeric("tick_size", { precision: 18, scale: 8 }).notNull().default("0.00001"),
    tickValue: numeric("tick_value", { precision: 18, scale: 8 }).notNull().default("1"),
    pipSize: numeric("pip_size", { precision: 18, scale: 8 }).notNull().default("0.0001"),
    pipValue: numeric("pip_value", { precision: 18, scale: 8 }).notNull().default("10"),
    commission: numeric("commission", { precision: 18, scale: 4 }).notNull().default("0"),
    swap: numeric("swap", { precision: 18, scale: 4 }).notNull().default("0"),
    slippage: numeric("slippage", { precision: 18, scale: 4 }).notNull().default("0"),
    grossPnl: numeric("gross_pnl", { precision: 18, scale: 4 }).notNull().default("0"),
    netPnl: numeric("net_pnl", { precision: 18, scale: 4 }).notNull().default("0"),
    initialRisk: numeric("initial_risk", { precision: 18, scale: 4 }).notNull().default("0"),
    plannedRr: numeric("planned_rr", { precision: 12, scale: 4 }),
    actualRr: numeric("actual_rr", { precision: 12, scale: 4 }),
    rMultiple: numeric("r_multiple", { precision: 12, scale: 4 }),
    balanceBefore: numeric("balance_before", { precision: 18, scale: 2 }),
    balanceAfter: numeric("balance_after", { precision: 18, scale: 2 }),
    status: text("status").notNull().default("closed"),
    result: text("result").notNull().default("be"),
    marketBias: text("market_bias").notNull().default(""),
    htfDirection: text("htf_direction").notNull().default(""),
    entryTimeframe: text("entry_timeframe").notNull().default("15m"),
    htfTimeframe: text("htf_timeframe").notNull().default("4h"),
    marketStructure: text("market_structure").notNull().default(""),
    entryModel: text("entry_model").notNull().default(""),
    confluence: text("confluence").notNull().default(""),
    entryReason: text("entry_reason").notNull().default(""),
    slJustification: text("sl_justification").notNull().default(""),
    tpJustification: text("tp_justification").notNull().default(""),
    invalidation: text("invalidation").notNull().default(""),
    plannedExit: text("planned_exit").notNull().default(""),
    followedPlan: boolean("followed_plan").notNull().default(true),
    newsRelated: boolean("news_related").notNull().default(false),
    notes: text("notes").notNull().default(""),
    reviewStatus: text("review_status").notNull().default("unreviewed"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    nextAction: text("next_action").notNull().default(""),
    holdingMinutes: integer("holding_minutes"),
    pnlOverridden: boolean("pnl_overridden").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trades_user_idx").on(t.userId),
    index("trades_user_entry_idx").on(t.userId, t.entryAt),
    index("trades_user_realized_idx").on(t.userId, t.realizedAt),
    index("trades_account_idx").on(t.accountId),
    index("trades_import_batch_idx").on(t.importBatchId),
    index("trades_instrument_idx").on(t.userId, t.instrument),
    uniqueIndex("trades_source_idx").on(t.userId, t.accountId, t.sourceKey),
    uniqueIndex("trades_user_display_idx").on(t.userId, t.displayId),
  ],
);

export const tradeExecutions = pgTable(
  "trade_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    price: numeric("price", { precision: 18, scale: 8 }).notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull(),
    fees: numeric("fees", { precision: 18, scale: 4 }).notNull().default("0"),
    notes: text("notes").notNull().default(""),
  },
  (t) => [index("executions_trade_idx").on(t.tradeId)],
);

export const tradePricePoints = pgTable(
  "trade_price_points",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    price: numeric("price", { precision: 18, scale: 8 }).notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("price_points_trade_idx").on(t.tradeId),
    index("price_points_user_idx").on(t.userId),
    uniqueIndex("price_points_trade_time_idx").on(t.tradeId, t.observedAt),
  ],
);

export const tradeTags = pgTable(
  "trade_tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("trade_tags_unique").on(t.tradeId, t.tagId)],
);

export const psychologyRecords = pgTable(
  "psychology_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emotionBefore: text("emotion_before").notNull().default(""),
    emotionDuring: text("emotion_during").notNull().default(""),
    emotionAfter: text("emotion_after").notNull().default(""),
    confidence: integer("confidence").notNull().default(5),
    patience: integer("patience").notNull().default(5),
    fomo: boolean("fomo").notNull().default(false),
    fear: boolean("fear").notNull().default(false),
    greed: boolean("greed").notNull().default(false),
    revenge: boolean("revenge").notNull().default(false),
    overtrading: boolean("overtrading").notNull().default(false),
    hesitation: boolean("hesitation").notNull().default(false),
    impulsive: boolean("impulsive").notNull().default(false),
    earlyExit: boolean("early_exit").notNull().default(false),
    movedStop: boolean("moved_stop").notNull().default(false),
    brokeRiskRules: boolean("broke_risk_rules").notNull().default(false),
    followedPlan: boolean("followed_plan").notNull().default(true),
    lessons: text("lessons").notNull().default(""),
    didWell: text("did_well").notNull().default(""),
    improve: text("improve").notNull().default(""),
    reflection: text("reflection").notNull().default(""),
  },
  (t) => [
    index("psych_user_idx").on(t.userId),
    uniqueIndex("psych_trade_idx").on(t.tradeId),
  ],
);

export const screenshots = pgTable(
  "screenshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .notNull()
      .references(() => trades.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull().default("entry"),
    caption: text("caption").notNull().default(""),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("screenshots_trade_idx").on(t.tradeId), index("screenshots_user_idx").on(t.userId)],
);

export const dailyJournals = pgTable(
  "daily_journals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => tradingAccounts.id, { onDelete: "set null" }),
    journalDate: date("journal_date").notNull(),
    notes: text("notes").notNull().default(""),
    mood: text("mood").notNull().default(""),
    mistakes: text("mistakes").notNull().default(""),
    grade: text("grade").notNull().default(""),
    followedRules: boolean("followed_rules").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("journals_user_idx").on(t.userId),
    uniqueIndex("journals_user_date_idx").on(t.userId, t.journalDate),
  ],
);

export const backtests = pgTable(
  "backtests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instrument: text("instrument").notNull(),
    timeframe: text("timeframe").notNull().default("15m"),
    strategyId: uuid("strategy_id").references(() => strategies.id, { onDelete: "set null" }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    session: text("session").notNull().default(""),
    entryRules: text("entry_rules").notNull().default(""),
    exitRules: text("exit_rules").notNull().default(""),
    riskModel: text("risk_model").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("backtests_user_idx").on(t.userId)],
);

export const backtestTrades = pgTable(
  "backtest_trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    backtestId: uuid("backtest_id")
      .notNull()
      .references(() => backtests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    instrument: text("instrument").notNull(),
    direction: text("direction").notNull(),
    entryAt: timestamp("entry_at", { withTimezone: true }).notNull(),
    exitAt: timestamp("exit_at", { withTimezone: true }),
    entryPrice: numeric("entry_price", { precision: 18, scale: 8 }).notNull(),
    exitPrice: numeric("exit_price", { precision: 18, scale: 8 }),
    stopLoss: numeric("stop_loss", { precision: 18, scale: 8 }),
    takeProfit: numeric("take_profit", { precision: 18, scale: 8 }),
    resultR: numeric("result_r", { precision: 12, scale: 4 }).notNull().default("0"),
    resultCurrency: numeric("result_currency", { precision: 18, scale: 4 }).notNull().default("0"),
    informationAtDecision: text("information_at_decision").notNull().default(""),
    notes: text("notes").notNull().default(""),
    followedRules: boolean("followed_rules").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("backtest_trades_bt_idx").on(t.backtestId)],
);

export const aiReviews = pgTable(
  "ai_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    dateFrom: date("date_from"),
    dateTo: date("date_to"),
    sampleSize: integer("sample_size").notNull().default(0),
    content: text("content").notNull(),
    source: text("source").notNull().default("rules"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_reviews_user_idx").on(t.userId)],
);

export const customSessions = pgTable(
  "custom_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    startHour: integer("start_hour").notNull(),
    endHour: integer("end_hour").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type TradingAccount = typeof tradingAccounts.$inferSelect;
export type Trade = typeof trades.$inferSelect;
export type Strategy = typeof strategies.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type PsychologyRecord = typeof psychologyRecords.$inferSelect;
export type Screenshot = typeof screenshots.$inferSelect;
export type DailyJournal = typeof dailyJournals.$inferSelect;
export type Backtest = typeof backtests.$inferSelect;
export type BacktestTrade = typeof backtestTrades.$inferSelect;
export type Instrument = typeof instruments.$inferSelect;
export type RiskSetting = typeof riskSettings.$inferSelect;
