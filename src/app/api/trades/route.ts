import { db } from "@/db";
import {
  screenshots,
  strategies,
  tags,
  tradeTags,
  trades,
} from "@/db/schema";
import { jsonError, parseFilters, requireUser } from "@/lib/api";
import { tradeWhere } from "@/lib/queries";
import { createTrade } from "@/lib/trade-service";
import { tradeSchema } from "@/lib/validations";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { session, user, error } = await requireUser();
  if (error) return error;
  const url = new URL(req.url);
  const filters = parseFilters(url);
  const integerParam = (name: string, fallback: number) => {
    const raw = url.searchParams.get(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  };
  const page = integerParam("page", 1);
  const limit = Math.min(100, integerParam("limit", 25));
  const q = url.searchParams.get("q")?.trim();
  const offset = (page - 1) * limit;
  const search = q
    ? or(
        ilike(trades.instrument, `%${q}%`),
        ilike(trades.displayId, `%${q}%`),
        ilike(trades.notes, `%${q}%`),
        ilike(strategies.name, `%${q}%`),
      )
    : undefined;
  const where = and(tradeWhere(session!.uid, filters, user!.timezone), search);

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(trades)
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .where(where);
  const rows = await db
    .select({ trade: trades, strategyName: strategies.name })
    .from(trades)
    .leftJoin(strategies, eq(strategies.id, trades.strategyId))
    .where(where)
    .orderBy(desc(trades.entryAt), desc(trades.id))
    .limit(limit)
    .offset(offset);

  const total = Number(countRow?.total ?? 0);
  const ids = rows.map((r) => r.trade.id);
  const tagRows = ids.length
    ? await db
        .select({ tradeId: tradeTags.tradeId, tag: tags })
        .from(tradeTags)
        .innerJoin(tags, eq(tags.id, tradeTags.tagId))
        .where(inArray(tradeTags.tradeId, ids))
    : [];
  const shots = ids.length
    ? await db.select().from(screenshots).where(inArray(screenshots.tradeId, ids))
    : [];

  return NextResponse.json({
    total,
    page,
    limit,
    trades: rows.map((r) => ({
      ...r.trade,
      strategyName: r.strategyName,
      tags: tagRows.filter((t) => t.tradeId === r.trade.id).map((t) => t.tag),
      screenshotCount: shots.filter((s) => s.tradeId === r.trade.id).length,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const body = await req.json().catch(() => null);
  const parsed = tradeSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid trade payload");
  try {
    const trade = await createTrade(session!.uid, parsed.data);
    return NextResponse.json({ trade }, { status: 201 });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Could not save trade", 400);
  }
}
