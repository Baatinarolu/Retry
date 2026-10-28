import { db } from "@/db";
import { instruments, tradingAccounts, users } from "@/db/schema";
import { requireUser } from "@/lib/api";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const [user] = await db.select().from(users).where(eq(users.id, session!.uid));
  const accounts = await db.select().from(tradingAccounts).where(eq(tradingAccounts.userId, session!.uid));
  const instrumentsList = await db.select().from(instruments).where(eq(instruments.userId, session!.uid));
  return NextResponse.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
          theme: user.theme,
          dateFormat: user.dateFormat,
          timeFormat: user.timeFormat,
          baseCurrency: user.baseCurrency,
          aiPermission: user.aiPermission,
          demoMode: user.demoMode,
        }
      : null,
    accounts,
    instruments: instrumentsList,
  });
}
