import { db } from "@/db";
import { cashFlows, tradingAccounts, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { signedCashFlowAmount, type CashFlowType } from "./cash-flow";
import { rebuildAccountBalances } from "./trade-service";

export type CashFlowPayload = {
  accountId: string;
  type: CashFlowType;
  amount: string | number;
  occurredAt: string;
  externalId?: string;
  notes?: string;
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockUser(tx: Tx, userId: string) {
  const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
  if (!user) throw new Error("User not found");
}

async function lockAccount(tx: Tx, userId: string, accountId: string) {
  const [account] = await tx
    .select()
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, userId)))
    .for("update");
  if (!account) throw new Error("Account not found");
  return account;
}

function valuesFor(payload: CashFlowPayload) {
  return {
    accountId: payload.accountId,
    type: payload.type,
    amount: signedCashFlowAmount(payload.type, payload.amount),
    occurredAt: new Date(payload.occurredAt),
    externalId: payload.externalId?.trim() || null,
    notes: payload.notes || "",
  };
}

export async function createCashFlow(userId: string, payload: CashFlowPayload) {
  const values = valuesFor(payload);
  if (Number.isNaN(values.occurredAt.getTime())) throw new Error("Invalid cash-flow date/time");
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    await lockAccount(tx, userId, payload.accountId);
    const [row] = await tx.insert(cashFlows).values({ userId, ...values }).returning();
    await rebuildAccountBalances(tx, payload.accountId);
    return row;
  });
}

export async function updateCashFlow(userId: string, cashFlowId: string, payload: CashFlowPayload) {
  const values = valuesFor(payload);
  if (Number.isNaN(values.occurredAt.getTime())) throw new Error("Invalid cash-flow date/time");
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [existing] = await tx
      .select()
      .from(cashFlows)
      .where(and(eq(cashFlows.id, cashFlowId), eq(cashFlows.userId, userId)))
      .for("update");
    if (!existing) return null;
    const oldAccount = await lockAccount(tx, userId, existing.accountId);
    const destination = payload.accountId === existing.accountId
      ? oldAccount
      : await lockAccount(tx, userId, payload.accountId);
    const [row] = await tx
      .update(cashFlows)
      .set({ ...values, accountId: destination.id, updatedAt: new Date() })
      .where(eq(cashFlows.id, cashFlowId))
      .returning();
    await rebuildAccountBalances(tx, oldAccount.id);
    if (destination.id !== oldAccount.id) await rebuildAccountBalances(tx, destination.id);
    return row;
  });
}

export async function deleteCashFlow(userId: string, cashFlowId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [existing] = await tx
      .select()
      .from(cashFlows)
      .where(and(eq(cashFlows.id, cashFlowId), eq(cashFlows.userId, userId)))
      .for("update");
    if (!existing) return false;
    await lockAccount(tx, userId, existing.accountId);
    await tx.delete(cashFlows).where(eq(cashFlows.id, cashFlowId));
    await rebuildAccountBalances(tx, existing.accountId);
    return true;
  });
}
