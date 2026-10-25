import { db } from "@/db";
import { cashFlows, tradingAccounts } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { createCashFlow, deleteCashFlow, updateCashFlow } from "@/lib/cash-flow-service";
import { cashFlowSchema } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const accountId = new URL(req.url).searchParams.get("accountId");
  if (accountId) {
    if (!z.string().uuid().safeParse(accountId).success) return jsonError("Valid accountId required");
    const [account] = await db
      .select({ id: tradingAccounts.id })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, accountId), eq(tradingAccounts.userId, session!.uid)));
    if (!account) return jsonError("Account not found", 404);
  }
  const rows = await db
    .select()
    .from(cashFlows)
    .where(and(eq(cashFlows.userId, session!.uid), accountId ? eq(cashFlows.accountId, accountId) : undefined))
    .orderBy(desc(cashFlows.occurredAt), desc(cashFlows.id));
  return NextResponse.json({ cashFlows: rows });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const parsed = cashFlowSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid cash flow");
  try {
    const cashFlow = await createCashFlow(session!.uid, parsed.data);
    return NextResponse.json({ cashFlow }, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not save cash flow");
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const parsed = cashFlowSchema.extend({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid cash flow");
  try {
    const cashFlow = await updateCashFlow(session!.uid, parsed.data.id, parsed.data);
    if (!cashFlow) return jsonError("Cash flow not found", 404);
    return NextResponse.json({ cashFlow });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not update cash flow");
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return jsonError("Valid id required");
  try {
    const deleted = await deleteCashFlow(session!.uid, id);
    if (!deleted) return jsonError("Cash flow not found", 404);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not delete cash flow");
  }
}
