import { db } from "@/db";
import { riskSettings, tradingAccounts } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { accountSchema } from "@/lib/validations";
import Decimal from "decimal.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const accounts = await db
    .select()
    .from(tradingAccounts)
    .where(eq(tradingAccounts.userId, session!.uid));
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const parsed = accountSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid account");
  const starting = String(parsed.data.startingBalance);
  const account = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(tradingAccounts)
      .values({
        userId: session!.uid,
        name: parsed.data.name,
        broker: parsed.data.broker,
        currency: parsed.data.currency.toUpperCase(),
        startingBalance: starting,
        currentBalance: starting,
        accountType: parsed.data.accountType,
        notes: parsed.data.notes,
        isActive: parsed.data.isActive,
      })
      .returning();
    await tx.insert(riskSettings).values({ userId: session!.uid, accountId: created.id });
    return created;
  });
  return NextResponse.json({ account }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const body = await req.json().catch(() => null);
  const parsed = accountSchema.partial().extend({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid account");

  const account = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, parsed.data.id), eq(tradingAccounts.userId, session!.uid)))
      .for("update");
    if (!existing) return null;

    const hasNewStarting = parsed.data.startingBalance !== undefined && parsed.data.startingBalance !== "";
    const starting = hasNewStarting ? String(parsed.data.startingBalance) : existing.startingBalance;
    const current = hasNewStarting
      ? new Decimal(existing.currentBalance).plus(new Decimal(starting).minus(existing.startingBalance)).toFixed(2)
      : existing.currentBalance;
    const [updated] = await tx
      .update(tradingAccounts)
      .set({
        name: parsed.data.name ?? existing.name,
        broker: parsed.data.broker ?? existing.broker,
        currency: parsed.data.currency?.toUpperCase() ?? existing.currency,
        accountType: parsed.data.accountType ?? existing.accountType,
        notes: parsed.data.notes ?? existing.notes,
        isActive: parsed.data.isActive ?? existing.isActive,
        startingBalance: starting,
        currentBalance: current,
        updatedAt: new Date(),
      })
      .where(eq(tradingAccounts.id, existing.id))
      .returning();
    return updated;
  });

  if (!account) return jsonError("Not found", 404);
  return NextResponse.json({ account });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return jsonError("Valid id required");
  const [existing] = await db
    .select()
    .from(tradingAccounts)
    .where(and(eq(tradingAccounts.id, id), eq(tradingAccounts.userId, session!.uid)));
  if (!existing) return jsonError("Not found", 404);
  try {
    await db.delete(tradingAccounts).where(eq(tradingAccounts.id, id));
    return NextResponse.json({ ok: true });
  } catch {
    return jsonError("Cannot delete an account that still has trades. Archive it instead.");
  }
}
