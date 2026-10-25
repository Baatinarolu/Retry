import { db } from "@/db";
import { dailyJournals, tradingAccounts } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { journalSchema } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const date = new URL(req.url).searchParams.get("date");
  if (date) {
    const [row] = await db
      .select()
      .from(dailyJournals)
      .where(and(eq(dailyJournals.userId, session!.uid), eq(dailyJournals.journalDate, date)));
    return NextResponse.json({ entry: row ?? null });
  }
  const entries = await db
    .select()
    .from(dailyJournals)
    .where(eq(dailyJournals.userId, session!.uid))
    .orderBy(desc(dailyJournals.journalDate));
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const parsed = journalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid journal entry");
  if (parsed.data.accountId) {
    const [account] = await db
      .select({ id: tradingAccounts.id })
      .from(tradingAccounts)
      .where(and(eq(tradingAccounts.id, parsed.data.accountId), eq(tradingAccounts.userId, session!.uid)));
    if (!account) return jsonError("Account not found", 404);
  }
  const [entry] = await db
    .insert(dailyJournals)
    .values({ userId: session!.uid, ...parsed.data })
    .onConflictDoUpdate({
      target: [dailyJournals.userId, dailyJournals.journalDate],
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning();
  return NextResponse.json({ entry });
}
