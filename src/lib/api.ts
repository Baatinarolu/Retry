import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSession } from "./auth";
import type { TradeFilters } from "./queries";

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    return { session: null as null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const [user] = await db
    .select({ sessionVersion: users.sessionVersion })
    .from(users)
    .where(eq(users.id, session.uid));
  if (!user || user.sessionVersion !== session.ver) {
    return { session: null as null, error: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
  return { session, error: null };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseFilters(url: URL): TradeFilters {
  return {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    accountId: url.searchParams.get("accountId"),
    instrument: url.searchParams.get("instrument"),
    strategyId: url.searchParams.get("strategyId"),
    direction: url.searchParams.get("direction"),
    session: url.searchParams.get("session"),
    dateField: url.searchParams.get("dateField") === "exit" ? "exit" : "entry",
  };
}
