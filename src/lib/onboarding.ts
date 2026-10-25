import { db } from "@/db";
import {
  instruments,
  riskSettings,
  strategies,
  tags,
  tradingAccounts,
} from "@/db/schema";
import { DEFAULT_INSTRUMENTS, DEFAULT_STRATEGIES, ICT_SMC_TAGS } from "./constants";

export async function provisionNewUser(userId: string, currency: string) {
  const [account] = await db
    .insert(tradingAccounts)
    .values({
      userId,
      name: "Primary account",
      broker: "",
      currency,
      startingBalance: "10000.00",
      currentBalance: "10000.00",
      accountType: "live",
    })
    .returning();

  await db.insert(riskSettings).values({
    userId,
    accountId: account.id,
    defaultRiskPercent: "0.50",
    maxDailyLoss: "200.00",
    maxWeeklyLoss: "500.00",
    maxTradesPerDay: 4,
    maxConsecutiveLosses: 3,
    minPlannedRr: "2.00",
    personalRules: "No revenge trades. Stop after 3 losses. Risk ≤ 0.5% per idea. No trade without a screenshot plan.",
  });

  await db.insert(instruments).values(
    DEFAULT_INSTRUMENTS.map((i) => ({
      userId,
      ...i,
    })),
  );

  await db.insert(strategies).values(
    DEFAULT_STRATEGIES.map((s) => ({
      userId,
      ...s,
    })),
  );

  await db.insert(tags).values(
    ICT_SMC_TAGS.map((t) => ({
      userId,
      name: t.name,
      category: t.category,
      color: t.color,
    })),
  );

  return account;
}
